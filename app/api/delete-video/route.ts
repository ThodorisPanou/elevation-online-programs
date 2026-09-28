// app/api/delete-video/route.ts
// Deletes a video from Cloudflare R2 by its public URL. Coaches + admins only.

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { deleteObject, keyFromPublicUrl } from '@/lib/server/r2'

export async function DELETE(req: NextRequest) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { videoId } = await req.json()

    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ error: 'No videoId provided' }, { status: 400 })
    }

    // videoId is the full public URL. Only keys we generated in our bucket can be deleted;
    // anything else (e.g. legacy Supabase storage links) has nothing in R2 to remove.
    const key = keyFromPublicUrl(videoId)
    if (!key) return NextResponse.json({ success: true, skipped: true })

    const r2Res = await deleteObject(key)

    if (!r2Res.ok) {
      const err = await r2Res.text()
      console.error('R2 delete error:', err)
      return NextResponse.json({ error: 'R2 delete failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('delete-video route error:', err)
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
