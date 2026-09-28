// lib/hooks/useExercises.ts

import { useState, useEffect } from 'react'
import { getExerciseCatalogue } from '@/lib/services/exerciseService'
import { getAthleteById } from '@/lib/services/athleteService'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'

interface UseExercisesResult {
  catalogue: ExerciseCatalogueItem[]
  loading:   boolean
}

// Fetches the exercise catalogue of the athlete's coach once on mount — a program may only use its own
// coach's exercises (the admin can read every coach's, so the list must be scoped here).
// Used by NewProgramPage and EditProgramPage for the exercise picker.
export function useExercises(athleteId: string): UseExercisesResult {
  const [catalogue, setCatalogue] = useState<ExerciseCatalogueItem[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    getAthleteById(athleteId)
      .then(athlete => getExerciseCatalogue(athlete?.coachId ?? null))
      .then(data => {
        if (!cancelled) {
          setCatalogue(data)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [athleteId])

  return { catalogue, loading }
}
