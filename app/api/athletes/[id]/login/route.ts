// app/api/athletes/[id]/login/route.ts
// An athlete's login, managed by their coach or the admin.
//   GET                                   → { login }  (username, account, disabled, last sign-in, open link)
//   PUT   { username }                    → { login }  (set or change; the auth email follows)
//   PATCH { action: 'disable' | 'enable' } → { login }

import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/server/auth'
import { errorResponse } from '@/lib/server/coaches'
import { getLoginStatus, setAthleteLoginDisabled, setAthleteUsername } from '@/lib/server/athletes'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    return NextResponse.json({ login: await getLoginStatus(caller, id) })
  } catch (err) {
    return errorResponse('GET /api/athletes/[id]/login', err)
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    const body   = await req.json().catch(() => ({}))
    return NextResponse.json({ login: await setAthleteUsername(caller, id, body.username) })
  } catch (err) {
    return errorResponse('PUT /api/athletes/[id]/login', err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const caller = await requireCoach(req)
  if (caller instanceof NextResponse) return caller

  try {
    const { id } = await params
    const body   = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'disable': return NextResponse.json({ login: await setAthleteLoginDisabled(caller, id, true) })
      case 'enable':  return NextResponse.json({ login: await setAthleteLoginDisabled(caller, id, false) })
      default:        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    return errorResponse('PATCH /api/athletes/[id]/login', err)
  }
}
