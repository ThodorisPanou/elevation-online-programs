'use client'

// components/programView.tsx
// Read-only program UI shared by the public page and the admin preview. A calm, dark training log: each block is
// a short path of exercises on one thread, and the numbers read as a plain sentence ("3 sets · 8–10 reps").

import React, { KeyboardEvent, TouchEvent, useRef, useState } from 'react'
import Image from 'next/image'
import { Manrope } from 'next/font/google'
import { ProgramViewModel, ViewBlock, ViewBlockExercise, ViewDay } from '@/lib/viewModels/ProgramViewModel'
import Modal from '@/components/modal'
import { ArrowRight, Play, RotateCcw, X } from 'lucide-react'
import { APP_NAME, APP_SHORT_NAME } from '@/lib/brand'
import { Credit } from '@/components/credit'
import { isInstalledApp } from '@/lib/installedApp'
import './programView.css'

// Carries Greek, so athlete and exercise names never fall back to a different face
const manrope = Manrope({ subsets: ['latin', 'latin-ext', 'greek'], variable: '--font-log' })

// ─── Formatting ───────────────────────────────────────────────────────────

// 45 → "45s", 90 → "1:30", 120 → "2:00"
function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Plain numbers and ranges ("8", "8-10", "60/70") get a unit; anything else ("AMRAP", "RPE 8", "70%") is shown
// exactly as the coach typed it
const NUMERIC = /^\d+([.,]\d+)?(\s*[-–/]\s*\d+([.,]\d+)?)*$/

// En dash for ranges: "8-10" → "8–10"
const range = (s: string) => s.replace(/(\d)\s*-\s*(\d)/g, '$1–$2')

type Part = { value: string; unit?: string }

// One exercise's numbers as sentence parts, always in the order sets, reps, load, rest
function prescription(be: ViewBlockExercise): Part[] {
  const parts: Part[] = []
  const reps = be.reps?.trim() ?? ''
  const kg   = be.kg?.trim() ?? ''

  if (be.sets)               parts.push({ value: String(be.sets), unit: be.sets === 1 ? 'set' : 'sets' })
  if (reps)                  parts.push(NUMERIC.test(reps) ? { value: range(reps), unit: 'reps' } : { value: reps })
  if (kg)                    parts.push(NUMERIC.test(kg) ? { value: range(kg), unit: 'kg' } : { value: kg })
  if (be.rest_seconds === 0) parts.push({ value: 'No rest' })
  else if (be.rest_seconds != null) parts.push({ unit: 'rest', value: formatRest(be.rest_seconds) })

  return parts
}

function daySummary(day: ViewDay) {
  const exercises = day.blocks.reduce((n, b) => n + b.block_exercises.length, 0)
  if (exercises === 0) return null
  return `${exercises} exercise${exercises !== 1 ? 's' : ''} in ${day.blocks.length} block${day.blocks.length !== 1 ? 's' : ''}`
}

// ─── Program ──────────────────────────────────────────────────────────────

export type Video = { url: string; name: string }

// Extra content under an exercise (null for none)
export type StepExtra = (be: ViewBlockExercise) => React.ReactNode

export function ProgramView({ program, activeDay, setActiveDay, nav, stepExtra, children }: {
  program:      ProgramViewModel
  activeDay:    number
  setActiveDay: (index: number) => void
  nav?:         React.ReactNode   // top-right links, e.g. back to the athlete's program list
  stepExtra?:   StepExtra         // athlete app: records + "Log" under tracked exercises
  children?:    React.ReactNode   // dialogs that need the page frame's styles
}) {
  const [video, setVideo] = useState<Video | null>(null)
  // Which way the last day change went, so the new day slides in from that side
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const { athlete, days } = program
  const currentDay        = days[activeDay] ?? null
  const hasTabs           = days.length > 1

  const goTo = (index: number) => {
    if (index === activeDay || index < 0 || index >= days.length) return
    setDirection(index > activeDay ? 'next' : 'prev')
    setActiveDay(index)
  }

  // Phones: a clear horizontal swipe over the day moves to the next or previous day
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !hasTabs) return
    const t  = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    goTo(activeDay + (dx < 0 ? 1 : -1))
  }

  return (
    <LogShell nav={nav}>
      <header className="log-head">
        <div className="log-head-text">
          <h1 className="log-athlete">{athlete?.name} {athlete?.surname}</h1>
          <p className="log-program">{program.title}</p>
          {program.coach_name && <p className="log-coach">Coached by <strong className="log-coach-name">{program.coach_name}</strong></p>}
        </div>
        <AthleteAvatar src={athlete?.avatar_url} name={athlete?.name} surname={athlete?.surname} />
      </header>

      {program.description && <p className="log-brief">{program.description}</p>}

      {hasTabs && <DayChips days={days} activeDay={activeDay} onSelect={goTo} />}

      {!currentDay ? (
        <p className="log-empty">Your coach hasn’t added any days yet.</p>
      ) : (
        // Keyed by day so the slide-in plays on every switch
        <section
          key={currentDay.id}
          id="log-day"
          className={`log-day from-${direction}`}
          role={hasTabs ? 'tabpanel' : undefined}
          aria-labelledby={hasTabs ? `day-tab-${activeDay}` : undefined}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="day-head">
            <h2 className="day-name">{currentDay.name}</h2>
            {daySummary(currentDay) && <p className="day-summary">{daySummary(currentDay)}</p>}
          </div>

          {currentDay.blocks.length === 0 ? (
            <p className="log-empty">Nothing planned for this day yet.</p>
          ) : (
            currentDay.blocks.map(block => (
              <BlockPath key={block.id} block={block} onPlayVideo={setVideo} stepExtra={stepExtra} />
            ))
          )}

          {hasTabs && activeDay < days.length - 1 && (
            <button className="day-next" onClick={() => goTo(activeDay + 1)}>
              <span>Next: {days[activeDay + 1].name}</span>
              <ArrowRight size={18} aria-hidden />
            </button>
          )}
        </section>
      )}

      <LogFooter />

      {video && <VideoModal video={video} onClose={() => setVideo(null)} />}
      {children}
    </LogShell>
  )
}

// ─── Athlete photo ────────────────────────────────────────────────────────
// Photos come in every shape (tall phone shots to wide landscapes), so the circle's crop is anchored near the top,
// where a face usually is. Ours go through Next's optimizer (an 80–96px circle needs ~250px, not a 1 MB original);
// anything else is shown as is. No photo, or one that fails to load → the athlete's initials in the same circle.
// alt="": the athlete's name is right beside it.

const OPTIMIZABLE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/`   // public and signed links

export function AthleteAvatar({ src, name, surname }: { src?: string | null; name?: string; surname?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)   // per photo: another athlete's still loads
  const initials = [name, surname].map(s => s?.trim()[0] ?? '').join('').toUpperCase()

  if (!src || failedSrc === src) {
    if (!initials) return null
    return <span className="log-avatar log-avatar-initials" aria-hidden>{initials}</span>
  }
  return (
    <Image
      className="log-avatar" src={src} alt="" width={96} height={96} priority
      unoptimized={!src.startsWith(OPTIMIZABLE)} onError={() => setFailedSrc(src)}
    />
  )
}

// App name + "Built by …" at the bottom of the athlete pages (/me and every program page)
export function LogFooter() {
  return (
    <footer className="log-foot">
      <p className="log-foot-name">{APP_NAME}</p>
      <Credit className="log-credit" />
    </footer>
  )
}

// The page frame; also used for the loading and missing states
export function LogShell({ children, busy = false, nav }: {
  children: React.ReactNode
  busy?:    boolean
  nav?:     React.ReactNode
}) {
  return (
    <div className={`log ${manrope.variable}`}>
      <main className="log-inner" aria-busy={busy || undefined}>
        <div className="log-top">
          <p className="log-mark">{APP_SHORT_NAME}</p>
          {nav && <nav className="log-nav" aria-label="Account">{nav}</nav>}
        </div>
        {children}
      </main>
    </div>
  )
}

export function ProgramLoader() {
  return (
    <LogShell busy>
      <div className="log-loading" role="status">
        <span className="sr-only">Loading your program</span>
        <div className="log-loading-bar is-title" />
        <div className="log-loading-bar is-sub" />
        {[0, 1, 2].map(i => <div key={i} className="log-loading-bar is-row" />)}
      </div>
    </LogShell>
  )
}

export function ProgramNotFound() {
  return (
    <LogShell>
      <h1 className="log-athlete">Program not found</h1>
      <p className="log-brief">This link may be old or mistyped. Ask your coach to send it again.</p>
    </LogShell>
  )
}

// ─── Day chips ────────────────────────────────────────────────────────────
// A tablist; arrow keys move between days.

function DayChips({ days, activeDay, onSelect }: {
  days:      ViewDay[]
  activeDay: number
  onSelect:  (index: number) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent) => {
    const last = days.length - 1
    let next = -1
    if (e.key === 'ArrowRight') next = activeDay === last ? 0 : activeDay + 1
    if (e.key === 'ArrowLeft')  next = activeDay === 0 ? last : activeDay - 1
    if (e.key === 'Home')       next = 0
    if (e.key === 'End')        next = last
    if (next < 0) return
    e.preventDefault()
    onSelect(next)
    refs.current[next]?.focus()
  }

  return (
    <div className="day-chips" role="tablist" aria-label="Program days" onKeyDown={onKeyDown}>
      {days.map((d, i) => (
        <button
          key={d.id}
          ref={el => { refs.current[i] = el }}
          id={`day-tab-${i}`}
          role="tab"
          aria-selected={activeDay === i}
          aria-controls="log-day"
          tabIndex={activeDay === i ? 0 : -1}
          className={`day-chip${activeDay === i ? ' is-active' : ''}`}
          onClick={() => onSelect(i)}
        >
          {d.name}
        </button>
      ))}
    </div>
  )
}

// ─── Block ────────────────────────────────────────────────────────────────

function BlockPath({ block, onPlayVideo, stepExtra }: {
  block:       ViewBlock
  onPlayVideo: (video: Video) => void
  stepExtra?:  StepExtra
}) {
  return (
    <div className="block">
      <h3 className="block-name">{block.name}</h3>
      {block.block_exercises.length > 0 && (
        <ol className="path">
          {block.block_exercises.map((be, i) => (
            <ExerciseStep key={be.id} be={be} index={i} onPlayVideo={onPlayVideo} extra={stepExtra?.(be)} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ExerciseStep({ be, index, onPlayVideo, extra }: {
  be:          ViewBlockExercise
  index:       number
  onPlayVideo: (video: Video) => void
  extra?:      React.ReactNode
}) {
  const name  = be.exercise?.name ?? '—'
  const parts = prescription(be)

  return (
    // --i staggers the slide-in, capped so long blocks don't wait
    <li className="step" style={{ '--i': Math.min(index, 8) } as React.CSSProperties}>
      <div className="step-body">
        <p className="step-name">{name}</p>
        {parts.length > 0 && (
          <p className="step-work">
            {parts.map((p, i) => (
              <span key={i} className="step-part">
                {p.unit === 'rest'
                  ? <><span className="step-unit">rest</span> <span className="step-value">{p.value}</span></>
                  : <><span className="step-value">{p.value}</span>{p.unit && <> <span className="step-unit">{p.unit}</span></>}</>}
              </span>
            ))}
          </p>
        )}
        {be.notes && <p className="step-note">{be.notes}</p>}
        {extra}
      </div>
      {be.exercise?.video_url && (
        <button
          className="step-play"
          aria-label={`Watch ${name}`}
          onClick={() => onPlayVideo({ url: be.exercise.video_url!, name })}
        >
          <Play size={16} fill="currentColor" aria-hidden />
        </button>
      )}
    </li>
  )
}

// ─── VideoModal ───────────────────────────────────────────────────────────
// Also used by the admin exercise library and picker, so it keeps the app's dark styling.
//
// 2026-10: on some iPhones (Safari and the installed app) no r2.dev video loaded, even under fresh addresses, while
// incognito on the same phone played them — something on those devices refuses the r2.dev host. So:
// - a video first loads from r2.dev (with VIDEO_CACHE_KEY: a new value is a new address for every device);
// - if that fails, it switches on its own to the app's address (/api/video/<key>, read from R2 by the server),
//   and the device remembers that, so its next videos start there;
// - only if that fails too it shows the error with "Try again". Every failure is reported
//   (POST /api/video-error → server log, "via" says which address failed).

const VIDEO_CACHE_KEY = '2026-10-06'
const VIA_APP_KEY     = 'video-via-app'   // localStorage: this device needs the app's address
const MAX_REPORTS     = 3                 // per opened video, so repeated "Try again" doesn't flood the log

type Via = 'direct' | 'app'

function withParam(url: string, key: string, value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`
}

// The app's own address for an R2 video, or null for anything else (e.g. old Supabase links)
function appVideoUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.hostname.endsWith('.r2.dev') ? `/api/video${u.pathname}` : null
  } catch { return null }
}

function deviceNeedsApp() {
  try { return localStorage.getItem(VIA_APP_KEY) === '1' } catch { return false }
}
function rememberNeedsApp() {
  try { localStorage.setItem(VIA_APP_KEY, '1') } catch {}
}

// MediaError codes: 1 aborted, 2 network, 3 decode, 4 not supported / not found
function reportVideoError(url: string, via: Via, video: HTMLVideoElement, attempt: number) {
  const body = JSON.stringify({
    code:       video.error?.code ?? 0,
    message:    video.error?.message?.slice(0, 200) ?? '',
    network:    video.networkState,
    host:       (() => { try { return new URL(url, location.href).host } catch { return 'invalid' } })(),
    via,
    standalone: isInstalledApp(),
    attempt,
  })
  // A plain string goes as text/plain: a JSON-typed Blob isn't CORS-safelisted and some Chromium versions throw
  try { navigator.sendBeacon?.('/api/video-error', body) } catch {}
}

export function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const appUrl = appVideoUrl(video.url)
  const [via,        setVia]        = useState<Via>(() => appUrl && deviceNeedsApp() ? 'app' : 'direct')
  const [retryStamp, setRetryStamp] = useState<string | null>(null)
  const [attempt,    setAttempt]    = useState(0)
  const [failed,     setFailed]     = useState<number | null>(null)   // MediaError code, null while playing

  const base = via === 'app' && appUrl ? appUrl : video.url
  const src  = retryStamp ? withParam(base, 'r', retryStamp) : via === 'app' ? base : withParam(base, 'v', VIDEO_CACHE_KEY)

  const onError = (el: HTMLVideoElement) => {
    if (attempt < MAX_REPORTS) reportVideoError(src, via, el, attempt)
    setAttempt(a => a + 1)
    if (via === 'direct' && appUrl) {       // r2.dev failed here: use the app's address, now and for later videos
      rememberNeedsApp(); setVia('app'); setRetryStamp(null)
      return
    }
    setFailed(el.error?.code ?? 0)
  }

  // Retry under an address no cache has seen (the stamp is made here, not while rendering)
  const retry = () => { setRetryStamp(`${Date.now()}`); setFailed(null) }

  return (
    <Modal onClose={onClose} title={video.name} className="video-modal" overlayClassName="video-modal-overlay">
      <div className="video-modal-header">
        <div className="video-modal-title">{video.name}</div>
        <button className="video-modal-close" onClick={onClose} aria-label="Close video">
          <X size={18} aria-hidden />
        </button>
      </div>
      {failed !== null ? (
        <div className="video-error" role="alert">
          <p className="video-error-title">This video didn’t load</p>
          <p className="video-error-text">
            {failed === 2 ? 'Check your connection and try again.' : 'Try again in a moment.'} If it keeps failing,
            let your coach know.
          </p>
          <button className="video-error-retry" onClick={retry}><RotateCcw size={15} aria-hidden /> Try again</button>
        </div>
      ) : (
        <video
          key={src} className="video-player" src={src} controls playsInline preload="metadata"
          onError={e => onError(e.currentTarget)}
        />
      )}
    </Modal>
  )
}
