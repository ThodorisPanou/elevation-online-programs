// app/api/upload-video/route.ts
// Proxies video uploads to Cloudflare R2 via S3-compatible API

import { NextRequest, NextResponse } from 'next/server'

const CF_ACCOUNT_ID      = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_R2_ACCESS_KEY   = process.env.CLOUDFLARE_R2_ACCESS_KEY!
const CF_R2_SECRET_KEY   = process.env.CLOUDFLARE_R2_SECRET_KEY!
const CF_R2_BUCKET       = process.env.CLOUDFLARE_R2_BUCKET!
const CF_R2_PUBLIC_URL   = process.env.CLOUDFLARE_R2_PUBLIC_URL!  // e.g. https://pub-xxx.r2.dev

// Minimal AWS Signature V4 for R2
async function signedFetch(
  url: string,
  method: string,
  body: ArrayBuffer,
  contentType: string,
  key: string,
) {
  const endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const fullUrl  = `${endpoint}/${CF_R2_BUCKET}/${key}`
  const region   = 'auto'
  const service  = 's3'

  const now       = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate   = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'

  const bodyHash = await crypto.subtle.digest('SHA-256', body)
  const bodyHashHex = Array.from(new Uint8Array(bodyHash)).map(b => b.toString(16).padStart(2, '0')).join('')

  const headers: Record<string, string> = {
    'host':                 `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    'x-amz-content-sha256': bodyHashHex,
    'x-amz-date':           amzDate,
    'content-type':         contentType,
  }

  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')
  const canonicalUri = `/${CF_R2_BUCKET}/${key}`
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, bodyHashHex].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  ].join('\n')

  const sign = async (keyData: ArrayBuffer | string, msg: string) => {
    const k = typeof keyData === 'string'
      ? await crypto.subtle.importKey('raw', new TextEncoder().encode(keyData), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      : await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  }

  const signingKey = await sign(
    await sign(await sign(await sign(`AWS4${CF_R2_SECRET_KEY}`, dateStamp), region), service),
    'aws4_request'
  )
  const signature = Array.from(new Uint8Array(await sign(signingKey, stringToSign)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const authorization = `AWS4-HMAC-SHA256 Credential=${CF_R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(fullUrl, {
    method,
    headers: { ...headers, Authorization: authorization },
    body,
  })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext        = file.name.split('.').pop() ?? 'mp4'
    const key        = `${crypto.randomUUID()}.${ext}`
    const buffer     = await file.arrayBuffer()
    const contentType = file.type || 'video/mp4'

    const r2Res = await signedFetch('', 'PUT', buffer, contentType, key)

    if (!r2Res.ok) {
      const err = await r2Res.text()
      console.error('R2 upload error:', err)
      return NextResponse.json({ error: 'R2 upload failed', detail: err }, { status: 500 })
    }

    const publicUrl = `${CF_R2_PUBLIC_URL}/${key}`
    return NextResponse.json({ videoId: publicUrl })
  } catch (err: any) {
    console.error('upload-video route error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
