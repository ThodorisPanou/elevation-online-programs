'use client'

// app/me/meNav.tsx
// Top-right links of the athlete app: back to the program list (on inner pages), password, sign out.

import Link from 'next/link'
import { ArrowLeft, KeyRound, LogOut } from 'lucide-react'
import { useAthleteMe } from '@/lib/hooks/useAthleteMe'

export function MeNav({ back = false }: { back?: boolean }) {
  const { signOut } = useAthleteMe()

  if (back) {
    return (
      <Link href="/me" className="me-nav-link">
        <ArrowLeft size={16} aria-hidden /> All programs
      </Link>
    )
  }
  return (
    <>
      <Link href="/me/password" className="me-nav-link" aria-label="Password">
        <KeyRound size={16} aria-hidden /><span className="me-nav-label">Password</span>
      </Link>
      <button className="me-nav-link" onClick={signOut} aria-label="Sign out">
        <LogOut size={16} aria-hidden /><span className="me-nav-label">Sign out</span>
      </button>
    </>
  )
}
