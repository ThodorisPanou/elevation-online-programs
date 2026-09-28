'use client'

// app/admin/coaches/page.tsx
// Admin only: coach logins. Add a coach (username + temporary password, shown once), edit, reset password,
// deactivate / reactivate. All changes go through /api/coaches (service role).

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, Copy, KeyRound, Pencil, Plus, Power, TriangleAlert, UserCog, UserRoundX,
} from 'lucide-react'
import { useMe } from '@/lib/hooks/useMe'
import {
  Coach, CoachInput, createCoach, getCoaches, resetCoachPassword, setCoachActive, updateCoach,
} from '@/lib/services/coachService'
import { USERNAME_HINT, USERNAME_PATTERN, normalizeUsername } from '@/lib/logins'
import Modal from '@/components/modal'
import Menu from '@/components/menu'
import { NotFound } from '@/components/pageStatus'
import './coaches.css'

type Dialog =
  | { kind: 'form', coach: Coach | null }                        // null = new coach
  | { kind: 'credentials', username: string, password: string, isNew: boolean }
  | { kind: 'confirm-reset', coach: Coach }
  | { kind: 'confirm-active', coach: Coach }

const emptyForm: CoachInput = { username: '', name: '', email: '' }

export default function CoachesPage() {
  const { me } = useMe()
  if (!me.isAdmin) return <NotFound message="Page not found" />
  return <Coaches />
}

function Coaches() {
  const router = useRouter()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [dialog,    setDialog]    = useState<Dialog | null>(null)
  const [form,      setForm]      = useState<CoachInput>(emptyForm)
  const [busy,      setBusy]      = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)

  const load = useCallback(
    () => getCoaches()
      .then(setCoaches)
      .catch(e => setError(e.message ?? 'Failed to load coaches'))
      .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => { load() }, [load])

  // ─── Dialog helpers ───────────────────────────────────────────────────

  const open = (d: Dialog) => {
    setFormError(null); setCopied(false)
    if (d.kind === 'form') {
      setForm(d.coach ? { username: d.coach.username, name: d.coach.name, email: d.coach.email ?? '' } : emptyForm)
    }
    setDialog(d)
  }
  const close = () => { if (!busy) setDialog(null) }

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setFormError(null)
    try { await action() }
    catch (e) { setFormError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleSave = () => run(async () => {
    if (dialog?.kind !== 'form') return
    const input = { ...form, username: normalizeUsername(form.username) }
    if (!input.name.trim())                   throw new Error('Name is required')
    if (!USERNAME_PATTERN.test(input.username)) throw new Error(`Invalid username — ${USERNAME_HINT}`)

    if (dialog.coach) {
      await updateCoach(dialog.coach.id, input)
      setDialog(null)
    } else {
      const { coach, tempPassword } = await createCoach(input)
      setDialog({ kind: 'credentials', username: coach.username, password: tempPassword, isNew: true })
    }
    await load()
  })

  const handleReset = () => run(async () => {
    if (dialog?.kind !== 'confirm-reset') return
    const { tempPassword } = await resetCoachPassword(dialog.coach.id)
    setDialog({ kind: 'credentials', username: dialog.coach.username, password: tempPassword, isNew: false })
    await load()
  })

  const handleToggleActive = () => run(async () => {
    if (dialog?.kind !== 'confirm-active') return
    await setCoachActive(dialog.coach.id, !dialog.coach.active)
    setDialog(null)
    await load()
  })

  const copyCredentials = async (username: string, password: string) => {
    await navigator.clipboard.writeText(
      `Login: ${window.location.origin}/login\nUsername: ${username}\nTemporary password: ${password}`,
    )
    setCopied(true)
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <div className="page">
        <header className="header">
          <button className="btn-back" onClick={() => router.push('/admin/athletes')}>
            <ArrowLeft size={16} aria-hidden /> Athletes
          </button>
          <button className="btn btn-primary" onClick={() => open({ kind: 'form', coach: null })}>
            <Plus size={16} aria-hidden /> Add Coach
          </button>
        </header>

        <main className="page-body">
          <div className="eyebrow">Admin</div>
          <h1 className="page-heading">Coaches</h1>

          {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

          <div className="coach-list">
            {loading
              ? [1, 2].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i * 0.08}s` }} />)
              : coaches.length === 0
                ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><UserCog size={36} aria-hidden /></div>
                    <div className="empty-state-title">No coaches yet</div>
                    <div className="empty-state-sub">Click &ldquo;Add Coach&rdquo; to create the first login</div>
                  </div>
                )
                : coaches.map((c, i) => (
                  <div key={c.id} className={`coach-card${c.active ? '' : ' inactive'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="avatar">{initials(c.name)}</div>
                    <div className="coach-info">
                      <div className="coach-name">
                        {c.name}
                        {!c.active              && <span className="coach-badge badge-off">Deactivated</span>}
                        {c.active && c.must_change_password && <span className="coach-badge">Temporary password</span>}
                      </div>
                      <div className="coach-meta">
                        @{c.username}{c.email ? ` · ${c.email}` : ''}
                      </div>
                      <div className="coach-meta">
                        {c.athletes} athletes · {c.programs} programs · {c.exercises} exercises
                      </div>
                    </div>
                    <Menu
                      label={`Actions for ${c.name}`}
                      items={[
                        { label: 'Edit',           icon: <Pencil size={15} aria-hidden />,   onSelect: () => open({ kind: 'form', coach: c }) },
                        { label: 'Reset password', icon: <KeyRound size={15} aria-hidden />, onSelect: () => open({ kind: 'confirm-reset', coach: c }) },
                        c.active
                          ? { label: 'Deactivate', icon: <UserRoundX size={15} aria-hidden />, danger: true, onSelect: () => open({ kind: 'confirm-active', coach: c }) }
                          : { label: 'Reactivate', icon: <Power size={15} aria-hidden />,               onSelect: () => open({ kind: 'confirm-active', coach: c }) },
                      ]}
                    />
                  </div>
                ))
            }
          </div>
        </main>
      </div>

      {/* Add / edit */}
      {dialog?.kind === 'form' && (
        <Modal onClose={close} title={dialog.coach ? 'Edit Coach' : 'Add Coach'}>
          <div className="modal-title">{dialog.coach ? 'Edit Coach' : 'Add Coach'}</div>
          <form onSubmit={e => { e.preventDefault(); handleSave() }}>
            <div className="field">
              <label className="field-label" htmlFor="coach-name">Full name</label>
              <input id="coach-name" className="field-input" value={form.name} data-autofocus
                onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Giorgos Papadopoulos" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="coach-username">Username <span className="field-hint">(used to sign in)</span></label>
              <input id="coach-username" className="field-input" value={form.username}
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. giorgos" />
              <div className="field-hint coach-field-note">{USERNAME_HINT}</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="coach-email">Email <span className="field-hint">(optional, contact only)</span></label>
              <input id="coach-email" type="email" className="field-input" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>

            {formError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {formError}</div>}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : dialog.coach ? 'Save' : 'Create Coach'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Temporary password — shown once */}
      {dialog?.kind === 'credentials' && (
        <Modal onClose={close} title="Login details">
          <div className="modal-title">{dialog.isNew ? 'Coach created' : 'Password reset'}</div>
          <p className="modal-text">
            Give these to the coach. They&apos;ll choose their own password when they first sign in.
            <strong> The temporary password is shown only now.</strong>
          </p>
          <dl className="credentials">
            <dt>Username</dt>           <dd>{dialog.username}</dd>
            <dt>Temporary password</dt> <dd>{dialog.password}</dd>
          </dl>
          <div className="modal-actions">
            <button className={`btn ${copied ? 'btn-success' : ''}`} onClick={() => copyCredentials(dialog.username, dialog.password)} aria-live="polite">
              {copied ? <><Check size={14} aria-hidden /> Copied</> : <><Copy size={14} aria-hidden /> Copy</>}
            </button>
            <button className="btn btn-primary" onClick={close} data-autofocus>Done</button>
          </div>
        </Modal>
      )}

      {/* Confirm reset */}
      {dialog?.kind === 'confirm-reset' && (
        <Modal onClose={close} title="Reset password">
          <div className="modal-title">Reset password?</div>
          <p className="modal-text">
            <strong>{dialog.coach.name}</strong>&apos;s current password stops working. You&apos;ll get a new temporary
            password to give them, and they must change it when they sign in.
          </p>
          {formError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {formError}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleReset} disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
          </div>
        </Modal>
      )}

      {/* Confirm deactivate / reactivate */}
      {dialog?.kind === 'confirm-active' && (
        <Modal onClose={close} title={dialog.coach.active ? 'Deactivate coach' : 'Reactivate coach'}
          className={dialog.coach.active ? 'modal modal-danger' : 'modal'}>
          <div className="modal-title">{dialog.coach.active ? 'Deactivate coach?' : 'Reactivate coach?'}</div>
          <p className="modal-text">
            {dialog.coach.active
              ? <><strong>{dialog.coach.name}</strong> is signed out and can&apos;t sign in or see any data. Their athletes,
                  programs and exercises are kept, and you can reactivate them any time.</>
              : <><strong>{dialog.coach.name}</strong> can sign in again with their current password.</>}
          </p>
          {formError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {formError}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button className={`btn ${dialog.coach.active ? 'btn-danger' : 'btn-primary'}`} onClick={handleToggleActive} disabled={busy}>
              {busy ? 'Saving…' : dialog.coach.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}
