'use client'
import React, { useState } from 'react'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useProgram } from '@/lib/hooks/useProgram'
import { ViewDay, ViewBlock, ViewBlockExercise } from '@/lib/viewModels/ProgramViewModel'

export default function AdminProgramPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params?.id as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(id)
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');
        body{background:#0d0d0f;margin:0;}
        .loader{display:flex;align-items:center;justify-content:center;min-height:100vh;gap:8px;}
        .loader-dot{width:8px;height:8px;border-radius:50%;background:#e8ff4a;animation:bounce 0.8s infinite alternate;}
        .loader-dot:nth-child(2){animation-delay:0.2s}.loader-dot:nth-child(3){animation-delay:0.4s}
        @keyframes bounce{to{transform:translateY(-12px);opacity:0.4;}}
      `}</style>
      <div className="loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
    </>
  )

  if (notFound || !program) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&display=swap');
        body{background:#0d0d0f;margin:0;color:#e8e8ec;font-family:'Barlow Condensed',sans-serif;}
        .nf{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:12px;}
        .nf-code{font-size:80px;font-weight:800;color:#1f1f2a;}
        .nf-msg{font-size:20px;letter-spacing:0.1em;text-transform:uppercase;color:#3a3a4a;}
      `}</style>
      <div className="nf"><div className="nf-code">404</div><div className="nf-msg">Program not found</div></div>
    </>
  )

  const { athlete, days } = program
  const athleteId  = program.id  // we need to navigate back — use athlete relation if available
  const currentDay = days[activeDay] ?? null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}

        .root{font-family:'Barlow',sans-serif;background:#0d0d0f;min-height:100vh;color:#e8e8ec;}

        .header{
          position:sticky;top:0;z-index:50;
          background:rgba(13,13,15,0.92);backdrop-filter:blur(12px);
          border-bottom:1px solid #1f1f26;
          padding:0 24px;height:60px;
          display:flex;align-items:center;justify-content:space-between;
        }
        .header-left{display:flex;align-items:center;gap:12px;}
        .btn-back{
          display:flex;align-items:center;gap:6px;
          font-family:'Barlow Condensed',sans-serif;
          font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
          color:#6b6b7a;background:none;border:none;cursor:pointer;
          padding:6px 10px;border-radius:6px;transition:color 0.15s,background 0.15s;
        }
        .btn-back:hover{color:#e8e8ec;background:#1a1a22;}
        .btn-edit{
          font-family:'Barlow Condensed',sans-serif;
          font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          background:#1a1e0a;color:#b0c040;border:1px solid #2a3010;
          padding:7px 18px;border-radius:8px;cursor:pointer;transition:all 0.15s;
        }
        .btn-edit:hover{background:#222810;border-color:#4a5818;color:#e8ff4a;}

        .hero{background:linear-gradient(160deg,#111116 0%,#0d0d0f 100%);border-bottom:1px solid #1a1a24;padding:36px 24px 28px;}
        .hero-inner{max-width:860px;margin:0 auto;}
        .hero-badge{
          display:inline-flex;align-items:center;gap:6px;
          font-family:'Barlow Condensed',sans-serif;
          font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
          color:#e8ff4a;background:#1e2010;border:1px solid #3a4010;
          padding:4px 10px;border-radius:4px;margin-bottom:16px;
        }
        .hero-title{
          font-family:'Barlow Condensed',sans-serif;
          font-size:clamp(28px,5vw,48px);font-weight:800;color:#e8e8ec;line-height:1;margin-bottom:16px;
        }
        .hero-meta{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
        .hero-athlete{display:flex;align-items:center;gap:10px;}
        .hero-avatar{
          width:32px;height:32px;border-radius:50%;
          background:#1a1a2a;border:2px solid #2a2a3a;
          display:flex;align-items:center;justify-content:center;
          font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#4a4a6a;
          overflow:hidden;flex-shrink:0;
        }
        .hero-avatar img{width:100%;height:100%;object-fit:cover;}
        .hero-athlete-name{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:#a0a0c0;}
        .hero-divider{width:1px;height:14px;background:#2a2a3a;}
        .hero-date{font-size:12px;color:#3a3a4a;}

        .day-tabs-wrap{
          position:sticky;top:60px;z-index:40;
          background:rgba(13,13,15,0.95);backdrop-filter:blur(12px);
          border-bottom:1px solid #1a1a24;
        }
        .day-tabs{max-width:860px;margin:0 auto;display:flex;overflow-x:auto;padding:0 24px;scrollbar-width:none;}
        .day-tabs::-webkit-scrollbar{display:none;}
        .day-tab{
          font-family:'Barlow Condensed',sans-serif;
          font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:#3a3a4a;background:none;border:none;
          padding:14px 18px;cursor:pointer;
          border-bottom:2px solid transparent;white-space:nowrap;
          transition:color 0.15s,border-color 0.15s;
        }
        .day-tab:hover{color:#8888cc;}
        .day-tab.active{color:#e8ff4a;border-bottom-color:#e8ff4a;}

        .body{max-width:860px;margin:0 auto;padding:28px 24px 80px;}
        .day-title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;color:#e8e8ec;margin-bottom:18px;}
        .blocks-list{display:flex;flex-direction:column;gap:14px;}

        .block-card{background:#111116;border:1px solid #1a1a24;border-radius:12px;overflow:hidden;animation:fadeUp 0.3s ease both;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .block-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#14141a;border-bottom:1px solid #1a1a24;}
        .block-dot{width:6px;height:6px;border-radius:50%;background:#4a4aaa;flex-shrink:0;}
        .block-name{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#7070bb;}

        .ex-table{width:100%;border-collapse:collapse;}
        .ex-thead th{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#2e2e3e;padding:8px 16px;text-align:left;border-bottom:1px solid #18182a;}
        .ex-thead th:not(:first-child){text-align:center;}
        .ex-row{border-bottom:1px solid #16162a;transition:background 0.12s;}
        .ex-row:last-child{border-bottom:none;}
        .ex-row:hover{background:#13131a;}
        .ex-name{padding:12px 16px;font-size:14px;font-weight:500;color:#c8c8e0;}
        .ex-cell{padding:12px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;color:#8888aa;}
        .ex-cell-val{color:#c0c0e0;}
        .ex-notes{padding:4px 16px 10px;font-size:12px;color:#3a3a5a;font-style:italic;}

        .empty-day{text-align:center;padding:48px;color:#2a2a3a;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;}
      `}</style>

      <div className="root">
        <header className="header">
          <div className="header-left">
            <button className="btn-back" onClick={() => router.back()}>← Back</button>
          </div>
          <button
            className="btn-edit"
            onClick={() => router.push(`/admin/programs/${program.athlete?.id ?? ''}/edit/${program.id}`)}
          >
            Edit Program
          </button>
        </header>

        <div className="hero">
          <div className="hero-inner">
            <div className="hero-badge">📋 Training Program</div>
            <div className="hero-title">{program.title}</div>
            <div className="hero-meta">
              <div className="hero-athlete">
                <div className="hero-avatar">
                  {athlete?.avatar_url
                    ? <img src={athlete.avatar_url} alt="" />
                    : `${athlete?.name?.[0] ?? ''}${athlete?.surname?.[0] ?? ''}`
                  }
                </div>
                <div className="hero-athlete-name">{athlete?.name} {athlete?.surname}</div>
              </div>
              <div className="hero-divider" />
              <div className="hero-date">
                {new Date(program.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="hero-divider" />
              <div className="hero-date">{days.length} day{days.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

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

        <div className="body">
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
                      {block.block_exercises.length > 0 && (
                        <table className="ex-table">
                          <thead className="ex-thead">
                            <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Kg</th><th>Rest</th></tr>
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
                                  <td className="ex-cell"><span className={be.kg ? 'ex-cell-val' : ''}>{be.kg ?? '—'}</span></td>
                                  <td className="ex-cell"><span className={be.rest_seconds != null ? 'ex-cell-val' : ''}>{be.rest_seconds != null ? `${be.rest_seconds}s` : '—'}</span></td>
                                </tr>
                                {be.notes && (
                                  <tr className="ex-row">
                                    <td colSpan={5} className="ex-notes">📝 {be.notes}</td>
                                  </tr>
                                )}
                              </React.Fragment>
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