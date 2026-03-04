'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// ─── UI-layer view types (model files are never modified) ──────────────────
//
// The domain models (Program, ProgramDay, Block, BlockExercise, Exercise,
// Athlete) don't include joined relations as fields — they're kept minimal.
// Here we define read-only view shapes that reflect what Supabase returns
// for this specific query, typed explicitly so the render has full safety.

interface ViewExercise {
  id:   string
  name: string
}

interface ViewBlockExercise {
  id:           string
  sets?:        number
  reps?:        string
  kg?:          string
  rest_seconds?: number
  notes?:       string
  order_index:  number
  exercises:    ViewExercise
}

interface ViewBlock {
  id:              string
  name:            string
  order_index:     number
  block_exercises: ViewBlockExercise[]
}

interface ViewDay {
  id:          string
  name:        string
  order_index: number
  blocks:      ViewBlock[]
}

interface ViewAthlete {
  name:       string
  surname:    string
  avatar_url?: string
}

interface ViewProgram {
  id:          string
  title:       string
  created_at:  string
  athlete:     ViewAthlete       // matches Program.athlete?: Athlete
  program_days: ViewDay[]
}

// ───────────────────────────────────────────────────────────────────────────

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const [program,   setProgram]   = useState<ViewProgram | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [activeDay, setActiveDay] = useState(0)

  useEffect(() => {
    if (guid) fetchProgram()
  }, [guid])

  const fetchProgram = async () => {
    const QUERY = `
      id, title, created_at,
      athletes ( name, surname, avatar_url ),
      program_days (
        id, name, order_index,
        blocks (
          id, name, order_index,
          block_exercises (
            id, sets, reps, kg, rest_seconds, notes, order_index,
            exercises ( id, name )
          )
        )
      )
    `

    // Try public_token first, then fall back to id
    let raw: any = null

    const byToken = await supabase
      .from('programs')
      .select(QUERY)
      .eq('public_token', guid)
      .maybeSingle()

    if (byToken.data) {
      raw = byToken.data
    } else {
      const byId = await supabase
        .from('programs')
        .select(QUERY)
        .eq('id', guid)
        .maybeSingle()
      raw = byId.data
    }

    if (!raw) { setNotFound(true); setLoading(false); return }

    // Sort nested arrays and shape into ViewProgram
    const sorted: ViewProgram = {
      id:         raw.id,
      title:      raw.title,
      created_at: raw.created_at,
      // Supabase returns the joined table as `athletes` (table name), map to `athlete`
      athlete: raw.athletes as ViewAthlete,
      program_days: [...(raw.program_days ?? [])]
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((d: any): ViewDay => ({
          id:          d.id,
          name:        d.name,
          order_index: d.order_index,
          blocks: [...(d.blocks ?? [])]
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((b: any): ViewBlock => ({
              id:          b.id,
              name:        b.name,
              order_index: b.order_index,
              block_exercises: [...(b.block_exercises ?? [])]
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((be: any): ViewBlockExercise => ({
                  id:           be.id,
                  sets:         be.sets         ?? undefined,
                  reps:         be.reps         ?? undefined,
                  kg:           be.kg           ?? undefined,
                  rest_seconds: be.rest_seconds ?? undefined,
                  notes:        be.notes        ?? undefined,
                  order_index:  be.order_index,
                  exercises:    be.exercises as ViewExercise,
                })),
            })),
        })),
    }

    setProgram(sorted)
    setLoading(false)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;500&display=swap');
        body { background: #0d0d0f; margin: 0; }
        .loader { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .loader-dot { width: 8px; height: 8px; border-radius: 50%; background: #e8ff4a; margin: 0 4px; animation: bounce 0.8s infinite alternate; }
        .loader-dot:nth-child(2) { animation-delay: 0.2s; }
        .loader-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { to { transform: translateY(-12px); opacity: 0.4; } }
      `}</style>
      <div className="loader">
        <div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/>
      </div>
    </>
  )

  // ── Not found ─────────────────────────────────────────────────────────────

  if (notFound || !program) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&display=swap');
        body { background: #0d0d0f; margin: 0; color: #e8e8ec; font-family: 'Barlow Condensed', sans-serif; }
        .nf { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 12px; }
        .nf-code { font-size: 80px; font-weight: 800; color: #1f1f2a; }
        .nf-msg { font-size: 20px; letter-spacing: 0.1em; text-transform: uppercase; color: #3a3a4a; }
      `}</style>
      <div className="nf">
        <div className="nf-code">404</div>
        <div className="nf-msg">Program not found</div>
      </div>
    </>
  )

  // ── Derived ───────────────────────────────────────────────────────────────

  const { athlete, program_days: days } = program
  const currentDay = days[activeDay] ?? null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .pv-root { font-family: 'Barlow', sans-serif; background: #0d0d0f; min-height: 100vh; color: #e8e8ec; }

        .pv-hero {
          background: linear-gradient(160deg, #111116 0%, #0d0d0f 100%);
          border-bottom: 1px solid #1a1a24;
          padding: 40px 24px 32px;
        }
        .pv-hero-inner { max-width: 860px; margin: 0 auto; }

        .pv-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #e8ff4a; background: #1e2010; border: 1px solid #3a4010;
          padding: 4px 10px; border-radius: 4px; margin-bottom: 20px;
        }
        .pv-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(32px, 6vw, 56px); font-weight: 800; letter-spacing: -0.01em;
          color: #e8e8ec; line-height: 1; margin-bottom: 20px;
        }
        .pv-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .pv-athlete { display: flex; align-items: center; gap: 10px; }
        .pv-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: #1a1a2a; border: 2px solid #2a2a3a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 800; color: #4a4a6a;
          overflow: hidden; flex-shrink: 0;
        }
        .pv-athlete-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px; font-weight: 700; letter-spacing: 0.04em; color: #a0a0c0;
        }
        .pv-divider { width: 1px; height: 16px; background: #2a2a3a; }
        .pv-date { font-size: 13px; color: #3a3a4a; }

        .day-tabs-wrap {
          position: sticky; top: 0; z-index: 40;
          background: rgba(13,13,15,0.95); backdrop-filter: blur(12px);
          border-bottom: 1px solid #1a1a24;
        }
        .day-tabs {
          max-width: 860px; margin: 0 auto; display: flex;
          overflow-x: auto; padding: 0 24px; scrollbar-width: none;
        }
        .day-tabs::-webkit-scrollbar { display: none; }
        .day-tab {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #3a3a4a; background: none; border: none;
          padding: 16px 18px; cursor: pointer;
          border-bottom: 2px solid transparent; white-space: nowrap;
          transition: color 0.15s, border-color 0.15s;
        }
        .day-tab:hover { color: #8888cc; }
        .day-tab.active { color: #e8ff4a; border-bottom-color: #e8ff4a; }

        .pv-body { max-width: 860px; margin: 0 auto; padding: 32px 24px 80px; }

        .day-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px; font-weight: 800; letter-spacing: 0.02em;
          color: #e8e8ec; margin-bottom: 20px;
        }
        .blocks-list { display: flex; flex-direction: column; gap: 16px; }

        .block-card {
          background: #111116; border: 1px solid #1a1a24; border-radius: 12px; overflow: hidden;
          animation: fadeUp 0.3s ease both;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .block-header {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; background: #14141a; border-bottom: 1px solid #1a1a24;
        }
        .block-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a4aaa; flex-shrink: 0; }
        .block-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #7070bb;
        }

        .ex-table { width: 100%; border-collapse: collapse; }
        .ex-thead th {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #2e2e3e; padding: 8px 16px; text-align: left; border-bottom: 1px solid #18182a;
        }
        .ex-thead th:not(:first-child) { text-align: center; }

        .ex-row { border-bottom: 1px solid #16162a; transition: background 0.12s; }
        .ex-row:last-child { border-bottom: none; }
        .ex-row:hover { background: #13131a; }

        .ex-name { padding: 12px 16px; font-size: 14px; font-weight: 500; color: #c8c8e0; }
        .ex-cell {
          padding: 12px 8px; text-align: center;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px; font-weight: 700; color: #8888aa;
        }
        .ex-cell-val { color: #c0c0e0; }
        .ex-notes { padding: 4px 16px 10px; font-size: 12px; color: #3a3a5a; font-style: italic; }

        .empty-day {
          text-align: center; padding: 48px; color: #2a2a3a;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 16px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
        }
      `}</style>

      <div className="pv-root">

        {/* ── Hero ── */}
        <div className="pv-hero">
          <div className="pv-hero-inner">
            <div className="pv-badge">📋 Training Program</div>
            <h1 className="pv-title">{program.title}</h1>
            <div className="pv-meta">
              <div className="pv-athlete">
                <div className="pv-avatar">
                  {athlete?.avatar_url
                    ? <img src={athlete.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : `${athlete?.name?.[0] ?? ''}${athlete?.surname?.[0] ?? ''}`
                  }
                </div>
                <div className="pv-athlete-name">{athlete?.name} {athlete?.surname}</div>
              </div>
              <div className="pv-divider" />
              <div className="pv-date">
                {new Date(program.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
              <div className="pv-divider" />
              <div className="pv-date">{days.length} day{days.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        {/* ── Day Tabs ── */}
        {days.length > 0 && (
          <div className="day-tabs-wrap">
            <div className="day-tabs">
              {days.map((d: ViewDay, i: number) => (
                <button
                  key={d.id}
                  className={`day-tab${activeDay === i ? ' active' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="pv-body">
          {!currentDay ? (
            <div className="empty-day">No days in this program</div>
          ) : (
            <>
              <div className="day-title">{currentDay.name}</div>
              {currentDay.blocks.length === 0 ? (
                <div className="empty-day">No blocks</div>
              ) : (
                <div className="blocks-list">
                  {currentDay.blocks.map((block: ViewBlock, bi: number) => (
                    <div
                      key={block.id}
                      className="block-card"
                      style={{ animationDelay: `${bi * 0.07}s` }}
                    >
                      <div className="block-header">
                        <div className="block-dot" />
                        <div className="block-name">{block.name}</div>
                      </div>

                      {block.block_exercises.length > 0 && (
                        <table className="ex-table">
                          <thead className="ex-thead">
                            <tr>
                              <th>Exercise</th>
                              <th>Sets</th>
                              <th>Reps</th>
                              <th>Kg</th>
                              <th>Rest</th>
                            </tr>
                          </thead>
                          <tbody>
                            {block.block_exercises.map((be: ViewBlockExercise) => (
                              <>
                                <tr key={be.id} className="ex-row">
                                  <td className="ex-name">{be.exercises?.name ?? '—'}</td>
                                  <td className="ex-cell">
                                    <span className={be.sets != null ? 'ex-cell-val' : ''}>{be.sets ?? '—'}</span>
                                  </td>
                                  <td className="ex-cell">
                                    <span className={be.reps ? 'ex-cell-val' : ''}>{be.reps ?? '—'}</span>
                                  </td>
                                  <td className="ex-cell">
                                    <span className={be.kg ? 'ex-cell-val' : ''}>{be.kg ?? '—'}</span>
                                  </td>
                                  <td className="ex-cell">
                                    <span className={be.rest_seconds != null ? 'ex-cell-val' : ''}>
                                      {be.rest_seconds != null ? `${be.rest_seconds}s` : '—'}
                                    </span>
                                  </td>
                                </tr>
                                {be.notes && (
                                  <tr key={`${be.id}-notes`} className="ex-row">
                                    <td colSpan={5} className="ex-notes">📝 {be.notes}</td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
