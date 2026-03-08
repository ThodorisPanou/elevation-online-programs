// lib/hooks/useExercises.ts

import { useState, useEffect } from 'react'
import { getExerciseCatalogue } from '@/lib/services/exerciseService'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'

interface UseExercisesResult {
  catalogue: ExerciseCatalogueItem[]
  loading:   boolean
}

// Fetches the exercise catalogue once on mount.
// Used by NewProgramPage and EditProgramPage for the datalist / search input.
export function useExercises(): UseExercisesResult {
  const [catalogue, setCatalogue] = useState<ExerciseCatalogueItem[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    getExerciseCatalogue().then(data => {
      if (!cancelled) {
        setCatalogue(data)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [])

  return { catalogue, loading }
}
