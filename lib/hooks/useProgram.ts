// lib/hooks/useProgram.ts

import { useState, useEffect } from 'react'
import { getProgramByToken, getProgramById } from '@/lib/services/programService'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'

interface UseProgramResult {
  program:      ProgramViewModel | null
  loading:      boolean
  notFound:     boolean
  activeDay:    number
  setActiveDay: (index: number) => void
}

// Accepts either a public_token or a program id —
// tries token first, falls back to id (same logic as the page had inline)
export function useProgram(guid: string): UseProgramResult {
  const [program,   setProgram]   = useState<ProgramViewModel | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [activeDay, setActiveDay] = useState(0)

  useEffect(() => {
    if (!guid) return

    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      setNotFound(false)

      // Try public_token first
      let data = await getProgramByToken(guid)

      // Fall back to id
      if (!data) {
        data = await getProgramById(guid)
      }

      if (cancelled) return

      if (!data) {
        setNotFound(true)
      } else {
        setProgram(data)
        setActiveDay(0)
      }

      setLoading(false)
    }

    fetch()

    return () => { cancelled = true }
  }, [guid])

  return { program, loading, notFound, activeDay, setActiveDay }
}
