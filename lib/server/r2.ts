// lib/server/r2.ts
// Minimal AWS SigV4 helpers for Cloudflare R2 (S3 API). Server-only — uses the R2 secret key.

const CF_ACCOUNT_ID    = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY!
const CF_R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY!
const CF_R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET!
export const CF_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!

const REGION  = 'auto'
const SERVICE = 's3'
const HOST    = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`

// Dev runs without R2 credentials until it has its own bucket — fail clearly instead of with a bad signature
function assertConfigured() {
  if (!CF_ACCOUNT_ID || !CF_R2_ACCESS_KEY || !CF_R2_SECRET_KEY || !CF_R2_BUCKET || !CF_R2_PUBLIC_URL) {
    throw new Error('Video storage (R2) is not configured on this server')
  }
}

// Keys we generate on upload: <uuid>.<ext>
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov|webm|m4v)$/i

async function hmac(key: ArrayBuffer | string, msg: string): Promise<ArrayBuffer> {
  const raw = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const k   = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(str: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))
}

function timestamps() {
  const iso = new Date().toISOString()
  return {
    dateStamp: iso.slice(0, 10).replace(/-/g, ''),
    amzDate:   iso.replace(/[:-]/g, '').replace(/\.\d{3}/, ''),
  }
}

async function signature(dateStamp: string, stringToSign: string) {
  const signingKey = await hmac(await hmac(await hmac(await hmac(`AWS4${CF_R2_SECRET_KEY}`, dateStamp), REGION), SERVICE), 'aws4_request')
  return hex(await hmac(signingKey, stringToSign))
}

/** The object key for one of our public video URLs, or null if the URL isn't an R2 video we own. */
export function keyFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.host !== new URL(CF_R2_PUBLIC_URL).host) return null
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    return KEY_PATTERN.test(key) ? key : null
  } catch {
    return null
  }
}

/**
 * Presigned PUT URL. Content-Type and Content-Length are signed, so the browser
 * must upload exactly this type and size — R2 rejects anything else.
 */
export async function presignPut(key: string, contentType: string, contentLength: number, expiresIn = 3600) {
  assertConfigured()
  const { dateStamp, amzDate } = timestamps()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`

  const headers: Record<string, string> = {
    'content-length': String(contentLength),
    'content-type':   contentType,
    'host':           HOST,
  }
  const signedHeaders    = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')

  const query = Object.entries({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    `${CF_R2_ACCESS_KEY}/${credentialScope}`,
    'X-Amz-Date':          amzDate,
    'X-Amz-Expires':       String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = ['PUT', `/${CF_R2_BUCKET}/${key}`, query, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256(canonicalRequest)].join('\n')

  return `https://${HOST}/${CF_R2_BUCKET}/${key}?${query}&X-Amz-Signature=${await signature(dateStamp, stringToSign)}`
}

export async function deleteObject(key: string) {
  assertConfigured()
  const { dateStamp, amzDate } = timestamps()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const bodyHash = await sha256('')

  const headers: Record<string, string> = {
    'host':                 HOST,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date':           amzDate,
  }
  const signedHeaders    = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')

  const canonicalRequest = ['DELETE', `/${CF_R2_BUCKET}/${key}`, '', canonicalHeaders, signedHeaders, bodyHash].join('\n')
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256(canonicalRequest)].join('\n')

  const authorization = `AWS4-HMAC-SHA256 Credential=${CF_R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${await signature(dateStamp, stringToSign)}`

  return fetch(`https://${HOST}/${CF_R2_BUCKET}/${key}`, {
    method:  'DELETE',
    headers: { ...headers, Authorization: authorization },
  })
}
