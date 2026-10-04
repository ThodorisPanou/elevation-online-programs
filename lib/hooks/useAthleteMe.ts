'use client'

// lib/hooks/useAthleteMe.ts
// The signed-in athlete, provided by app/me/layout.tsx to every athlete page.

import { createContext, useContext } from 'react'
import type { MyAthlete } from '@/lib/services/athleteAppService'

export interface AthleteMeState {
  athlete:         MyAthlete
  hasPassword:     boolean      // false until they set one (they start with login links only)
  markPasswordSet: () => void
  signOut:         () => Promise<void>
}

export const AthleteMeContext = createContext<AthleteMeState | null>(null)

export function useAthleteMe(): AthleteMeState {
  const value = useContext(AthleteMeContext)
  if (!value) throw new Error('useAthleteMe() must be used inside app/me (MeLayout)')
  return value
}
