// app/api/coaches/[id]/route.ts
// Admin only. PATCH body is one action:
//   { action: 'update', username?, name?, email? }  → { coach }
//   { action: 'reset-password' }                    → { tempPassword }  (coach must change it on next login)
//   { action: 'deactivate' } / { action: 'activate' } → { coach }

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { errorResponse, resetCoachPassword, setCoachActive, updateCoach } from '@/lib/server/coaches'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    const body   = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'update':         return NextResponse.json({ coach: await updateCoach(id, body) })
      case 'reset-password': return NextResponse.json(await resetCoachPassword(id))
      case 'deactivate':     return NextResponse.json({ coach: await setCoachActive(id, false) })
      case 'activate':       return NextResponse.json({ coach: await setCoachActive(id, true) })
      default:               return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    return errorResponse('PATCH /api/coaches/[id]', err)
  }
}
