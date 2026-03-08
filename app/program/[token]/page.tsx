'use client'
import React, { useState } from 'react'

import { useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { ViewDay, ViewBlock, ViewBlockExercise } from '@/lib/viewModels/ProgramViewModel'

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(guid)
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null)

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');
        body { background:#0d0d0f; margin:0; }
        .loader { display:flex; align-items:center; justify-content:center; min-height:100vh; gap:8px; }
        .loader-dot { width:8px; height:8px; border-radius:50%; background:#e8ff4a; animation:bounce 0.8s infinite alternate; }
        .loader-dot:nth-child(2){animation-delay:0.2s} .loader-dot:nth-child(3){animation-delay:0.4s}
        @keyframes bounce { to { transform:translateY(-12px); opacity:0.4; } }
      `}</style>
      <div className="loader">
        <div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/>
      </div>
    </>
  )

  if (notFound || !program) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&display=swap');
        body { background:#0d0d0f; margin:0; color:#e8e8ec; font-family:'Barlow Condensed',sans-serif; }
        .nf { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; gap:12px; }
        .nf-code { font-size:80px; font-weight:800; color:#1f1f2a; }
        .nf-msg { font-size:20px; letter-spacing:0.1em; text-transform:uppercase; color:#3a3a4a; }
      `}</style>
      <div className="nf">
        <div className="nf-code">404</div>
        <div className="nf-msg">Program not found</div>
      </div>
    </>
  )

  const { athlete, days } = program
  const currentDay = days[activeDay] ?? null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .pv-root { font-family:'Barlow',sans-serif; background:#0d0d0f; min-height:100vh; color:#e8e8ec; }

        
        .pv-hero-inner { max-width:860px; margin:0 auto; }
        .pv-badge {
          display:inline-flex; align-items:center; gap:6px;
          font-family:'Barlow Condensed',sans-serif;
          font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase;
          color:#e8ff4a; background:#1e2010; border:1px solid #3a4010;
          padding:4px 10px; border-radius:4px; margin-bottom:20px;
        }
        .pv-title {
          font-family:'Barlow Condensed',sans-serif;
          font-size:clamp(32px,6vw,56px); font-weight:800; letter-spacing:-0.01em;
          color:#e8e8ec; line-height:1; margin-bottom:20px;
        }
        .pv-hero {
          background: linear-gradient(160deg,#111116 0%,#0d0d0f 100%);
          border-bottom:1px solid #1a1a24; padding:48px 24px 40px;
        }
        .pv-meta { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-top:28px; padding-top:24px; border-top:1px solid #1a1a24; }
        .pv-athlete { display:flex; align-items:center; gap:16px; }
        .pv-avatar {
          width:80px; height:80px; border-radius:50%;
          background: linear-gradient(135deg, #1e1e3a, #12121e);
          border: 2px solid #3a3a5a;
          box-shadow: 0 0 0 5px #131320, 0 8px 32px rgba(80,80,180,0.2);
          display:flex; align-items:center; justify-content:center;
          font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:800; color:#6a6aaa;
          overflow:hidden; flex-shrink:0;
        }
        .pv-avatar img { width:100%; height:100%; object-fit:cover; }
        .pv-athlete-info { display:flex; flex-direction:column; gap:3px; }
        .pv-athlete-label {
          font-family:'Barlow Condensed',sans-serif;
          font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase;
          color:#3a3a5a;
        }
        .pv-athlete-name {
          font-family:'Barlow Condensed',sans-serif;
          font-size:26px; font-weight:800; letter-spacing:0.01em; color:#d0d0f0; line-height:1;
        }
        .pv-divider { width:1px; height:28px; background:#222230; margin:0 4px; }
        .pv-date { font-size:13px; color:#3a3a5a; font-family:'Barlow Condensed',sans-serif; letter-spacing:0.05em; }

        .day-tabs-wrap {
          position:sticky; top:0; z-index:40;
          background:rgba(13,13,15,0.95); backdrop-filter:blur(12px);
          border-bottom:1px solid #1a1a24;
        }
        .day-tabs {
          max-width:860px; margin:0 auto; display:flex;
          overflow-x:auto; padding:0 24px; scrollbar-width:none;
        }
        .day-tabs::-webkit-scrollbar { display:none; }
        .day-tab {
          font-family:'Barlow Condensed',sans-serif;
          font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
          color:#3a3a4a; background:none; border:none;
          padding:16px 18px; cursor:pointer;
          border-bottom:2px solid transparent; white-space:nowrap;
          transition:color 0.15s, border-color 0.15s;
        }
        .day-tab:hover { color:#8888cc; }
        .day-tab.active { color:#e8ff4a; border-bottom-color:#e8ff4a; }

        .pv-body { max-width:860px; margin:0 auto; padding:32px 24px 80px; }
        .day-title {
          font-family:'Barlow Condensed',sans-serif;
          font-size:28px; font-weight:800; letter-spacing:0.02em;
          color:#e8e8ec; margin-bottom:20px;
        }
        .blocks-list { display:flex; flex-direction:column; gap:16px; }

        .block-card {
          background:#111116; border:1px solid #1a1a24; border-radius:12px; overflow:hidden;
          animation:fadeUp 0.3s ease both;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .block-header {
          display:flex; align-items:center; gap:10px;
          padding:12px 16px; background:#14141a; border-bottom:1px solid #1a1a24;
        }
        .block-dot { width:6px; height:6px; border-radius:50%; background:#4a4aaa; flex-shrink:0; }
        .block-name {
          font-family:'Barlow Condensed',sans-serif;
          font-size:14px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#7070bb;
        }

        .ex-table { width:100%; border-collapse:collapse; }
        .ex-thead th {
          font-family:'Barlow Condensed',sans-serif;
          font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;
          color:#2e2e3e; padding:8px 16px; text-align:left; border-bottom:1px solid #18182a;
        }
        .ex-thead th:not(:first-child) { text-align:center; }
        .ex-row { border-bottom:1px solid #16162a; transition:background 0.12s; }
        .ex-row:last-child { border-bottom:none; }
        .ex-row:hover { background:#13131a; }
        .ex-name { padding:12px 16px; font-size:14px; font-weight:500; color:#c8c8e0; }
        .ex-cell {
          padding:12px 8px; text-align:center;
          font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; color:#8888aa;
        }
        .ex-cell-val { color:#c0c0e0; }
        .ex-notes { padding:4px 16px 10px; font-size:12px; color:#3a3a5a; font-style:italic; }

        
        /* ── Video Modal ── */
        .video-modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.9); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: fadeIn 0.15s ease;
        }
        .video-modal {
          background: #0d0d0f; border: 1px solid #2a2a3a; border-radius: 16px;
          padding: 20px; width: 100%; max-width: 680px;
          animation: slideUp 0.2s ease;
        }
        .video-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .video-modal-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px; font-weight: 700; color: #e8e8ec; letter-spacing: 0.04em;
        }
        .video-modal-close {
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          background: #1a1a22; border: 1px solid #2a2a32; border-radius: 8px;
          color: #6a6a7a; cursor: pointer; font-size: 18px; transition: all 0.15s;
        }
        .video-modal-close:hover { color: #e8e8ec; background: #22222e; }
        .video-player { width: 100%; border-radius: 10px; background: #000; display: block; }
        .btn-play {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #60a060; background: #0e180e; border: 1px solid #1a3a1a;
          padding: 3px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
          vertical-align: middle; margin-left: 6px;
        }
        .btn-play:hover { color: #80cc80; border-color: #2a5a2a; background: #121e12; }

        .empty-day {
          text-align:center; padding:48px; color:#2a2a3a;
          font-family:'Barlow Condensed',sans-serif;
          font-size:16px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase;
        }
      `}</style>

      <div className="pv-root">
        {/* Hero */}
        <div className="pv-hero">
          <div className="pv-hero-inner">
            <div className="pv-badge">📋 Training Program</div>
            <h1 className="pv-title">{program.title}</h1>
            <div className="pv-meta">
              <div className="pv-athlete">
                <div className="pv-avatar">
                  {athlete?.avatar_url
                    ? <img src={athlete.avatar_url} alt="" />
                    : `${athlete?.name?.[0] ?? ''}${athlete?.surname?.[0] ?? ''}`
                  }
                </div>
                <div className="pv-athlete-info">
                  <div className="pv-athlete-label">Athlete</div>
                  <div className="pv-athlete-name">{athlete?.name} {athlete?.surname}</div>
                </div>
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

        {/* Day tabs */}
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

        {/* Content */}
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
                    <div key={block.id} className="block-card" style={{ animationDelay: `${bi * 0.07}s` }}>
                      <div className="block-header">
                        <div className="block-dot" />
                        <div className="block-name">{block.name}</div>
                      </div>
                      {block.block_exercises.length > 0 && (() => {
                          const showKg   = block.block_exercises.some(be => be.kg != null && be.kg !== '')
                          const showRest = block.block_exercises.some(be => be.rest_seconds != null)
                          const colSpanCount = 3 + (showKg ? 1 : 0) + (showRest ? 1 : 0)
                          return (
                            <table className="ex-table">
                              <thead className="ex-thead">
                                <tr>
                                  <th>Exercise</th>
                                  <th>Sets</th>
                                  <th>Reps</th>
                                  {showKg   && <th>Kg</th>}
                                  {showRest && <th>Rest</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {block.block_exercises.map((be: ViewBlockExercise) => (
                                  <React.Fragment key={be.id}>
                                    <tr className="ex-row">
                                      <td className="ex-name">
                                        {be.exercise?.name ?? '—'}
                                        {be.exercise?.video_url && (
                                          <button
                                            className="btn-play"
                                            onClick={() => setVideoModal({ url: be.exercise.video_url!, name: be.exercise?.name ?? '' })}
                                          >
                                            ▶ Video
                                          </button>
                                        )}
                                      </td>
                                      <td className="ex-cell"><span className={be.sets != null ? 'ex-cell-val' : ''}>{be.sets ?? '—'}</span></td>
                                      <td className="ex-cell"><span className={be.reps ? 'ex-cell-val' : ''}>{be.reps ?? '—'}</span></td>
                                      {showKg   && <td className="ex-cell"><span className={be.kg ? 'ex-cell-val' : ''}>{be.kg ?? '—'}</span></td>}
                                      {showRest && <td className="ex-cell"><span className={be.rest_seconds != null ? 'ex-cell-val' : ''}>{be.rest_seconds != null ? `${be.rest_seconds}s` : '—'}</span></td>}
                                    </tr>
                                    {be.notes && (
                                      <tr className="ex-row">
                                        <td colSpan={colSpanCount} className="ex-notes">📝 {be.notes}</td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          )
                        })()}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Video Modal */}
      {videoModal && (
        <div className="video-modal-overlay" onClick={() => setVideoModal(null)}>
          <div className="video-modal" onClick={e => e.stopPropagation()}>
            <div className="video-modal-header">
              <div className="video-modal-title">{videoModal.name}</div>
              <button className="video-modal-close" onClick={() => setVideoModal(null)}>×</button>
            </div>
            <video
              className="video-player"
              src={videoModal.url}
              controls
              autoPlay
            />
          </div>
        </div>
      )}
    </>
  )
}