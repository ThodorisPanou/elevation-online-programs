// app/api/coaches/route.ts
// Admin only. GET: all coaches with athlete/program/exercise counts. POST: create a coach login.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { createCoach, errorResponse, listCoaches } from '@/lib/server/coaches'

export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req)
  if (caller instanceof NextResponse) return caller

  try {
    return NextResponse.json({ coaches: await listCoaches() })
  } catch (err) {
    return errorResponse('GET /api/coaches', err)
  }
}

// Body: { username, name, email? } → { coach, tempPassword }. The temp password is shown to the admin once.
export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req)
  if (caller instanceof NextResponse) return caller

  try {
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await createCoach(body), { status: 201 })
  } catch (err) {
    return errorResponse('POST /api/coaches', err)
  }
}
