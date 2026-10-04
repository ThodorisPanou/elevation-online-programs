'use client'

// app/me/meNav.tsx
// Top-right links of the athlete app: back to the program list (on inner pages), password, sign out.
// Signing out asks first: athletes without a password need a new link from their coach to get back in.

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, KeyRound, LogOut } from 'lucide-react'
import Modal from '@/components/modal'
import { useAthleteMe } from '@/lib/hooks/useAthleteMe'

export function MeNav({ back = false }: { back?: boolean }) {
  const { athlete, hasPassword, signOut } = useAthleteMe()
  const [confirming, setConfirming] = useState(false)
  const [leaving,    setLeaving]    = useState(false)

  if (back) {
    return (
      <Link href="/me" className="me-nav-link">
        <ArrowLeft size={16} aria-hidden /> All programs
      </Link>
    )
  }

  const leave = async () => { setLeaving(true); await signOut() }

  return (
    <>
      <Link href="/me/password" className="me-nav-link" aria-label="Password">
        <KeyRound size={16} aria-hidden /><span className="me-nav-label">Password</span>
      </Link>
      <button className="me-nav-link" onClick={() => setConfirming(true)} aria-label="Sign out">
        <LogOut size={16} aria-hidden /><span className="me-nav-label">Sign out</span>
      </button>

      {confirming && (
        <Modal
          onClose={() => !leaving && setConfirming(false)}
          title="Sign out?"
          className="me-dialog"
          overlayClassName="me-dialog-overlay"
        >
          <h2 className="me-dialog-title">Sign out?</h2>
          {hasPassword ? (
            <p className="me-dialog-text">
              To get back in, sign in with your username
              {athlete.username && <> <strong className="me-strong">{athlete.username}</strong></>} and your password.
            </p>
          ) : (
            <p className="me-dialog-text">
              You haven’t set a password, so you’ll need <strong className="me-strong">a new login link from your
              coach</strong> to get back in.
            </p>
          )}
          <div className="me-dialog-actions">
            {!hasPassword && (
              <Link href="/me/password" className="me-button" onClick={() => setConfirming(false)} data-autofocus>
                Set a password first
              </Link>
            )}
            <button className={hasPassword ? 'me-button' : 'me-button is-quiet'} onClick={leave} disabled={leaving}
                    data-autofocus={hasPassword || undefined}>
              {leaving ? 'Signing out…' : 'Sign out'}
            </button>
            <button className="me-text-button" onClick={() => setConfirming(false)} disabled={leaving}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  )
}
