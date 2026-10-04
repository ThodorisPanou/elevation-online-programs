'use client'

// components/athleteRecords.tsx
// "Records" on the athlete page (coach / admin, read-only): the best sets the athlete logged on tracked exercises,
// one row per exercise (best, count, last), opening into the full history.

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { AthleteExerciseLog, getAthleteExerciseLogs } from '@/lib/services/exerciseLogService'
import './athleteRecords.css'

// "2026-10-12" → "12 Oct" (+ year when it isn't this year); parsed as a local date, not UTC
function fmtDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}
const fmtSet = (l: Pick<AthleteExerciseLog, 'reps' | 'kg'>) => `${l.reps} × ${l.kg} kg`

interface Group {
  exerciseId: string
  name:       string
  logs:       AthleteExerciseLog[]   // newest first
  best:       AthleteExerciseLog     // heaviest; same weight → more reps (same rule as the athlete app)
}

function group(logs: AthleteExerciseLog[]): Group[] {
  const byExercise = new Map<string, AthleteExerciseLog[]>()
  for (const l of logs) byExercise.set(l.exercise_id, [...(byExercise.get(l.exercise_id) ?? []), l])
  // Most recently trained first (logs arrive newest first, so the Map keeps that order)
  return [...byExercise.entries()].map(([exerciseId, ls]) => ({
    exerciseId,
    name: ls[0].exercise_name,
    logs: ls,
    best: ls.reduce((top, l) => l.kg > top.kg || (l.kg === top.kg && l.reps > top.reps) ? l : top),
  }))
}

export default function AthleteRecords({ athleteId }: { athleteId: string }) {
  const [logs,  setLogs]  = useState<AthleteExerciseLog[] | null>(null)
  const [error, setError] = useState(false)
  const [open,  setOpen]  = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAthleteExerciseLogs(athleteId)
      .then(l => { if (!cancelled) setLogs(l) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [athleteId])

  const groups = useMemo(() => group(logs ?? []), [logs])

  return (
    <section className="records" aria-labelledby="records-title">
      <div className="eyebrow" id="records-title">Records</div>

      {error ? (
        <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> Couldn’t load the records.</div>
      ) : logs === null ? (
        <div className="skeleton records-skeleton" />
      ) : groups.length === 0 ? (
        <p className="records-empty">
          No records yet. Tick <strong>Track</strong> on an exercise in a program, and the athlete can log their best
          set in the app.
        </p>
      ) : (
        <ul className="records-list">
          {groups.map(g => {
            const isOpen = open === g.exerciseId
            return (
              <li key={g.exerciseId} className={`record${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="record-head"
                  aria-expanded={isOpen}
                  aria-controls={`record-${g.exerciseId}`}
                  onClick={() => setOpen(isOpen ? null : g.exerciseId)}
                >
                  <span className="record-name">{g.name}</span>
                  <span className="record-best">
                    <span className="record-key">Best</span> {fmtSet(g.best)}
                    <span className="record-date"> · {fmtDay(g.best.performed_on)}</span>
                  </span>
                  <span className="record-meta">
                    {g.logs.length} record{g.logs.length !== 1 ? 's' : ''} · last {fmtDay(g.logs[0].performed_on)}
                  </span>
                  <ChevronDown className="record-chevron" size={16} aria-hidden />
                </button>

                {isOpen && (
                  <ol className="record-history" id={`record-${g.exerciseId}`}>
                    {g.logs.map(l => (
                      <li key={l.id} className="record-row">
                        <span className="record-row-day">{fmtDay(l.performed_on)}</span>
                        <span className="record-row-set">
                          {fmtSet(l)}
                          {l.id === g.best.id && g.logs.length > 1 && <span className="record-tag">Best</span>}
                        </span>
                        {l.note && <span className="record-row-note">{l.note}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
