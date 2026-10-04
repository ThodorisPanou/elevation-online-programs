// lib/services/athleteAppService.ts
// The athlete app (/me, /l/[token]). Athletes have no direct table access: everything comes from the
// get_my_*() database functions (migration C), which only return the signed-in athlete's own data.

import { supabase } from '@/lib/supabaseClient'
import { ProgramViewModel, mapToProgramViewModel } from '@/lib/viewModels/ProgramViewModel'

export interface MyAthlete {
  id:         string
  name:       string
  surname:    string
  avatar_url: string | null
  username:   string | null
  coach_name: string | null
}

export interface MyProgramSummary {
  id:          string
  title:       string
  description: string | null
  created_at:  string
  day_count:   number
}

export async function getMyAthlete(): Promise<MyAthlete | null> {
  const { data, error } = await supabase.rpc('get_my_athlete')
  if (error) { console.error('getMyAthlete:', error); throw error }
  return data as MyAthlete | null
}

/** Newest first. */
export async function getMyPrograms(): Promise<MyProgramSummary[]> {
  const { data, error } = await supabase.rpc('get_my_programs')
  if (error) { console.error('getMyPrograms:', error); throw error }
  return (data ?? []) as MyProgramSummary[]
}

/** null when the program doesn't exist or isn't this athlete's. */
export async function getMyProgram(id: string): Promise<ProgramViewModel | null> {
  const { data, error } = await supabase.rpc('get_my_program', { p_program_id: id })
  if (error) {
    if (error.code === '22P02') return null   // not a uuid
    console.error('getMyProgram:', error); throw error
  }
  return data ? mapToProgramViewModel(data) : null
}

export class LinkInvalidError extends Error {}

/**
 * Signs in with a one-time login link: the server uses up our token and returns a Supabase magic-link token
 * hash, which becomes a session here. Throws LinkInvalidError for a used / expired / revoked link.
 */
export async function signInWithLoginLink(token: string): Promise<void> {
  const res  = await fetch('/api/login-link/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 410) throw new LinkInvalidError(json.error ?? 'This link is no longer valid')
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)

  // Whoever was signed in on this device before (e.g. a coach testing the link) is replaced
  await supabase.auth.signOut({ scope: 'local' })
  const { error } = await supabase.auth.verifyOtp({ token_hash: json.tokenHash, type: 'magiclink' })
  if (error) throw error
}
