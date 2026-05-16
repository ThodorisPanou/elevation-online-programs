// app/api/upload-video/route.ts
// Generates a presigned PUT URL for direct browser → R2 upload.
// No file passes through this server — no size limit.

import { NextRequest, NextResponse } from 'next/server'

const CF_ACCOUNT_ID    = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY!
const CF_R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY!
const CF_R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET!
const CF_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!

// HMAC-SHA256 helper
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

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json()

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 })
    }

    const ext       = filename.split('.').pop() ?? 'mp4'
    const key       = `${crypto.randomUUID()}.${ext}`
    const region    = 'auto'
    const service   = 's3'
    const host      = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const expiresIn = 3600 // 1 hour

    const now       = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate   = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const credential      = `${CF_R2_ACCESS_KEY}/${credentialScope}`

    // Canonical query string for presigned URL
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
      'X-Amz-Credential':    credential,
      'X-Amz-Date':          amzDate,
      'X-Amz-Expires':       String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    })
    // Must be sorted
    const sortedQuery = Array.from(queryParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const canonicalRequest = [
      'PUT',
      `/${CF_R2_BUCKET}/${key}`,
      sortedQuery,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256(canonicalRequest),
    ].join('\n')

    const signingKey = await hmac(
      await hmac(
        await hmac(
          await hmac(`AWS4${CF_R2_SECRET_KEY}`, dateStamp),
          region
        ),
        service
      ),
      'aws4_request'
    )
    const signature = hex(await hmac(signingKey, stringToSign))

    const presignedUrl = `https://${host}/${CF_R2_BUCKET}/${key}?${sortedQuery}&X-Amz-Signature=${signature}`
    const publicUrl    = `${CF_R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ presignedUrl, publicUrl, key })
  } catch (err: any) {
    console.error('upload-video presign error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
