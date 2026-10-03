// app/api/athletes/[id]/login-link/route.ts
// Coach of the athlete or admin. POST → { url, expiresAt }: a one-time 7-day login link to send the athlete
// (e.g. over Instagram). Any older unused link stops working; the first link also creates the athlete's login.

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { errorResponse } from '@/lib/server/coaches'
import { createLoginLink } from '@/lib/server/athletes'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    return NextResponse.json(await createLoginLink(caller, id, req.nextUrl.origin), { status: 201 })
  } catch (err) {
    return errorResponse('POST /api/athletes/[id]/login-link', err)
  }
}
