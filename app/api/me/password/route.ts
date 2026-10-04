// app/api/me/password/route.ts
// Change your own password. Used for the forced change after a temporary password (coaches) and from the
// header menu. Runs on the server because clearing `coaches.must_change_password` needs the service role.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/server/auth'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'
import { passwordProblem } from '@/lib/logins'

// Body: { password } → { success: true }
export async function POST(req: NextRequest) {
  const caller = await requireUser(req)
  if (caller instanceof NextResponse) return caller
  if (!caller.isAdmin && ((caller.coach && !caller.coach.active) || caller.athlete?.login_disabled)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  try {
    const { password } = await req.json().catch(() => ({}))
    if (typeof password !== 'string') return NextResponse.json({ error: 'password required' }, { status: 400 })

    const problem = passwordProblem(password)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    // Reject "changing" to the current (e.g. temporary) password: try signing in with it on a throwaway client
    const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: sameErr } = await probe.auth.signInWithPassword({ email: caller.user.email!, password })
    if (!sameErr) {
      await probe.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: 'Choose a password different from the current one' }, { status: 400 })
    }

    // has_password: athletes start without one (login links); the athlete app nudges them until it's set.
    // app_metadata is writable only with the service role.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(caller.user.id, {
      password,
      app_metadata: { ...caller.user.app_metadata, has_password: true },
    })
    if (authError) throw authError

    if (caller.coach?.must_change_password) {
      const { error } = await supabaseAdmin
        .from('coaches')
        .update({ must_change_password: false })
        .eq('id', caller.coach.id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/me/password:', err)
    return NextResponse.json({ error: 'Could not change the password' }, { status: 500 })
  }
}
