'use client'

// components/athleteLogin.tsx
// "App login" panel on the athlete page (coach of the athlete or admin): username, status, a one-time login
// link to send over Instagram, disable/enable. Talks to /api/athletes/[id]/login*.

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Ban, Check, Copy, KeyRound, Link as LinkIcon, Pencil, RotateCcw, Share2, TriangleAlert } from 'lucide-react'
import Modal from '@/components/modal'
import Menu from '@/components/menu'
import {
  AthleteLogin, LoginLink, createLoginLink, getAthleteLogin, setAthleteLoginEnabled, setAthleteUsername,
} from '@/lib/services/athleteLoginService'
import { USERNAME_HINT, USERNAME_PATTERN, normalizeUsername } from '@/lib/logins'
import './athleteLogin.css'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// What the athlete receives; the link must be opened in Safari for the login to stick (see TODO.md → PWA)
const linkMessage = (url: string) =>
  `Your training programs: ${url}\nOpen it in Safari, then add it to your Home Screen to stay logged in.`

function statusOf(login: AthleteLogin): { label: string; tone: 'off' | 'pending' | 'ok' | 'danger' } {
  if (login.disabled)      return { label: 'Login disabled', tone: 'danger' }
  if (login.link)          return { label: `Link sent · expires ${fmtDate(login.link.expiresAt)}`, tone: 'pending' }
  if (login.lastSignInAt)  return { label: `Last login ${fmtDateTime(login.lastSignInAt)}`, tone: 'ok' }
  if (login.hasAccount)    return { label: 'Not logged in yet', tone: 'off' }
  return { label: 'No login yet', tone: 'off' }
}

export default function AthleteLoginPanel({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [login,   setLogin]   = useState<AthleteLogin | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [link,    setLink]    = useState<LoginLink | null>(null)
  const [copied,  setCopied]  = useState<'message' | 'link' | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const load = useCallback(() => {
    getAthleteLogin(athleteId).then(setLogin).catch(e => setError(e.message ?? 'Could not load the login'))
  }, [athleteId])
  useEffect(load, [load])

  // Runs one action; errors land in the panel
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await action() }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  const getLink = () => run(async () => {
    const created = await createLoginLink(athleteId)
    setLink(created)
    setLogin(await getAthleteLogin(athleteId))
  })

  const copy = async (what: 'message' | 'link') => {
    if (!link) return
    await navigator.clipboard.writeText(what === 'message' ? linkMessage(link.url) : link.url)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  // Phones: the share sheet (Instagram, WhatsApp…). Cancelling it isn't an error
  const share = async () => {
    if (!link) return
    try { await navigator.share({ text: linkMessage(link.url) }) } catch {}
  }

  const setEnabled = (enabled: boolean) => run(async () => {
    setLogin(await setAthleteLoginEnabled(athleteId, enabled))
    setLink(null)
    setConfirmDisable(false)
  })

  if (!login) {
    return (
      <section className="login-panel" aria-label="App login">
        {error
          ? <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>
          : <div className="skeleton login-skeleton" />}
      </section>
    )
  }

  const status = statusOf(login)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <section className="login-panel" aria-labelledby="login-panel-title">
      <div className="login-head">
        <div className="login-icon"><KeyRound size={18} aria-hidden /></div>
        <div className="login-head-text">
          <h2 id="login-panel-title" className="login-title">App login</h2>
          <div className="login-username">
            {login.username ? <>Username <strong>{login.username}</strong></> : 'No username yet'}
          </div>
        </div>
        <span className={`login-status tone-${status.tone}`}>{status.label}</span>
      </div>

      {error && <div className="alert-error login-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

      <div className="login-actions">
        {!login.username ? (
          <button className="btn btn-primary" onClick={() => setEditing(true)} disabled={busy}>
            <Pencil size={14} aria-hidden /> Set username
          </button>
        ) : login.disabled ? (
          <button className="btn btn-teal" onClick={() => setEnabled(true)} disabled={busy}>
            <RotateCcw size={14} aria-hidden /> {busy ? 'Enabling…' : 'Enable login'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={getLink} disabled={busy}>
            <LinkIcon size={14} aria-hidden />
            {busy ? 'Creating…' : login.hasAccount ? 'Get new login link' : 'Get login link'}
          </button>
        )}

        {login.username && (
          <Menu
            label="More login actions"
            items={[
              { label: 'Change username', icon: <Pencil size={15} aria-hidden />, onSelect: () => setEditing(true) },
              ...(!login.disabled ? [{
                label: 'Disable login', icon: <Ban size={15} aria-hidden />, danger: true,
                onSelect: () => setConfirmDisable(true),
              }] : []),
            ]}
          />
        )}
      </div>

      {link && (
        <div className="login-link" role="status">
          <label className="field-label" htmlFor="login-link-url">Login link for {athleteName}</label>
          <input id="login-link-url" className="field-input login-link-url" value={link.url} readOnly
                 onFocus={e => e.currentTarget.select()} />
          <div className="login-link-actions">
            <button className={`btn ${copied === 'message' ? 'btn-success' : 'btn-copy'}`} onClick={() => copy('message')}>
              {copied === 'message' ? <><Check size={14} aria-hidden /> Copied</> : <><Copy size={14} aria-hidden /> Copy message</>}
            </button>
            <button className={`btn ${copied === 'link' ? 'btn-success' : ''}`} onClick={() => copy('link')}>
              {copied === 'link' ? <><Check size={14} aria-hidden /> Copied</> : <><LinkIcon size={14} aria-hidden /> Copy link only</>}
            </button>
            {canShare && (
              <button className="btn" onClick={share}><Share2 size={14} aria-hidden /> Share</button>
            )}
          </div>
          <p className="login-link-note">
            Works once, until {fmtDate(link.expiresAt)}. Getting a new link cancels this one — that’s also how the
            athlete gets back in if they lose access.
          </p>
        </div>
      )}

      {editing && (
        <UsernameModal
          athleteId={athleteId}
          current={login.username}
          hasAccount={login.hasAccount}
          onClose={() => setEditing(false)}
          onSaved={saved => { setLogin(saved); setEditing(false) }}
        />
      )}

      {confirmDisable && (
        <Modal onClose={() => !busy && setConfirmDisable(false)} title="Disable login" className="modal modal-danger">
          <div className="modal-icon"><Ban size={20} aria-hidden /></div>
          <div className="modal-title">Disable login</div>
          <div className="modal-text">
            <strong>{athleteName}</strong> is signed out everywhere and can’t open the app until you enable the login
            again. Open login links stop working. Share links to single programs are not affected.
          </div>
          {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirmDisable(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-danger" onClick={() => setEnabled(false)} disabled={busy}>
              {busy ? 'Disabling…' : 'Disable login'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ─── Username modal ───────────────────────────────────────────────────────

function UsernameModal({ athleteId, current, hasAccount, onClose, onSaved }: {
  athleteId:  string
  current:    string | null
  hasAccount: boolean
  onClose:    () => void
  onSaved:    (login: AthleteLogin) => void
}) {
  const [value,  setValue]  = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const username = normalizeUsername(value)
    if (!USERNAME_PATTERN.test(username)) { setError(`Invalid username — ${USERNAME_HINT}`); return }
    setSaving(true); setError(null)
    try { onSaved(await setAthleteUsername(athleteId, username)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the username') }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={() => !saving && onClose()} title={current ? 'Change username' : 'Set username'}>
      <form onSubmit={submit}>
        <div className="modal-title">{current ? 'Change username' : 'Set username'}</div>
        <div className="modal-text">
          The athlete signs in with this username if they set a password, e.g. on a second phone.
          {current && hasAccount && ' Their current sessions keep working.'}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="athlete-username">Username</label>
          <input
            id="athlete-username" className="field-input" value={value} data-autofocus
            autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32}
            onChange={e => setValue(e.target.value)} placeholder="e.g. nikos.p"
          />
          <div className="field-hint login-field-hint">{USERNAME_HINT}. Unique across all coaches and athletes.</div>
        </div>
        {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !value.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
