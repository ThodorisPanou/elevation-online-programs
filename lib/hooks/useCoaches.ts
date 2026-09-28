'use client'

// lib/hooks/useCoaches.ts
// The coach list, for the admin's coach filters / pickers. Coaches get an empty list (they only ever
// see their own data, so there's nothing to choose).

import { useEffect, useState } from 'react'
import { useMe } from '@/lib/hooks/useMe'
import { Coach, getCoaches } from '@/lib/services/coachService'

export function useCoaches() {
  const { me } = useMe()
  const [coaches, setCoaches] = useState<Coach[]>([])

  useEffect(() => {
    if (!me.isAdmin) return
    let cancelled = false
    getCoaches()
      .then(list => { if (!cancelled) setCoaches(list) })
      .catch(e => console.error('useCoaches:', e))
    return () => { cancelled = true }
  }, [me.isAdmin])

  const coachName = (id: string | null) => coaches.find(c => c.id === id)?.name ?? (id ? '' : 'No coach')

  return { coaches, coachName, isAdmin: me.isAdmin }
}
