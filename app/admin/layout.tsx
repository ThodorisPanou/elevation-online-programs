'use client'

// app/admin/layout.tsx
// Guards every /admin page: signed in, and either an admin or an active coach. A coach with a temporary
// password is kept on /admin/password until it's changed. Pages render only after this check and read
// the user with useMe(). Stays mounted across /admin navigations, so roles are fetched once.
// (UI guard only — the database's RLS and the API routes are what actually enforce access.)

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ApiError } from '@/lib/services/apiClient'
import { getMe, Me } from '@/lib/services/coachService'
import { MeContext } from '@/lib/hooks/useMe'
import { Loader } from '@/components/pageStatus'

const PASSWORD_PAGE = '/admin/password'

type Resolved = { me: Me } | { error: string } | { signOut: 'no-session' | 'no-access' }

async function resolveMe(): Promise<Resolved> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { signOut: 'no-session' }

  try {
    const me = await getMe()
    // Signed in, but neither admin nor active coach (e.g. deactivated) → out
    if (!me.isAdmin && !me.coach?.active) return { signOut: 'no-access' }
    return { me }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { signOut: 'no-session' }
    return { error: e instanceof Error ? e.message : 'Could not load your account' }
  }
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [me,    setMe]    = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signOut = useCallback(async (reason?: string) => {
    await supabase.auth.signOut()
    setMe(null)
    router.replace(reason ? `/login?reason=${reason}` : '/login')
  }, [router])

  const load = useCallback(
    () => resolveMe().then(result => {
      if ('me' in result)         setMe(result.me)
      else if ('error' in result) setError(result.error)
      else                        signOut(result.signOut === 'no-access' ? 'no-access' : undefined)
    }),
    [signOut],
  )

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setMe(null); router.replace('/login') }
    })
    return () => subscription.unsubscribe()
  }, [load, router])

  const mustChangePassword = !!me?.coach?.must_change_password
  const onPasswordPage     = pathname === PASSWORD_PAGE

  useEffect(() => {
    if (mustChangePassword && !onPasswordPage) router.replace(PASSWORD_PAGE)
  }, [mustChangePassword, onPasswordPage, router])

  const value = useMemo(() => me && { me, refresh: load, signOut: () => signOut() }, [me, load, signOut])

  if (error) {
    return (
      <div className="page login-page">
        <div className="alert-error" role="alert">
          <TriangleAlert size={14} aria-hidden /> {error}
          {' '}<button className="btn" onClick={() => { setError(null); load() }}>Retry</button>
        </div>
      </div>
    )
  }
  if (!value || (mustChangePassword && !onPasswordPage)) return <Loader />

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}
