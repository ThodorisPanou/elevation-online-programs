// app/api/upload-video/route.ts
// Generates a presigned PUT URL for direct browser → R2 upload.
// No file passes through this server. Coaches + admins only; type and size are enforced by the signature.
// Files go into the exercise's coach folder: <coach_id>/<uuid>.<ext>

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'
import { presignPut, CF_R2_PUBLIC_URL } from '@/lib/server/r2'

const MAX_BYTES = 300 * 1024 * 1024 // 300 MB — uploads are normally compressed in the browser first

// Allowed content types → stored extension (the client's filename is never trusted)
const EXTENSIONS: Record<string, string> = {
  'video/mp4':       'mp4',
  'video/quicktime': 'mov',
  'video/webm':      'webm',
  'video/x-m4v':     'm4v',
}

// Body: { contentType, size, exerciseId } → { presignedUrl, publicUrl, key }
export async function POST(req: NextRequest) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { contentType, size, exerciseId } = await req.json()

    const ext = EXTENSIONS[contentType]
    if (!ext) {
      return NextResponse.json({ error: `Unsupported video type: ${contentType || 'unknown'}` }, { status: 400 })
    }
    if (!Number.isInteger(size) || size <= 0) {
      return NextResponse.json({ error: 'size required' }, { status: 400 })
    }
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: `Video too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 })
    }
    if (typeof exerciseId !== 'string' || !exerciseId) {
      return NextResponse.json({ error: 'exerciseId required' }, { status: 400 })
    }

    // The exercise decides the folder; a coach may only upload for their own exercises
    const { data: exercise, error } = await supabaseAdmin
      .from('exercises').select('coach_id').eq('id', exerciseId).maybeSingle()
    if (error) throw error
    if (!exercise) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    if (!caller.isAdmin && exercise.coach_id !== caller.coach?.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const key          = `${exercise.coach_id}/${crypto.randomUUID()}.${ext}`
    const presignedUrl = await presignPut(key, contentType, size)
    const publicUrl    = `${CF_R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ presignedUrl, publicUrl, key })
  } catch (err) {
    console.error('upload-video presign error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
