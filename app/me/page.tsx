'use client'

// app/me/page.tsx
// The athlete's home: all their programs, newest first. Read-only.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { LogShell } from '@/components/programView'
import { useAthleteMe } from '@/lib/hooks/useAthleteMe'
import { MyProgramSummary, getMyPrograms } from '@/lib/services/athleteAppService'
import { MeNav } from './meNav'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function MyProgramsPage() {
  const { athlete } = useAthleteMe()
  const [programs, setPrograms] = useState<MyProgramSummary[] | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    getMyPrograms().then(setPrograms).catch(() => setError('We couldn’t load your programs. Check your connection and try again.'))
  }, [])

  return (
    <LogShell nav={<MeNav />}>
      <header className="log-head">
        <div className="log-head-text">
          <h1 className="log-athlete">{athlete.name} {athlete.surname}</h1>
          {athlete.coach_name && <p className="log-program">Coached by {athlete.coach_name}</p>}
        </div>
        {athlete.avatar_url && <img className="log-avatar" src={athlete.avatar_url} alt="" />}
      </header>

      <h2 className="me-section">Your programs</h2>

      {error ? (
        <p className="log-empty">{error}</p>
      ) : !programs ? (
        <div className="log-loading" role="status">
          <span className="sr-only">Loading your programs</span>
          {[0, 1, 2].map(i => <div key={i} className="log-loading-bar is-row" />)}
        </div>
      ) : programs.length === 0 ? (
        <p className="log-empty">No programs yet. When your coach adds one, it shows up here.</p>
      ) : (
        <ul className="me-programs">
          {programs.map((p, i) => (
            <li key={p.id}>
              <Link href={`/me/program/${p.id}`} className={`me-program${i === 0 ? ' is-latest' : ''}`}>
                <span className="me-program-text">
                  <span className="me-program-title">{p.title}</span>
                  <span className="me-program-meta">
                    {i === 0 && <span className="me-program-latest">Latest</span>}
                    {p.day_count} day{p.day_count !== 1 ? 's' : ''} · {fmtDate(p.created_at)}
                  </span>
                </span>
                <ChevronRight size={20} aria-hidden className="me-program-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="log-foot">Glabro · Elevation Performance</footer>
    </LogShell>
  )
}
