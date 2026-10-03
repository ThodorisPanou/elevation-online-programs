// app/api/athletes/[id]/route.ts
// Coach of the athlete or admin. DELETE → { success: true }: the athlete with their programs, login links,
// login (auth user) and photo. Replaces the delete_athlete() RPC, which couldn't remove the auth user.

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { errorResponse } from '@/lib/server/coaches'
import { deleteAthleteFully } from '@/lib/server/athletes'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    await deleteAthleteFully(caller, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse('DELETE /api/athletes/[id]', err)
  }
}
