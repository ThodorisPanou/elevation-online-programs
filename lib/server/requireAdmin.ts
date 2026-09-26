// lib/server/requireAdmin.ts
// Guards API routes: the request must carry a valid Supabase access token
// (Authorization: Bearer <token>) for an email listed in ADMIN_EMAILS.
// Being signed in is not enough on its own — public sign-up is open on the Supabase project.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

/** Returns an error response to send back, or null when the caller is an admin. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Verifies the token with Supabase Auth (signature + expiry + user still exists)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (ADMIN_EMAILS.length === 0) {
    console.error('requireAdmin: ADMIN_EMAILS is not set — refusing all requests')
    return NextResponse.json({ error: 'Server not configured: ADMIN_EMAILS missing' }, { status: 500 })
  }
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  return null
}
