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

// ─── Exercise records ─────────────────────────────────────────────────────
// The athlete's best set on a tracked exercise (migration D). History belongs to the exercise, across programs.

export interface ExerciseLog {
  id:                string
  exercise_id:       string
  block_exercise_id: string | null
  performed_on:      string   // YYYY-MM-DD
  reps:              number
  kg:                number
  note:              string | null
  created_at:        string
}

export interface ExerciseLogInput {
  performed_on: string
  reps:         number
  kg:           number
  note?:        string
}

// Messages the athlete can act on. Only a real failure says "check your connection": retrying the other cases
// can never work (e.g. the coach unticked Track while the program was open).
function logError(where: string, error: { code?: string; message: string }): Error {
  switch (error.code) {
    case '23514': return new Error(error.message)   // bad value — the database's message is written for the athlete
    case '42501': return new Error('This exercise can’t be logged any more: your coach may have changed the program. Reload it and try again.')
    case 'P0002': return new Error('This record was already removed. Reload to see your latest records.')
  }
  console.error(`${where}:`, error)
  return new Error('Couldn’t save. Check your connection and try again.')
}

/** Own records of these exercises, newest first. */
export async function getMyExerciseLogs(exerciseIds: string[]): Promise<ExerciseLog[]> {
  if (exerciseIds.length === 0) return []
  const { data, error } = await supabase.rpc('get_my_exercise_logs', { p_exercise_ids: exerciseIds })
  if (error) { console.error('getMyExerciseLogs:', error); throw error }
  return (data ?? []) as ExerciseLog[]
}

/** All own records with the exercise's name, newest first — the progress list on /me. */
export async function getMyExerciseHistory(): Promise<(ExerciseLog & { exercise_name: string })[]> {
  const { data, error } = await supabase.rpc('get_my_exercise_history')
  if (error) { console.error('getMyExerciseHistory:', error); throw error }
  return (data ?? []) as (ExerciseLog & { exercise_name: string })[]
}

export async function logExercise(blockExerciseId: string, input: ExerciseLogInput): Promise<ExerciseLog> {
  const { data, error } = await supabase.rpc('log_exercise', {
    p_block_exercise_id: blockExerciseId, p_performed_on: input.performed_on,
    p_reps: input.reps, p_kg: input.kg, p_note: input.note ?? null,
  })
  if (error) throw logError('logExercise', error)
  return data as ExerciseLog
}

export async function updateMyExerciseLog(id: string, input: ExerciseLogInput): Promise<ExerciseLog> {
  const { data, error } = await supabase.rpc('update_my_exercise_log', {
    p_id: id, p_performed_on: input.performed_on, p_reps: input.reps, p_kg: input.kg, p_note: input.note ?? null,
  })
  if (error) throw logError('updateMyExerciseLog', error)
  return data as ExerciseLog
}

export async function deleteMyExerciseLog(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_my_exercise_log', { p_id: id })
  if (error) throw logError('deleteMyExerciseLog', error)
}
