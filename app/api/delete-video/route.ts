// app/api/delete-video/route.ts
// Deletes a video from Cloudflare R2 by its public URL.

import { NextRequest, NextResponse } from 'next/server'

const CF_ACCOUNT_ID    = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY!
const CF_R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY!
const CF_R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET!
const CF_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!

async function signedFetch(method: string, key: string) {
  const region  = 'auto'
  const service = 's3'

  const now       = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate   = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'

  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // empty body

  const headers: Record<string, string> = {
    'host':                 `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date':           amzDate,
  }

  const signedHeaders    = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')
  const canonicalUri     = `/${CF_R2_BUCKET}/${key}`
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, bodyHash].join('\n')

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

  const fullUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${CF_R2_BUCKET}/${key}`
  return fetch(fullUrl, {
    method,
    headers: { ...headers, Authorization: authorization },
  })
}

export async function DELETE(req: NextRequest) {
  try {
    const { videoId } = await req.json()

    if (!videoId) {
      return NextResponse.json({ error: 'No videoId provided' }, { status: 400 })
    }

    // videoId is the full public URL — extract just the key
    const key = videoId.replace(`${CF_R2_PUBLIC_URL}/`, '')

    const r2Res = await signedFetch('DELETE', key)

    if (!r2Res.ok) {
      const err = await r2Res.text()
      console.error('R2 delete error:', err)
      return NextResponse.json({ error: 'R2 delete failed', detail: err }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('delete-video route error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
