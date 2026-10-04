'use client'

// app/me/passwordCard.tsx
// Nudge on the athlete's program list until they set a password: athletes start with login links only, so
// without a password, signing out means asking the coach for a new link. Dismissing hides it for a week.

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useAthleteMe } from '@/lib/hooks/useAthleteMe'

const DISMISS_KEY  = 'glabro.passwordCard.dismissedAt'
const DISMISS_DAYS = 7

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 864e5
  } catch { return false }
}

export function PasswordCard() {
  const { hasPassword } = useAthleteMe()
  // The athlete app renders only in the browser (after the auth check), so localStorage is safe to read here
  const [hidden, setHidden] = useState(recentlyDismissed)

  if (hasPassword || hidden) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setHidden(true)
  }

  return (
    <aside className="install" aria-labelledby="password-card-title">
      <button className="install-close" onClick={dismiss} aria-label="Hide for now">
        <X size={18} aria-hidden />
      </button>
      <h2 id="password-card-title" className="install-title">Set a password</h2>
      <p className="install-text">
        So you can always sign back in — after signing out, or on another phone — without asking your coach
        for a new link.
      </p>
      <Link href="/me/password" className="me-button install-button">Set a password</Link>
    </aside>
  )
}
