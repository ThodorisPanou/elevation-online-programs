// app/api/me/route.ts
// Who is signed in and what they may do. Used by the admin layout to route and guard pages.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'

// → { email, isAdmin, coach: { id, username, name, active, must_change_password } | null,
//     athlete: { id, username, login_disabled } | null }
export async function GET(req: NextRequest) {
  const caller = await requireUser(req)
  if (caller instanceof NextResponse) return caller

  const { user, isAdmin, coach, athlete } = caller
  return NextResponse.json({
    email: user.email,
    isAdmin,
    coach: coach && {
      id:                   coach.id,
      username:             coach.username,
      name:                 coach.name,
      active:               coach.active,
      must_change_password: coach.must_change_password,
    },
    athlete: athlete && {
      id:             athlete.id,
      username:       athlete.username,
      login_disabled: athlete.login_disabled,
    },
  })
}
