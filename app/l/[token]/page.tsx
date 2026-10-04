'use client'

// app/l/[token]/page.tsx
// A coach's one-time login link. Opened in a real browser → signs the athlete in and goes to /me.
// Opened inside Instagram/Facebook/TikTok's in-app browser → don't use the link up there: that browser keeps
// its own storage (the login wouldn't stick, and the link only works once), so explain how to open it in
// Safari/Chrome instead.

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { LogShell } from '@/components/programView'
import { LinkInvalidError, signInWithLoginLink } from '@/lib/services/athleteAppService'
import { copyText } from '@/lib/clipboard'
import '@/app/me/me.css'

const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|musical_ly|BytedanceWebview|Snapchat/i

type State = 'checking' | 'in-app' | 'signing-in' | 'invalid' | 'error'

export default function LoginLinkPage() {
  const router  = useRouter()
  const token   = useParams()?.token as string
  const started = useRef(false)   // dev StrictMode runs effects twice; a link must only be redeemed once

  const [state,  setState]  = useState<State>('checking')
  const [copied, setCopied] = useState(false)
  const [isIOS,  setIsIOS]  = useState(true)

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

  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPhone|iPad|iPod/i.test(ua))
    if (IN_APP_BROWSER.test(ua)) setState('in-app')
    else signIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load
  }, [])

  const copyLink = async () => {
    if (!(await copyText(window.location.href))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (state === 'in-app') {
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
        <button className="me-text-button" onClick={signIn}>Continue here anyway</button>
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

  return (
    <LogShell busy>
      <h1 className="log-athlete">Signing you in…</h1>
      <p className="log-brief" role="status">Just a moment.</p>
    </LogShell>
  )
}
