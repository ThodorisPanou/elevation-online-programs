// app/api/delete-video/route.ts
// Deletes a video file from Cloudflare R2 by its public URL. Coaches + admins only.
// The app always clears exercises.video_url first, so a file may only be deleted once NO exercise uses it:
//   - still used by any exercise              → nothing deleted ({ skipped: 'in-use' })
//   - in a coach folder <coach_id>/…          → that coach or an admin
//   - older file without a folder (unused)    → any coach or admin (orphan cleanup)

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'
import { coachFolderOfKey, deleteObject, keyFromPublicUrl } from '@/lib/server/r2'

// Body: { videoId: <public URL> } → { success: true } | { success: true, skipped: 'not-r2' | 'in-use' }
export async function DELETE(req: NextRequest) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { videoId } = await req.json()

    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ error: 'No videoId provided' }, { status: 400 })
    }

    // Only keys we generated in our bucket; anything else (e.g. legacy Supabase storage links) has nothing in R2
    const key = keyFromPublicUrl(videoId)
    if (!key) return NextResponse.json({ success: true, skipped: 'not-r2' })

    const { count, error } = await supabaseAdmin
      .from('exercises').select('id', { count: 'exact', head: true }).eq('video_url', videoId)
    if (error) throw error
    if (count) return NextResponse.json({ success: true, skipped: 'in-use' })

    const folder = coachFolderOfKey(key)
    if (!caller.isAdmin && folder && folder !== caller.coach?.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const r2Res = await deleteObject(key)
    if (!r2Res.ok) {
      console.error('R2 delete error:', await r2Res.text())
      return NextResponse.json({ error: 'R2 delete failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('delete-video route error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
