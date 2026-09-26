// lib/services/analyticsService.ts

import { supabase } from '@/lib/supabaseClient'
import { AnalyticsViewModel, mapToAnalyticsViewModel } from '@/lib/viewModels/AnalyticsViewModel'

// Loads everything the analytics page needs in three parallel queries and
// aggregates client-side — fine for a single coach's data volume.
export async function getAnalytics(): Promise<AnalyticsViewModel> {
  const [programs, athletes, exercises] = await Promise.all([
    supabase
      .from('programs')
      .select(`
        id, title, created_at, athlete_id,
        athletes ( name, surname ),
        program_days ( id, blocks ( block_exercises ( exercise_id ) ) )
      `),
    supabase.from('athletes').select('id, name, surname, avatar_url, created_at'),
    supabase.from('exercises').select('id, name, video_url'),
  ])

  const error = programs.error ?? athletes.error ?? exercises.error
  if (error) { console.error('getAnalytics:', error); throw error }

  return mapToAnalyticsViewModel(programs.data ?? [], athletes.data ?? [], exercises.data ?? [])
}
