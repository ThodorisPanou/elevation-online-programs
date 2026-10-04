'use client'

// app/login/linkSignIn.tsx
// "Got a login link from your coach?" — sign in by pasting the link. On iPhone, tapping a link always opens
// Safari, never the installed home-screen app (which keeps its own storage), so an athlete who signed out of
// the app pastes the new link here instead. Open by default inside the installed app.

import { FormEvent, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, TriangleAlert } from 'lucide-react'
import { LinkInvalidError, signInWithLoginLink } from '@/lib/services/athleteAppService'

const TOKEN = /^[A-Za-z0-9_-]{43}$/

/** The token from a pasted login link (".../l/<token>", with or without text around it), or a bare token. */
export function tokenFromLink(input: string): string | null {
  const value = input.trim()
  // Tokens are always 43 characters. Don't require a boundary after it: a single-line field drops the newline of
  // a pasted message, gluing the next words straight onto the link ("…/l/<token>Open it in Safari")
  const fromUrl = value.match(/\/l\/([A-Za-z0-9_-]{43})/)?.[1]
  return fromUrl ?? (TOKEN.test(value) ? value : null)
}

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

const noSubscribe = () => () => {}

export function LinkSignIn() {
  const router = useRouter()
  // The page is prerendered (no window): server says "not installed", the browser corrects it after hydrating
  const installed = useSyncExternalStore(noSubscribe, isInstalledApp, () => false)
  const [opened,  setOpen]    = useState(false)
  const open = opened || installed
  const [value,   setValue]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

  const submit = async (e?: FormEvent, text = value) => {
    e?.preventDefault()
    const token = tokenFromLink(text)
    if (!token) { setError('That doesn’t look like a login link. Copy the whole link your coach sent and paste it here.'); return }

    setBusy(true); setError(null)
    try {
      await signInWithLoginLink(token)
      router.replace('/me')
    } catch (err) {
      setBusy(false)
      setError(err instanceof LinkInvalidError
        ? 'This link has already been used or has expired. Ask your coach for a new one.'
        : 'Couldn’t sign in. Check your connection and try again.')
    }
  }

  // iOS asks for permission to paste; if refused, the field still works with a long-press paste
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setValue(text)
      if (tokenFromLink(text)) submit(undefined, text)
    } catch { /* permission refused */ }
  }

  if (!open) {
    return (
      <button type="button" className="login-link-toggle" onClick={() => setOpen(true)}>
        Got a login link from your coach?
      </button>
    )
  }

  return (
    <form className="login-card login-link-card" onSubmit={submit}>
      <h2 className="login-link-title">Sign in with a login link</h2>
      <p className="login-link-text">
        Ask your coach for a new login link, copy it, and paste it here.
      </p>
      <div className="field">
        <label className="field-label" htmlFor="login-link-input">Login link</label>
        <input
          // Plain text, not type="url": people paste the coach's whole message ("Your training programs: https://…")
          id="login-link-input" className="field-input" type="text" inputMode="url"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="https://…/l/…" value={value} onChange={e => setValue(e.target.value)}
        />
      </div>
      {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}
      <div className="login-link-actions">
        {canPaste && (
          <button type="button" className="btn" onClick={paste} disabled={busy}>
            <ClipboardPaste size={14} aria-hidden /> Paste
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
