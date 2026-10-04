'use client'

// app/me/layout.tsx
// Guards the athlete app: signed in as an athlete whose login is enabled. Coaches/admins go to /admin,
// anyone else to /login. Pages render only after this check and read the athlete with useAthleteMe().
// (UI guard only — the get_my_*() database functions are what actually limit athletes to their own data.)

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getMe } from '@/lib/services/coachService'
import { MyAthlete, getMyAthlete } from '@/lib/services/athleteAppService'
import { AthleteMeContext } from '@/lib/hooks/useAthleteMe'
import { LogShell } from '@/components/programView'
import './me.css'

type Resolved = { athlete: MyAthlete; hasPassword: boolean } | { goTo: string } | { signOut: true } | { error: string }

async function resolveAthlete(): Promise<Resolved> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { goTo: '/login' }

  try {
    const me = await getMe()
    if (me.isAdmin || me.coach) return { goTo: '/admin/athletes' }
    if (!me.athlete || me.athlete.login_disabled) return { signOut: true }

    const athlete = await getMyAthlete()
    return athlete ? { athlete, hasPassword: me.athlete.has_password } : { signOut: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not load your account' }
  }
}

export default function MeLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [athlete,     setAthlete]     = useState<MyAthlete | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const signOut = useCallback(async (reason?: string) => {
    await supabase.auth.signOut()
    router.replace(reason ? `/login?reason=${reason}` : '/login')
  }, [router])

  const load = useCallback(
    () => resolveAthlete().then(result => {
      if ('athlete' in result)    { setAthlete(result.athlete); setHasPassword(result.hasPassword) }
      else if ('goTo' in result)  router.replace(result.goTo)
      else if ('error' in result) setError(result.error)
      else                        signOut('no-access')
    }),
    [router, signOut],
  )

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [load, router])

  const value = useMemo(() => athlete && {
    athlete,
    hasPassword,
    markPasswordSet: () => setHasPassword(true),
    signOut:         () => signOut(),
  }, [athlete, hasPassword, signOut])

  if (error) {
    return (
      <LogShell>
        <h1 className="log-athlete">Something went wrong</h1>
        <p className="log-brief">We couldn’t load your programs. Check your connection and try again.</p>
        <button className="me-button" onClick={() => { setError(null); load() }}>Try again</button>
      </LogShell>
    )
  }
  if (!value) {
    return (
      <LogShell busy>
        <div className="log-loading" role="status">
          <span className="sr-only">Loading</span>
          <div className="log-loading-bar is-title" />
          <div className="log-loading-bar is-sub" />
          {[0, 1].map(i => <div key={i} className="log-loading-bar is-row" />)}
        </div>
      </LogShell>
    )
  }

  return <AthleteMeContext.Provider value={value}>{children}</AthleteMeContext.Provider>
}
