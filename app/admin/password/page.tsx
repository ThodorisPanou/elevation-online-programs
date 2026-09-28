'use client'

// app/admin/password/page.tsx
// Change your own password. A coach with a temporary password is kept here by the admin layout until done.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut, TriangleAlert } from 'lucide-react'
import { useMe } from '@/lib/hooks/useMe'
import { changeMyPassword } from '@/lib/services/coachService'
import { PASSWORD_MIN, passwordProblem } from '@/lib/logins'
import '@/app/login/login.css'

export default function PasswordPage() {
  const router = useRouter()
  const { me, refresh, signOut } = useMe()
  const forced = !!me.coach?.must_change_password

  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem)              { setError(problem); return }
    if (password !== confirm) { setError('The two passwords don\'t match'); return }

    setSaving(true)
    setError(null)
    try {
      await changeMyPassword(password)
      if (forced) {
        await refresh()   // clears the forced redirect in the layout
        router.replace('/admin/athletes')
        return
      }
      setDone(true)
      setPassword(''); setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="logo">Coach Panel</div>
        <h1 className="login-title">{forced ? 'Choose your password' : 'Change password'}</h1>

        {forced && (
          <p className="field-hint password-intro">
            Welcome{me.coach ? `, ${me.coach.name}` : ''}! You signed in with a temporary password.
            Choose your own password to continue.
          </p>
        )}

        <div className="field">
          <label className="field-label" htmlFor="new-password">
            New password <span className="field-hint">(at least {PASSWORD_MIN} characters)</span>
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            className="field-input"
            value={password}
            onChange={e => { setPassword(e.target.value); setDone(false) }}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirm-password">Repeat new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className="field-input"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setDone(false) }}
          />
        </div>

        {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}
        {done  && <div className="alert-success" role="status">Password changed.</div>}

        <button type="submit" className="btn btn-primary login-submit" disabled={saving}>
          {saving ? 'Saving…' : forced ? 'Save and continue' : 'Change password'}
        </button>

        <div className="password-footer">
          {forced
            ? <button type="button" className="btn btn-logout" onClick={signOut}><LogOut size={14} aria-hidden /> Sign out</button>
            : <button type="button" className="btn" onClick={() => router.push('/admin/athletes')}><ArrowLeft size={14} aria-hidden /> Back</button>
          }
        </div>
      </form>
    </div>
  )
}
