'use client'

// app/me/password/page.tsx
// Optional: athletes start without a password (they sign in through links). A password lets them sign in
// with their username on another phone or after clearing the browser.

import { FormEvent, useState } from 'react'
import { LogShell } from '@/components/programView'
import { useAthleteMe } from '@/lib/hooks/useAthleteMe'
import { changeMyPassword } from '@/lib/services/coachService'
import { PASSWORD_MAX, passwordProblem } from '@/lib/logins'
import { MeNav } from '../meNav'

export default function MyPasswordPage() {
  const { athlete } = useAthleteMe()
  const [password, setPassword] = useState('')
  const [repeat,   setRepeat]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = passwordProblem(password) ?? (password !== repeat ? 'The two passwords don’t match' : null)
    if (problem) { setError(problem); return }

    setSaving(true); setError(null)
    try {
      await changeMyPassword(password)
      setDone(true); setPassword(''); setRepeat('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <LogShell nav={<MeNav back />}>
      <h1 className="log-athlete">Password</h1>
      <p className="log-brief">
        Optional. With a password you can also sign in with your username
        {athlete.username && <> <strong className="me-strong">{athlete.username}</strong></>} — for example on
        another phone. Your coach can always send you a new login link instead.
      </p>

      <form className="me-form" onSubmit={submit}>
        {/* Lets password managers save the pair */}
        <input type="text" name="username" autoComplete="username" value={athlete.username ?? ''} readOnly hidden />

        <label className="me-label" htmlFor="me-password">New password</label>
        <input
          id="me-password" className="me-input" type="password" autoComplete="new-password"
          maxLength={PASSWORD_MAX} value={password} onChange={e => { setPassword(e.target.value); setDone(false) }}
        />
        <label className="me-label" htmlFor="me-password-repeat">Repeat it</label>
        <input
          id="me-password-repeat" className="me-input" type="password" autoComplete="new-password"
          maxLength={PASSWORD_MAX} value={repeat} onChange={e => { setRepeat(e.target.value); setDone(false) }}
        />

        {error && <p className="me-error" role="alert">{error}</p>}
        {done  && <p className="me-success" role="status">Password saved.</p>}

        <button type="submit" className="me-button" disabled={saving || !password || !repeat}>
          {saving ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </LogShell>
  )
}
