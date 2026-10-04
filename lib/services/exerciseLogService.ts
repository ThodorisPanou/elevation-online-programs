// lib/services/exerciseLogService.ts
// An athlete's exercise records, as their coach / the admin sees them. Read-only: RLS (migration D) lets coaches
// read their own athletes' records and nothing else; only the athlete writes them (athleteAppService).

import { supabase } from '@/lib/supabaseClient'

export interface AthleteExerciseLog {
  id:            string
  exercise_id:   string
  exercise_name: string
  performed_on:  string   // YYYY-MM-DD
  reps:          number
  kg:            number
  note:          string | null
  created_at:    string
}

/**
 * Whether the signed-in user may see this athlete's records: their coach or the admin. RLS returns the athlete row
 * only to them (athletes have no table access; nobody signed in → no session, not even asked).
 */
export async function canViewAthleteRecords(athleteId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data, error } = await supabase.from('athletes').select('id').eq('id', athleteId).maybeSingle()
  if (error) { console.error('canViewAthleteRecords:', error); return false }
  return !!data
}

/** Newest first. */
export async function getAthleteExerciseLogs(athleteId: string): Promise<AthleteExerciseLog[]> {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, exercise_id, performed_on, reps, kg, note, created_at, exercises ( name )')
    .eq('athlete_id', athleteId)
    .order('performed_on', { ascending: false })
    .order('created_at',   { ascending: false })
  if (error) { console.error('getAthleteExerciseLogs:', error); throw error }

  return (data ?? []).map(l => ({
    id:            l.id,
    exercise_id:   l.exercise_id,
    // Supabase types a to-one join as an array
    exercise_name: (l.exercises as unknown as { name: string } | null)?.name ?? 'Exercise',
    performed_on:  l.performed_on,
    reps:          l.reps,
    kg:            Number(l.kg),
    note:          l.note,
    created_at:    l.created_at,
  }))
}
