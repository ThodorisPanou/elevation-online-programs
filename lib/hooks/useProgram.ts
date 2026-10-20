// lib/hooks/useProgram.ts

import { useState, useEffect } from 'react'
import { getProgramByToken, getProgramById } from '@/lib/services/programService'
import { supabase } from '@/lib/supabaseClient'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'

interface UseProgramResult {
  program:      ProgramViewModel | null
  loading:      boolean
  notFound:     boolean
  activeDay:    number
  setActiveDay: (index: number) => void
}

// Accepts either a public_token or a program id — tries the token first, falls back to the id.
// The id fallback only works when signed in (RLS: your own programs, or any for the admin).
// Outside its dates the share link only says "unavailable" (no days): then the program's coach / the admin still
// gets the whole program by id; everyone else keeps the "unavailable" answer.
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

      // Fall back to id — also for a closed share link, where the coach still sees everything. Signed-out visitors
      // can't read the tables, so don't ask for them
      if (!data || data.unavailable) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) data = (await getProgramById(data?.id ?? guid)) ?? data
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
