// lib/server/athletes.ts
// Athlete logins (coach of that athlete or admin — callers must check requireCoach first, the functions here
// check that the caller manages the athlete). An athlete login = an auth user `<username>@login.invalid`
// (created without a password on the first login link) + athletes.user_id / username / login_disabled,
// which only the service role may write (migration C guard trigger).
//
// Login links are our own one-time tokens (random 32 bytes, SHA-256 stored, 7 days, a new link revokes older
// ones), exchanged just in time for a Supabase magic-link token on redeem — Supabase's own tokens expire in
// ≤ 24 h, too short for a link sent over Instagram.

import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/server/supabaseAdmin'
import { CoachError } from '@/lib/server/coaches'
import type { Caller } from '@/lib/server/auth'
import { USERNAME_PATTERN, USERNAME_HINT, normalizeUsername, toLoginEmail } from '@/lib/logins'

// "Banned" in Supabase Auth = can't sign in or refresh a session. ~100 years ≈ until re-enabled.
const BAN_FOREVER  = '876000h'
const LINK_DAYS    = 7
const AVATAR_BUCKET = 'AtheletesImages'

// Same message for every bad link, so a guesser learns nothing
const LINK_INVALID = 'This link is no longer valid. Ask your coach for a new one.'

export interface AthleteLoginRow {
  id:             string
  coach_id:       string
  name:           string
  surname:        string
  avatar_url:     string | null
  user_id:        string | null
  username:       string | null
  login_disabled: boolean
}

/** What the coach UI shows about an athlete's login. */
export interface LoginStatus {
  username:     string | null
  hasAccount:   boolean          // the auth user exists (created by the first login link)
  disabled:     boolean
  lastSignInAt: string | null
  link:         { expiresAt: string } | null   // the current unused, unexpired link, if any
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex')

function checkUsername(input: unknown): string {
  const username = normalizeUsername(String(input ?? ''))
  if (!USERNAME_PATTERN.test(username)) throw new CoachError(`Invalid username — ${USERNAME_HINT}`)
  return username
}

/** The athlete, if the caller may manage it. Not found and not yours look the same (404). */
async function getManagedAthlete(caller: Caller, id: string): Promise<AthleteLoginRow> {
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('id, coach_id, name, surname, avatar_url, user_id, username, login_disabled')
    .eq('id', id)
    .maybeSingle()
  if (error && error.code !== '22P02') throw error   // 22P02: not a uuid → just "not found"

  const athlete = data as AthleteLoginRow | null
  if (!athlete || !(caller.isAdmin || athlete.coach_id === caller.coach?.id)) {
    throw new CoachError('Athlete not found', 404)
  }
  return athlete
}

async function usernameTaken(username: string, exceptAthleteId: string): Promise<boolean> {
  const [coaches, athletes] = await Promise.all([
    supabaseAdmin.from('coaches').select('id').eq('username', username),
    supabaseAdmin.from('athletes').select('id').eq('username', username).neq('id', exceptAthleteId),
  ])
  if (coaches.error)  throw coaches.error
  if (athletes.error) throw athletes.error
  return (coaches.data ?? []).length + (athletes.data ?? []).length > 0
}

async function revokeOpenLinks(athleteId: string) {
  const { error } = await supabaseAdmin
    .from('athlete_login_links').delete().eq('athlete_id', athleteId).is('used_at', null)
  if (error) throw error
}

// ─── Status ───────────────────────────────────────────────────────────────

export async function getLoginStatus(caller: Caller, id: string): Promise<LoginStatus> {
  const athlete = await getManagedAthlete(caller, id)

  const [link, user] = await Promise.all([
    supabaseAdmin
      .from('athlete_login_links')
      .select('expires_at')
      .eq('athlete_id', id).is('used_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    athlete.user_id ? supabaseAdmin.auth.admin.getUserById(athlete.user_id) : null,
  ])
  if (link.error) throw link.error
  if (user?.error) throw user.error

  return {
    username:     athlete.username,
    hasAccount:   !!athlete.user_id,
    disabled:     athlete.login_disabled,
    lastSignInAt: user?.data.user?.last_sign_in_at ?? null,
    link:         link.data ? { expiresAt: link.data.expires_at } : null,
  }
}

// ─── Username ─────────────────────────────────────────────────────────────

/** Set or change the username. Once the athlete has an account, its login email follows. */
export async function setAthleteUsername(caller: Caller, id: string, input: unknown): Promise<LoginStatus> {
  const athlete  = await getManagedAthlete(caller, id)
  const username = checkUsername(input)
  if (username === athlete.username) return getLoginStatus(caller, id)

  if (await usernameTaken(username, id)) throw new CoachError('Username already taken', 409)

  if (athlete.user_id) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(athlete.user_id, {
      email: toLoginEmail(username), email_confirm: true,
    })
    if (error) {
      if (error.code === 'email_exists') throw new CoachError('Username already taken', 409)
      throw error
    }
  }

  const { error } = await supabaseAdmin.from('athletes').update({ username }).eq('id', id)
  if (error) {
    // Keep the login and the athletes row in sync
    if (athlete.user_id && athlete.username) {
      await supabaseAdmin.auth.admin.updateUserById(athlete.user_id, {
        email: toLoginEmail(athlete.username), email_confirm: true,
      })
    }
    if (error.code === '23505') throw new CoachError('Username already taken', 409)
    throw error
  }
  return getLoginStatus(caller, id)
}

// ─── Login link ───────────────────────────────────────────────────────────

/** A fresh 7-day login link; any older unused link stops working. Creates the auth user on first use. */
export async function createLoginLink(caller: Caller, id: string, origin: string) {
  const athlete = await getManagedAthlete(caller, id)
  if (!athlete.username)      throw new CoachError('Set a username for this athlete first')
  if (athlete.login_disabled) throw new CoachError('Login is disabled for this athlete — enable it first', 409)

  if (!athlete.user_id) {
    // No password: the athlete signs in through links until they choose to set one
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:         toLoginEmail(athlete.username),
      email_confirm: true,
      user_metadata: { name: `${athlete.name} ${athlete.surname}`.trim() },
    })
    if (authError) {
      if (authError.code === 'email_exists') throw new CoachError('Username already taken', 409)
      throw authError
    }
    const { error } = await supabaseAdmin.from('athletes').update({ user_id: created.user.id }).eq('id', id)
    if (error) {
      // Don't leave an auth user without an athlete behind
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      throw error
    }
  }

  await revokeOpenLinks(id)

  const token     = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin.from('athlete_login_links').insert({
    athlete_id: id, token_hash: sha256(token), expires_at: expiresAt, created_by: caller.user.id,
  })
  if (error) throw error

  return { url: `${origin}/l/${token}`, expiresAt }
}

/**
 * Public. Uses up a login link and returns a Supabase magic-link token hash, which the browser turns into a
 * session with `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. No email is sent.
 */
export async function redeemLoginLink(token: unknown): Promise<{ tokenHash: string }> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CoachError(LINK_INVALID, 410)

  const { data: link, error } = await supabaseAdmin
    .from('athlete_login_links')
    .select('id, expires_at, used_at, athletes ( user_id, username, login_disabled )')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  if (error) throw error

  const athlete = link?.athletes as unknown as Pick<AthleteLoginRow, 'user_id' | 'username' | 'login_disabled'> | null
  if (!link || link.used_at || new Date(link.expires_at) <= new Date()
      || !athlete?.user_id || !athlete.username || athlete.login_disabled) {
    throw new CoachError(LINK_INVALID, 410)
  }

  // Claim it first, so two simultaneous redeems can't both succeed
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('athlete_login_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id).is('used_at', null)
    .select('id')
  if (claimError) throw claimError
  if (!claimed?.length) throw new CoachError(LINK_INVALID, 410)

  const { data: generated, error: genError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink', email: toLoginEmail(athlete.username),
  })
  if (genError || !generated.properties?.hashed_token) {
    // Our failure, not the athlete's: give the link back
    await supabaseAdmin.from('athlete_login_links').update({ used_at: null }).eq('id', link.id)
    throw genError ?? new Error('generateLink returned no token')
  }

  return { tokenHash: generated.properties.hashed_token }
}

// ─── Disable / enable ─────────────────────────────────────────────────────

/**
 * Disabled athletes can't sign in (auth ban), open links are revoked, and they lose data access right away
 * (`my_athlete_id()` ignores disabled logins, so even a still-valid access token sees nothing).
 */
export async function setAthleteLoginDisabled(caller: Caller, id: string, disabled: boolean): Promise<LoginStatus> {
  const athlete = await getManagedAthlete(caller, id)

  if (athlete.user_id) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(athlete.user_id, {
      ban_duration: disabled ? BAN_FOREVER : 'none',
    })
    if (error) throw error
  }
  if (disabled) await revokeOpenLinks(id)

  const { error } = await supabaseAdmin.from('athletes').update({ login_disabled: disabled }).eq('id', id)
  if (error) throw error
  return getLoginStatus(caller, id)
}

// ─── Delete ───────────────────────────────────────────────────────────────

// Storage path from a public URL: …/object/public/AtheletesImages/<path>
function avatarPath(url: string | null): string | null {
  const marker = `/object/public/${AVATAR_BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split('?')[0]) : null
}

/** The athlete and, by FK cascade in one statement, their programs and login links; then auth user and photo. */
export async function deleteAthleteFully(caller: Caller, id: string) {
  const athlete = await getManagedAthlete(caller, id)

  const { error } = await supabaseAdmin.from('athletes').delete().eq('id', id)
  if (error) throw error

  // After the rows are gone: a leftover login or photo is harmless, a half-deleted athlete is not
  if (athlete.user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(athlete.user_id)
    if (authError) console.error('deleteAthleteFully: auth user not deleted', athlete.user_id, authError)
  }
  const path = avatarPath(athlete.avatar_url)
  if (path) {
    const { error: fileError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([path])
    if (fileError) console.error('deleteAthleteFully: photo not deleted', path, fileError)
  }
}
