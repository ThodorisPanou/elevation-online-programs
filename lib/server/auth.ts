// lib/server/auth.ts
// Guards API routes. The request must carry a valid Supabase access token (Authorization: Bearer <token>).
// Roles come from the database, not from env vars:
//   admin — row in `admins`: full access to every coach's data and to coach management
//   coach — active row in `coaches`: only their own athletes / programs / exercises
//
// Usage:
//   const caller = await requireCoach(req)
//   if (caller instanceof NextResponse) return caller

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'

export interface CoachRow {
  id:                   string
  user_id:              string
  username:             string
  name:                 string
  email:                string | null
  active:               boolean
  must_change_password: boolean
  created_at:           string
}

export interface Caller {
  user:    User
  isAdmin: boolean
  coach:   CoachRow | null   // null for an admin without a coach profile
}

const deny = (error: string, status: number) => NextResponse.json({ error }, { status })

/** Any signed-in user (even an inactive coach, or one who must still change their password). */
export async function requireUser(req: NextRequest): Promise<Caller | NextResponse> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return deny('Not signed in', 401)

  // Verifies the token with Supabase Auth (signature + expiry + user still exists and isn't banned)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return deny('Not signed in', 401)

  const [admin, coach] = await Promise.all([
    supabaseAdmin.from('admins').select('id').eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('coaches').select('*').eq('user_id', user.id).maybeSingle(),
  ])
  if (admin.error || coach.error) {
    console.error('requireUser: role lookup failed', admin.error ?? coach.error)
    return deny('Could not check permissions', 500)
  }

  return { user, isAdmin: !!admin.data, coach: coach.data as CoachRow | null }
}

/** An admin, or an active coach who has already replaced their temporary password. */
export async function requireCoach(req: NextRequest): Promise<Caller | NextResponse> {
  const caller = await requireUser(req)
  if (caller instanceof NextResponse) return caller
  if (caller.isAdmin) return caller

  if (!caller.coach?.active)             return deny('Not allowed', 403)
  if (caller.coach.must_change_password) return deny('Change your temporary password first', 403)
  return caller
}

/** Admins only. */
export async function requireAdmin(req: NextRequest): Promise<Caller | NextResponse> {
  const caller = await requireUser(req)
  if (caller instanceof NextResponse) return caller
  return caller.isAdmin ? caller : deny('Not allowed', 403)
}
