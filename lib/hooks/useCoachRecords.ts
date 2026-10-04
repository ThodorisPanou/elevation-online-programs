// lib/hooks/useCoachRecords.ts
// The athlete's records on the program view (/program/[token]) — only for their coach or the admin, read-only.
// Anyone else (nobody signed in, an athlete, another coach) gets null and the page shows no records at all.

import { useEffect, useState } from 'react'
import { AthleteExerciseLog, canViewAthleteRecords, getAthleteExerciseLogs } from '@/lib/services/exerciseLogService'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'

export function useCoachRecords(program: ProgramViewModel | null): AthleteExerciseLog[] | null {
  const [logs, setLogs] = useState<AthleteExerciseLog[] | null>(null)
  const athleteId = program?.athlete?.id

  useEffect(() => {
    if (!athleteId) return
    let cancelled = false
    ;(async () => {
      if (!(await canViewAthleteRecords(athleteId)) || cancelled) return
      const l = await getAthleteExerciseLogs(athleteId)
      if (!cancelled) setLogs(l)
    })().catch(() => {})   // records are extra here: the program still shows without them
    return () => { cancelled = true }
  }, [athleteId])

  return logs
}
