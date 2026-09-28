// lib/server/coaches.ts
// Coach account management (admin only — callers must check requireAdmin first).
// A coach = an auth user `<username>@login.invalid` + a `coaches` row. Auth users are created
// pre-confirmed via the service role, so Supabase never sends an email.

import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'
import type { CoachRow } from '@/lib/server/auth'
import { USERNAME_PATTERN, USERNAME_HINT, normalizeUsername, toLoginEmail } from '@/lib/logins'

// "Banned" in Supabase Auth = can't sign in or refresh a session. ~100 years ≈ until reactivated.
const BAN_FOREVER = '876000h'

export class CoachError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** JSON error for a route: CoachError → its message/status, anything else → logged + generic 500. */
export function errorResponse(where: string, err: unknown) {
  if (err instanceof CoachError) return NextResponse.json({ error: err.message }, { status: err.status })
  console.error(`${where}:`, err)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}

export interface CoachWithCounts extends CoachRow {
  athletes:  number
  programs:  number
  exercises: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// Readable temporary password, e.g. "kt7m-q3rw-8vxe" (no 0/o/1/l/i to avoid mix-ups when read aloud)
export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes    = crypto.getRandomValues(new Uint8Array(12))
  const chars    = Array.from(bytes, b => alphabet[b % alphabet.length])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map(g => g.join('')).join('-')
}

function checkUsername(input: unknown): string {
  const username = normalizeUsername(String(input ?? ''))
  if (!USERNAME_PATTERN.test(username)) throw new CoachError(`Invalid username — ${USERNAME_HINT}`)
  return username
}

function checkName(input: unknown): string {
  const name = String(input ?? '').trim()
  if (!name)             throw new CoachError('Name is required')
  if (name.length > 100) throw new CoachError('Name is too long')
  return name
}

function checkEmail(input: unknown): string | null {
  const email = String(input ?? '').trim().toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CoachError('Invalid email')
  return email
}

async function getCoach(id: string): Promise<CoachRow> {
  const { data, error } = await supabaseAdmin.from('coaches').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data)  throw new CoachError('Coach not found', 404)
  return data as CoachRow
}

async function usernameTaken(username: string, exceptCoachId?: string): Promise<boolean> {
  let query = supabaseAdmin.from('coaches').select('id').eq('username', username)
  if (exceptCoachId) query = query.neq('id', exceptCoachId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).length > 0
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function listCoaches(): Promise<CoachWithCounts[]> {
  const { data, error } = await supabaseAdmin.from('coaches').select('*').order('name')
  if (error) throw error

  // Per-coach counts — small tables, so 3 plain queries beat PostgREST embeds
  // (coaches ↔ athletes is also reachable through programs, which makes embeds ambiguous)
  const counts = async (table: 'athletes' | 'programs' | 'exercises') => {
    const { data, error } = await supabaseAdmin.from(table).select('coach_id').not('coach_id', 'is', null)
    if (error) throw error
    const map = new Map<string, number>()
    for (const row of data ?? []) map.set(row.coach_id, (map.get(row.coach_id) ?? 0) + 1)
    return map
  }
  const [athletes, programs, exercises] = await Promise.all([counts('athletes'), counts('programs'), counts('exercises')])

  return (data as CoachRow[]).map(c => ({
    ...c,
    athletes:  athletes.get(c.id)  ?? 0,
    programs:  programs.get(c.id)  ?? 0,
    exercises: exercises.get(c.id) ?? 0,
  }))
}

// ─── Create ───────────────────────────────────────────────────────────────

export async function createCoach(input: { username?: unknown, name?: unknown, email?: unknown }) {
  const username = checkUsername(input.username)
  const name     = checkName(input.name)
  const email    = checkEmail(input.email)

  if (await usernameTaken(username)) throw new CoachError('Username already taken', 409)

  const tempPassword = generateTempPassword()
  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         toLoginEmail(username),
    password:      tempPassword,
    email_confirm: true,
    user_metadata: { name },
  })
  if (authError) {
    if (authError.code === 'email_exists') throw new CoachError('Username already taken', 409)
    throw authError
  }

  const { data: coach, error } = await supabaseAdmin
    .from('coaches')
    .insert({ user_id: created.user.id, username, name, email })
    .select()
    .single()

  if (error) {
    // Don't leave an auth user without a coach row behind
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    throw error
  }

  return { coach: coach as CoachRow, tempPassword }
}

// ─── Update ───────────────────────────────────────────────────────────────

export async function updateCoach(id: string, input: { username?: unknown, name?: unknown, email?: unknown }) {
  const coach = await getCoach(id)
  const patch: Partial<CoachRow> = {}

  if (input.name  !== undefined) patch.name  = checkName(input.name)
  if (input.email !== undefined) patch.email = checkEmail(input.email)

  const username = input.username !== undefined ? checkUsername(input.username) : coach.username
  const usernameChanged = username !== coach.username

  if (usernameChanged) {
    if (await usernameTaken(username, id)) throw new CoachError('Username already taken', 409)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(coach.user_id, {
      email: toLoginEmail(username), email_confirm: true,
    })
    if (error) {
      if (error.code === 'email_exists') throw new CoachError('Username already taken', 409)
      throw error
    }
    patch.username = username
  }

  const { data, error } = await supabaseAdmin.from('coaches').update(patch).eq('id', id).select().single()
  if (error) {
    // Keep the login and the coaches row in sync
    if (usernameChanged) {
      await supabaseAdmin.auth.admin.updateUserById(coach.user_id, { email: toLoginEmail(coach.username), email_confirm: true })
    }
    throw error
  }
  return data as CoachRow
}

/** New temporary password; the coach must change it on next login. */
export async function resetCoachPassword(id: string) {
  const coach        = await getCoach(id)
  const tempPassword = generateTempPassword()

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(coach.user_id, { password: tempPassword })
  if (authError) throw authError

  const { error } = await supabaseAdmin.from('coaches').update({ must_change_password: true }).eq('id', id)
  if (error) throw error

  return { tempPassword }
}

/**
 * Deactivated coaches can't sign in (auth ban) and lose all data access right away
 * (`my_coach_id()` only returns active coaches, so RLS denies even a still-valid access token).
 */
export async function setCoachActive(id: string, active: boolean) {
  const coach = await getCoach(id)

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(coach.user_id, {
    ban_duration: active ? 'none' : BAN_FOREVER,
  })
  if (authError) throw authError

  const { data, error } = await supabaseAdmin.from('coaches').update({ active }).eq('id', id).select().single()
  if (error) throw error
  return data as CoachRow
}
