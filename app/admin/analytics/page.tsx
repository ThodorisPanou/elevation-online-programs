'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getAnalytics } from '@/lib/services/analyticsService'
import {
  AnalyticsViewModel,
  ExerciseUsage,
  STALE_AFTER_DAYS,
  buildMonthReview,
  monthKey,
  shiftMonth,
} from '@/lib/viewModels/AnalyticsViewModel'
import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, TriangleAlert } from 'lucide-react'
import './analytics.css'

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtNum  = (n: number, digits = 1) => Number.isInteger(n) ? String(n) : n.toFixed(digits)

export default function AnalyticsPage() {
  const router = useRouter()
  const [vm,      setVm]      = useState<AnalyticsViewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [month,   setMonth]   = useState(() => monthKey(new Date()))

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      try {
        setVm(await getAnalytics())
      } catch (e: any) {
        setError(e.message ?? 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const review = useMemo(() => vm && buildMonthReview(vm, month), [vm, month])

  const kpis = useMemo(() => {
    if (!vm) return null
    const thisMonth = vm.months[vm.months.length - 1].count
    const lastMonth = vm.months[vm.months.length - 2].count
    const active    = vm.athletes.filter(a => a.daysSinceLast !== null && a.daysSinceLast <= STALE_AFTER_DAYS).length
    return {
      programs:  vm.programs.length,
      thisMonth, lastMonth,
      athletes:  vm.athletes.length,
      active,
      avg:       vm.athletes.length ? vm.programs.length / vm.athletes.length : 0,
    }
  }, [vm])

  const stale = useMemo(
    () => vm?.athletes.filter(a => a.daysSinceLast === null || a.daysSinceLast > STALE_AFTER_DAYS) ?? [],
    [vm],
  )

  const currentKey = monthKey(new Date())

  return (
    <div className="page">
      <header className="header">
        <button className="btn-back" onClick={() => router.push('/admin/athletes')}>
          <ArrowLeft size={16} aria-hidden /> Athletes
        </button>
        {kpis && <div className="pill">Programs<span>{kpis.programs}</span></div>}
      </header>

      <main className="page-body an-body">
        <div className="eyebrow">Admin</div>
        <h1 className="page-heading">Analytics</h1>

        {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

        {loading && (
          <div className="an-kpis">
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i*0.08}s` }} />)}
          </div>
        )}

        {vm && kpis && review && (
          <>
            {/* ── KPI tiles ── */}
            <section className="an-kpis" aria-label="Summary">
              <Kpi label="Total programs" value={kpis.programs}
                sub={<Delta current={kpis.thisMonth} previous={kpis.lastMonth} suffix="this month" />} />
              <Kpi label="Athletes" value={kpis.athletes}
                sub={`${kpis.active} active in last ${STALE_AFTER_DAYS} days`} />
              <Kpi label="Programs / athlete" value={fmtNum(kpis.avg)}
                sub={`max ${vm.athletes[0]?.programCount ?? 0}`} />
              <Kpi label="Exercises" value={vm.totalExercises}
                sub={`${vm.exercisesWithVideo} with video`} />
            </section>

            {/* ── Programs per month ── */}
            <section className="an-card">
              <div className="an-card-head">
                <h2 className="an-card-title">Programs created per month</h2>
                <span className="an-card-hint">Last 12 months · click a bar to review it</span>
              </div>
              <MonthChart
                months={vm.months}
                selected={month}
                onSelect={setMonth}
              />
            </section>

            {/* ── Month review ── */}
            <section className="an-card">
              <div className="an-card-head">
                <h2 className="an-card-title">Month review</h2>
                <div className="an-month-nav">
                  <button className="btn-icon" aria-label="Previous month" onClick={() => setMonth(m => shiftMonth(m, -1))}>
                    <ChevronLeft size={18} aria-hidden />
                  </button>
                  <span className="an-month-label">{review.month.long}</span>
                  <button className="btn-icon" aria-label="Next month" disabled={month >= currentKey}
                    onClick={() => setMonth(m => shiftMonth(m, 1))}>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="an-review-stats">
                <Stat label="Programs" value={review.programs.length}
                  sub={<Delta current={review.programs.length} previous={review.previousCount} suffix="vs prev. month" />} />
                <Stat label="Athletes served" value={review.athletesServed} />
                <Stat label="New athletes" value={review.newAthletes} />
                <Stat label="Avg days / program" value={fmtNum(review.avgDays)} />
              </div>

              {review.programs.length === 0 ? (
                <div className="an-empty">No programs created in {review.month.long}.</div>
              ) : (
                <div className="an-review-grid">
                  <div>
                    <h3 className="an-sub-title">Programs created</h3>
                    <ul className="an-list">
                      {review.programs.map(p => (
                        <li key={p.id}>
                          <button className="an-list-row" onClick={() => router.push(`/admin/program/${p.id}`)}>
                            <span className="an-list-main">
                              <span className="an-list-title">{p.title}</span>
                              <span className="an-list-meta">{p.athleteName} · {p.dayCount} {p.dayCount === 1 ? 'day' : 'days'}</span>
                            </span>
                            <span className="an-list-date">{fmtDate(p.createdAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="an-sub-title">Most used exercises</h3>
                    <BarList items={review.topExercises} empty="No exercises added yet" />
                  </div>
                </div>
              )}
            </section>

            <div className="an-two-col">
              {/* ── Programs per athlete ── */}
              <section className="an-card">
                <div className="an-card-head">
                  <h2 className="an-card-title">Programs per athlete</h2>
                </div>
                {vm.athletes.length === 0
                  ? <div className="an-empty">No athletes yet.</div>
                  : (
                    <ul className="an-bars">
                      {vm.athletes.map(a => (
                        <li key={a.id}>
                          <button className="an-bar-row" onClick={() => router.push(`/admin/programs/${a.id}`)}
                            title={a.lastProgramAt ? `Last program: ${fmtDate(a.lastProgramAt)}` : 'No programs yet'}>
                            <span className="an-bar-label">{a.fullName}</span>
                            <span className="an-bar-track">
                              <span className="an-bar-fill"
                                style={{ width: `${(a.programCount / Math.max(1, vm.athletes[0].programCount)) * 100}%` }} />
                            </span>
                            <span className="an-bar-value">{a.programCount}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>

              {/* ── Top exercises overall ── */}
              <section className="an-card">
                <div className="an-card-head">
                  <h2 className="an-card-title">Top exercises</h2>
                  <span className="an-card-hint">All time</span>
                </div>
                <BarList items={vm.topExercises} empty="No exercises used yet" />
              </section>
            </div>

            {/* ── Needs attention ── */}
            <section className="an-card">
              <div className="an-card-head">
                <h2 className="an-card-title">Needs a new program</h2>
                <span className="an-card-hint">No program in the last {STALE_AFTER_DAYS} days</span>
              </div>
              {stale.length === 0
                ? <div className="an-empty">Everyone is up to date.</div>
                : (
                  <ul className="an-list">
                    {stale.map(a => (
                      <li key={a.id}>
                        <button className="an-list-row" onClick={() => router.push(`/admin/programs/${a.id}`)}>
                          <span className="avatar avatar-sm">
                            {a.avatar_url ? <img src={a.avatar_url} alt="" /> : a.initials}
                          </span>
                          <span className="an-list-main">
                            <span className="an-list-title">{a.fullName}</span>
                            <span className="an-list-meta">
                              {a.lastProgramAt ? `Last program ${fmtDate(a.lastProgramAt)}` : 'Never had a program'}
                            </span>
                          </span>
                          <span className="an-stale-badge">
                            <CircleAlert size={13} aria-hidden />
                            {a.daysSinceLast === null ? 'None' : `${a.daysSinceLast}d`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="an-kpi">
      <div className="an-kpi-label">{label}</div>
      <div className="an-kpi-value">{value}</div>
      {sub && <div className="an-kpi-sub">{sub}</div>}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="an-stat">
      <div className="an-stat-value">{value}</div>
      <div className="an-stat-label">{label}</div>
      {sub && <div className="an-kpi-sub">{sub}</div>}
    </div>
  )
}

// "+3 this month" — sign + word carry the meaning, color only reinforces it
function Delta({ current, previous, suffix }: { current: number; previous: number; suffix: string }) {
  const diff = current - previous
  const cls  = diff > 0 ? 'up' : diff < 0 ? 'down' : ''
  return (
    <span>
      <span className={`an-delta ${cls}`}>{diff > 0 ? `+${diff}` : diff}</span> {suffix}
      <span className="an-delta-ctx"> ({current} vs {previous})</span>
    </span>
  )
}

function MonthChart({ months, selected, onSelect }: {
  months: { key: string; label: string; long: string; count: number }[]
  selected: string
  onSelect: (key: string) => void
}) {
  const max = Math.max(1, ...months.map(m => m.count))
  return (
    <div className="an-chart" role="group" aria-label="Programs created per month">
      {months.map(m => {
        const active = m.key === selected
        return (
          <button
            key={m.key}
            className={`an-col${active ? ' active' : ''}`}
            onClick={() => onSelect(m.key)}
            aria-pressed={active}
            aria-label={`${m.long}: ${m.count} programs`}
          >
            <span className="an-col-tip" aria-hidden>{m.long} · <strong>{m.count}</strong></span>
            <span className="an-col-plot">
              {active && <span className="an-col-value">{m.count}</span>}
              <span className="an-col-bar" style={{ height: m.count ? `${(m.count / max) * 100}%` : 0 }} />
            </span>
            <span className="an-col-label">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function BarList({ items, empty }: { items: ExerciseUsage[]; empty: string }) {
  if (items.length === 0) return <div className="an-empty">{empty}</div>
  const max = items[0].count
  return (
    <ul className="an-bars">
      {items.map(e => (
        <li key={e.id} className="an-bar-row" title={`Used ${e.count} times`}>
          <span className="an-bar-label">{e.name}</span>
          <span className="an-bar-track">
            <span className="an-bar-fill" style={{ width: `${(e.count / max) * 100}%` }} />
          </span>
          <span className="an-bar-value">{e.count}</span>
        </li>
      ))}
    </ul>
  )
}
