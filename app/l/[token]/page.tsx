'use client'

// app/l/[token]/page.tsx
// A coach's one-time login link. Opened in a real browser → "Sign in" button → session → /me.
// Opened inside Instagram/Facebook/TikTok's in-app browser → don't use the link up there: that browser keeps
// its own storage (the login wouldn't stick, and the link only works once), so explain how to open it in
// Safari/Chrome instead.

import { useRef, useState, useSyncExternalStore } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { LogShell } from '@/components/programView'
import { LinkInvalidError, signInWithLoginLink } from '@/lib/services/athleteAppService'
import { copyText } from '@/lib/clipboard'
import '@/app/me/me.css'

const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|musical_ly|BytedanceWebview|Snapchat/i

// Never sign in on page load: chat apps (Instagram, Messenger…) scan links sent in messages with a browser that
// runs JavaScript, and an automatic sign-in would use up the one-time link before the athlete taps it.
// A real person taps "Sign in"; scanners don't.
type State = 'ready' | 'signing-in' | 'invalid' | 'error'

// The page is server-rendered (no navigator): render nothing browser-specific until hydrated
const noSubscribe = () => () => {}
const userAgent   = () => navigator.userAgent

export default function LoginLinkPage() {
  const router  = useRouter()
  const token   = useParams()?.token as string
  const started = useRef(false)   // a double tap must not redeem twice

  const ua     = useSyncExternalStore(noSubscribe, userAgent, () => null)
  const inApp  = ua !== null && IN_APP_BROWSER.test(ua)
  const isIOS  = ua === null || /iPhone|iPad|iPod/i.test(ua)

  const [state,      setState]      = useState<State>('ready')
  const [continued,  setContinued]  = useState(false)   // "Continue here anyway" inside an in-app browser
  const [copied,     setCopied]     = useState(false)

  const signIn = async () => {
    if (started.current) return
    started.current = true
    setState('signing-in')
    try {
      await signInWithLoginLink(token)
      router.replace('/me')
    } catch (e) {
      started.current = false
      setState(e instanceof LinkInvalidError ? 'invalid' : 'error')
    }
  }

  const copyLink = async () => {
    if (!(await copyText(window.location.href))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inApp && !continued && state === 'ready') {
    return (
      <LogShell>
        <h1 className="log-athlete">Open this in {isIOS ? 'Safari' : 'Chrome'}</h1>
        <p className="log-brief">
          You’re in an app’s built-in browser, which won’t keep you logged in. Open the link in
          {isIOS ? ' Safari' : ' Chrome'} to sign in to your training programs.
        </p>
        <ol className="me-steps">
          <li>Tap <strong className="me-strong">{isIOS ? '⋯' : '⋮'}</strong> at the top right of the screen.</li>
          <li>Choose <strong className="me-strong">{isIOS ? 'Open in external browser' : 'Open in Chrome'}</strong>.</li>
        </ol>
        <p className="log-brief">Don’t see it? Copy the link and paste it into {isIOS ? 'Safari' : 'Chrome'}.</p>
        <button className="me-button" onClick={copyLink}>
          {copied ? <><Check size={16} aria-hidden /> Link copied</> : <><Copy size={16} aria-hidden /> Copy link</>}
        </button>
        <button className="me-text-button" onClick={() => setContinued(true)}>Continue here anyway</button>
      </LogShell>
    )
  }

  if (state === 'invalid') {
    return (
      <LogShell>
        <h1 className="log-athlete">This link has expired</h1>
        <p className="log-brief">
          Login links work once and only for a few days. Ask your coach for a new one — or, if you’ve set a
          password, sign in with your username.
        </p>
        <Link href="/login" className="me-button">Sign in with password</Link>
      </LogShell>
    )
  }

  if (state === 'error') {
    return (
      <LogShell>
        <h1 className="log-athlete">Something went wrong</h1>
        <p className="log-brief">We couldn’t sign you in. Check your connection and try again.</p>
        <button className="me-button" onClick={signIn}>Try again</button>
      </LogShell>
    )
  }

  if (state === 'signing-in') {
    return (
      <LogShell busy>
        <h1 className="log-athlete">Signing you in…</h1>
        <p className="log-brief" role="status">Just a moment.</p>
      </LogShell>
    )
  }

  return (
    <LogShell>
      <h1 className="log-athlete">Your training programs</h1>
      <p className="log-brief">Your coach sent you a login link. Tap below to sign in on this phone.</p>
      {/* Disabled until hydrated (ua known): a tap on the server-rendered button would do nothing */}
      <button className="me-button" onClick={signIn} disabled={ua === null}>Sign in</button>
    </LogShell>
  )
}
