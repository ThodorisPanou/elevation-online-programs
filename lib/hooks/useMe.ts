'use client'

// lib/hooks/useMe.ts
// The signed-in user (admin and/or coach), provided by app/admin/layout.tsx to every admin page.

import { createContext, useContext } from 'react'
import type { Me } from '@/lib/services/coachService'

export interface MeState {
  me:      Me
  refresh: () => Promise<void>   // re-read roles, e.g. after changing the password
  signOut: () => Promise<void>
}

export const MeContext = createContext<MeState | null>(null)

export function useMe(): MeState {
  const value = useContext(MeContext)
  if (!value) throw new Error('useMe() must be used inside app/admin (AdminLayout)')
  return value
}
