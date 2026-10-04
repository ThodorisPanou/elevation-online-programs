'use client'

// components/exerciseRecords.tsx
// Athlete app: under each exercise the coach tracks, the athlete's best and latest set and a "Log" button. The
// coach's program view shows the same line read-only (no button), and its record count opens the history. The sheet logs a best set (reps × kg) on a date, lists that exercise's history (across programs) and edits or
// deletes the athlete's own records. Uses the athlete app's dialog/form styles (app/me/me.css).

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Modal from '@/components/modal'
import { ProgramViewModel, ViewBlockExercise } from '@/lib/viewModels/ProgramViewModel'
import {
  ExerciseLog, ExerciseLogInput, LogInputError,
  deleteMyExerciseLog, getMyExerciseLogs, logExercise, updateMyExerciseLog,
} from '@/lib/services/athleteAppService'
import '@/app/me/me.css'   // dialog + form styles, also needed on the coach's program view
import './exerciseRecords.css'

// ─── Formatting ───────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

// The phone's date, not UTC: a set done at 00:30 belongs to today
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// "2026-10-12" → "Sun 12 Oct" (+ year when it isn't this year)
function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (iso === today()) return 'Today'
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}

const formatKg = (kg: number) => String(Number(kg))
const formatSet = (l: Pick<ExerciseLog, 'reps' | 'kg'>) => `${l.reps} × ${formatKg(l.kg)} kg`

// What the line and history need of a record — the athlete's own (ExerciseLog) or the coach's view of them
type RecordLike = Pick<ExerciseLog, 'id' | 'reps' | 'kg' | 'performed_on' | 'note'>

// Heaviest weight wins; same weight → more reps
function best<T extends RecordLike>(logs: T[]) {
  return logs.reduce<T | null>(
    (top, l) => !top || l.kg > top.kg || (l.kg === top.kg && l.reps > top.reps) ? l : top, null)
}

const newestFirst = (a: ExerciseLog, b: ExerciseLog) =>
  b.performed_on.localeCompare(a.performed_on) || b.created_at.localeCompare(a.created_at)

// ─── Records of the program's tracked exercises ───────────────────────────

export function useExerciseLogs(program: ProgramViewModel | null) {
  const exerciseIds = useMemo(() => {
    const ids = new Set<string>()
    program?.days.forEach(d => d.blocks.forEach(b => b.block_exercises.forEach(be => {
      if (be.track && be.exercise?.id) ids.add(be.exercise.id)
    })))
    return [...ids].sort()
  }, [program])

  const [logs,   setLogs]   = useState<ExerciseLog[]>([])
  const [failed, setFailed] = useState(false)
  const key = exerciseIds.join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    getMyExerciseLogs(key.split(','))
      .then(l => { if (!cancelled) { setLogs(l); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [key])

  return {
    failed,
    of:      (exerciseId: string) => logs.filter(l => l.exercise_id === exerciseId),
    added:   (l: ExerciseLog) => setLogs(prev => [...prev, l].sort(newestFirst)),
    changed: (l: ExerciseLog) => setLogs(prev => prev.map(p => p.id === l.id ? l : p).sort(newestFirst)),
    removed: (id: string) => setLogs(prev => prev.filter(p => p.id !== id)),
  }
}

export type ExerciseLogs = ReturnType<typeof useExerciseLogs>

// ─── Line under a tracked exercise ────────────────────────────────────────

// logs: newest first. Without onLog (the coach's view) it's read-only: no Log button, and the record count opens
// the history (onHistory).
export function RecordLine({ be, logs, onLog, onHistory }: {
  be:         ViewBlockExercise
  logs:       RecordLike[]
  onLog?:     () => void
  onHistory?: () => void
}) {
  const top    = best(logs)
  const latest = logs[0]

  return (
    <div className="rec-line">
      {latest ? (
        <p className="rec-summary">
          <span className="rec-fact"><span className="rec-key">Best</span> {formatSet(top!)}</span>
          {latest.id !== top!.id && (
            <span className="rec-fact"><span className="rec-key">Last</span> {formatSet(latest)}</span>
          )}
          {!onLog && (
            <button className="rec-count" onClick={onHistory} aria-label={`${logs.length} record${logs.length !== 1 ? 's' : ''} of ${be.exercise?.name ?? 'this exercise'}: show history`}>
              {logs.length} record{logs.length !== 1 ? 's' : ''}
            </button>
          )}
        </p>
      ) : (
        <p className="rec-summary rec-empty">{onLog ? 'Log your best set' : 'No records yet'}</p>
      )}
      {onLog && (
        <button className="rec-log" onClick={onLog} aria-label={`Log ${be.exercise?.name ?? 'exercise'}`}>
          <Plus size={16} aria-hidden /> Log
        </button>
      )}
    </div>
  )
}

// ─── Sheet: log a set, history, edit ──────────────────────────────────────

// A plain number from the coach ("6", "80", "82,5") pre-fills the first record; ranges and text don't
const plain = (s?: string) => /^\d+([.,]\d+)?$/.test(s?.trim() ?? '') ? s!.trim() : ''

function emptyForm(be: ViewBlockExercise, logs: ExerciseLog[]) {
  const last = logs[0]
  return {
    reps: last ? String(last.reps) : plain(be.reps).replace(/[.,].*/, ''),
    kg:   last ? formatKg(last.kg) : plain(be.kg),
    date: today(),
    note: '',
  }
}

export function RecordSheet({ be, records, onClose }: { be: ViewBlockExercise; records: ExerciseLogs; onClose: () => void }) {
  const name = be.exercise?.name ?? 'Exercise'
  const logs = records.of(be.exercise.id)

  const [editing,  setEditing]  = useState<ExerciseLog | null>(null)
  const [form,     setForm]     = useState(() => emptyForm(be, logs))
  const [showNote, setShowNote] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [confirm,  setConfirm]  = useState(false)   // "Delete" asks once more
  const [error,    setError]    = useState<string | null>(null)

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value })); setError(null)
  }

  const startEdit = (l: ExerciseLog) => {
    setEditing(l); setConfirm(false); setError(null)
    setForm({ reps: String(l.reps), kg: formatKg(l.kg), date: l.performed_on, note: l.note ?? '' })
    setShowNote(!!l.note)
  }
  const stopEdit = () => {
    setEditing(null); setConfirm(false); setError(null); setShowNote(false)
    setForm(emptyForm(be, logs))
  }

  // Same rules as the database, checked here so mistakes show instantly
  const parse = (): ExerciseLogInput | string => {
    const reps = Number(form.reps.trim())
    const kg   = Number(form.kg.trim().replace(',', '.'))
    if (!form.reps.trim() || !Number.isInteger(reps) || reps < 1 || reps > 100) return 'Reps must be between 1 and 100'
    if (!form.kg.trim() || !Number.isFinite(kg) || kg < 0 || kg > 1000) return 'Kg must be between 0 and 1000'
    if (!form.date || form.date > today()) return 'Pick a date that isn’t in the future'
    return { reps, kg: Math.round(kg * 100) / 100, performed_on: form.date, note: form.note.trim() || undefined }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const input = parse()
    if (typeof input === 'string') { setError(input); return }
    setSaving(true); setError(null)
    try {
      if (editing) {
        records.changed(await updateMyExerciseLog(editing.id, input))
        stopEdit()
      } else {
        records.added(await logExercise(be.id, input))
        onClose()
      }
    } catch (err) {
      setError(err instanceof LogInputError ? err.message : (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    if (!confirm) { setConfirm(true); return }
    setSaving(true); setError(null)
    try {
      await deleteMyExerciseLog(editing.id)
      records.removed(editing.id)
      setEditing(null); setConfirm(false); setShowNote(false)
      setForm(emptyForm(be, logs.filter(l => l.id !== editing.id)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={() => { if (!saving) onClose() }} title={`Log ${name}`} className="me-dialog rec-sheet" overlayClassName="me-dialog-overlay">
      <h2 className="me-dialog-title">{name}</h2>
      <p className="rec-sheet-sub">{editing ? `Edit your set from ${formatDay(editing.performed_on).replace(/^Today$/, 'today')}` : 'Your best set today'}</p>

      <form className="rec-form" onSubmit={submit} noValidate>
        <div className="rec-set">
          <label className="rec-field">
            <span className="me-label">Reps</span>
            <input
              className="me-input rec-number" inputMode="numeric" autoComplete="off" enterKeyHint="next"
              value={form.reps} onChange={set('reps')} data-autofocus
            />
          </label>
          <span className="rec-times" aria-hidden>×</span>
          <label className="rec-field">
            <span className="me-label">Kg</span>
            <input
              className="me-input rec-number" inputMode="decimal" autoComplete="off" enterKeyHint="done"
              value={form.kg} onChange={set('kg')}
            />
          </label>
        </div>

        <label className="rec-field rec-date">
          <span className="me-label">Date</span>
          <input className="me-input" type="date" max={today()} value={form.date} onChange={set('date')} />
        </label>

        {showNote ? (
          <label className="rec-field">
            <span className="me-label">Note</span>
            <input
              className="me-input" maxLength={500} placeholder="e.g. felt easy, last rep slow"
              value={form.note} onChange={set('note')} autoFocus={!form.note}
            />
          </label>
        ) : (
          <button type="button" className="me-text-button rec-add-note" onClick={() => setShowNote(true)}>Add a note</button>
        )}

        {error && <p className="me-error" role="alert">{error}</p>}

        <div className="me-dialog-actions">
          <button type="submit" className="me-button" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}
          </button>
          {editing ? (
            <div className="rec-edit-actions">
              <button type="button" className="me-text-button" onClick={stopEdit} disabled={saving}>Cancel</button>
              <button type="button" className="me-text-button rec-delete" onClick={remove} disabled={saving}>
                {confirm ? 'Tap again to delete' : 'Delete'}
              </button>
            </div>
          ) : (
            <button type="button" className="me-text-button" onClick={onClose} disabled={saving}>Close</button>
          )}
        </div>
      </form>

      {logs.length > 0 && <History logs={logs} onPick={startEdit} pickedId={editing?.id} />}
      {records.failed && <p className="rec-sheet-sub">Your earlier records didn’t load. New ones still save.</p>}
    </Modal>
  )
}

// ─── History ──────────────────────────────────────────────────────────────
// Newest first, best marked. With onPick (the athlete) each record is a button that opens it for editing.

function History<T extends RecordLike>({ logs, onPick, pickedId }: { logs: T[]; onPick?: (l: T) => void; pickedId?: string }) {
  const top = best(logs)
  return (
    <section className="rec-history" aria-label="History">
      <h3 className="rec-history-title">History</h3>
      <ol className="rec-list">
        {logs.map(l => {
          const content = (
            <>
              <span className="rec-item-day">{formatDay(l.performed_on)}</span>
              <span className="rec-item-set">
                {formatSet(l)}
                {l.id === top?.id && logs.length > 1 && <span className="rec-best">Best</span>}
              </span>
              {l.note && <span className="rec-item-note">{l.note}</span>}
            </>
          )
          return (
            <li key={l.id}>
              {onPick ? (
                <button
                  type="button"
                  className={`rec-item${pickedId === l.id ? ' is-editing' : ''}`}
                  onClick={() => onPick(l)}
                  aria-label={`Edit ${formatSet(l)} on ${formatDay(l.performed_on)}`}
                >
                  {content}
                </button>
              ) : (
                <div className="rec-item is-static">{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ─── Coach: read-only history ─────────────────────────────────────────────

export function RecordHistorySheet({ be, logs, athleteName, onClose }: {
  be:          ViewBlockExercise
  logs:        RecordLike[]   // newest first
  athleteName: string
  onClose:     () => void
}) {
  const name = be.exercise?.name ?? 'Exercise'
  return (
    <Modal onClose={onClose} title={`${name}: records`} className="me-dialog rec-sheet" overlayClassName="me-dialog-overlay">
      <h2 className="me-dialog-title">{name}</h2>
      <p className="rec-sheet-sub">{athleteName}’s best sets, from every program</p>
      <History logs={logs} />
      <div className="me-dialog-actions">
        <button type="button" className="me-button is-quiet" onClick={onClose} data-autofocus>Close</button>
      </div>
    </Modal>
  )
}
