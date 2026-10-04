'use client'

// app/me/installHint.tsx
// "Add to Home Screen" guide on the athlete's program list. Installed home-screen apps keep the login (Safari
// itself forgets a site's storage after 7 days without a visit), so athletes should install right after their
// first sign-in — the login is carried into the app at that moment (see lib/supabaseClient.ts).
// iPhone: step-by-step guide (iOS has no install prompt). Android/Chrome: the browser's own install prompt.
// Never shown inside the installed app. Dismissing hides it on this device for a week.

import { useEffect, useState } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import { APP_SHORT_NAME } from '@/lib/brand'

const DISMISS_KEY  = 'glabro.installHint.dismissedAt'
const DISMISS_DAYS = 7

// Chrome's install prompt event (not in TypeScript's DOM types)
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 864e5
  } catch { return false }
}

export function InstallHint() {
  // The athlete app renders only in the browser (after the auth check), so these are safe to read here
  const [isIOS]     = useState(() => /iPhone|iPad|iPod/i.test(navigator.userAgent))
  const [hidden, setHidden] = useState(() => isInstalled() || recentlyDismissed())
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent) }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setHidden(true)
  }

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    if ((await prompt.userChoice).outcome === 'accepted') setHidden(true)
    setPrompt(null)
  }

  // Android etc.: only when the browser offers installing; iPhone: always (no prompt exists there)
  if (hidden || (!isIOS && !prompt)) return null

  return (
    <aside className="install" aria-labelledby="install-title">
      <button className="install-close" onClick={dismiss} aria-label="Hide for now">
        <X size={18} aria-hidden />
      </button>
      <h2 id="install-title" className="install-title">Add {APP_SHORT_NAME} to your Home Screen</h2>
      <p className="install-text">
        Open your programs from the app icon and you’ll stay logged in.
      </p>

      {isIOS ? (
        <ol className="install-steps">
          <li>
            Tap <span className="install-key"><Share size={16} aria-hidden /> Share</span> in Safari’s toolbar
            {' '}(at the bottom, or behind <span className="install-key">⋯</span>).
          </li>
          <li>
            Choose <span className="install-key"><SquarePlus size={16} aria-hidden /> Add to Home Screen</span>, then
            {' '}<span className="install-key">Add</span>.
          </li>
          <li>Open <strong className="me-strong">{APP_SHORT_NAME}</strong> from your Home Screen from now on.</li>
        </ol>
      ) : (
        <button className="me-button install-button" onClick={install}>Install app</button>
      )}
    </aside>
  )
}
