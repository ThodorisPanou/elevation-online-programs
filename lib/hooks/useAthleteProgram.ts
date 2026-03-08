// lib/hooks/useAthletePrograms.ts

import { useState, useEffect } from 'react'
import { getProgramsByAthleteId } from '@/lib/services/programService'
import { getAthleteById } from '@/lib/services/athleteService'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'
import { AthleteViewModel } from '@/lib/viewModels/AthleteViewModel'

interface UseAthleteProgramsResult {
  programs: ProgramViewModel[]
  athlete:  AthleteViewModel | null
  loading:  boolean
  error:    string | null
  refresh:  () => void
}

export function useAthletePrograms(athleteId: string): UseAthleteProgramsResult {
  const [programs, setPrograms] = useState<ProgramViewModel[]>([])
  const [athlete,  setAthlete]  = useState<AthleteViewModel | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tick,     setTick]     = useState(0)   // increment to trigger a refresh

  useEffect(() => {
    if (!athleteId) return

    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      setError(null)

      try {
        const [athleteData, programsData] = await Promise.all([
          getAthleteById(athleteId),
          getProgramsByAthleteId(athleteId),
        ])

        if (cancelled) return

        setAthlete(athleteData)
        setPrograms(programsData)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [athleteId, tick])

  const refresh = () => setTick(t => t + 1)

  return { programs, athlete, loading, error, refresh }
}
