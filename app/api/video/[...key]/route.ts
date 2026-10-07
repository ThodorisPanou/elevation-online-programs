// app/api/video/[...key]/route.ts
// Public: serves an exercise video from the app's own address — the player's fallback when the public r2.dev
// address fails on a device (2026-10: some iPhones couldn't load r2.dev videos at all, while incognito could).
// Reads through the R2 S3 API, so it doesn't depend on r2.dev. Videos are public on r2.dev anyway, so no auth.
// Supports Range (Safari needs 206s to play video); long ranges are cut to CHUNK — players ask for the rest.

import { NextRequest, NextResponse } from 'next/server'
import { getObject, isVideoKey } from '@/lib/server/r2'

const CHUNK = 8 * 1024 * 1024

// "bytes=a-" or "bytes=a-b" → capped to CHUNK; anything else (suffix ranges, several ranges) is passed on as-is
function capRange(range: string | null): string | undefined {
  if (!range) return undefined
  const m = range.match(/^bytes=(\d+)-(\d*)$/)
  if (!m) return range
  const start = Number(m[1])
  const end   = m[2] === '' ? start + CHUNK - 1 : Math.min(Number(m[2]), start + CHUNK - 1)
  return `bytes=${start}-${end}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.map(decodeURIComponent).join('/')
  if (!isVideoKey(key)) return new NextResponse(null, { status: 404 })

  try {
    const r2 = await getObject(key, capRange(req.headers.get('range')))
    if (r2.status === 404) return new NextResponse(null, { status: 404 })
    if (!r2.ok && r2.status !== 416) {
      console.error('video proxy: R2', r2.status, key)
      return new NextResponse(null, { status: 502 })
    }

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      // private: shared caches must not mix up the 206 pieces; the browser may keep them (keys never change)
      'Cache-Control': 'private, max-age=86400',
    })
    for (const h of ['content-type', 'content-length', 'content-range', 'etag', 'last-modified']) {
      const v = r2.headers.get(h)
      if (v) headers.set(h, v)
    }
    return new NextResponse(r2.body, { status: r2.status, headers })
  } catch (err) {
    console.error('video proxy error:', err)
    return new NextResponse(null, { status: 502 })
  }
}
