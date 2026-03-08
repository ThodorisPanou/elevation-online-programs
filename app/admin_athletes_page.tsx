'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAthletePrograms } from '@/lib/hooks/useAthleteProgram'

export default function AthleteProgramsPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId = params?.athlete_id as string

  const { programs, athlete, loading, error } = useAthletePrograms(athleteId)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

  const fmt = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .root { font-family: 'Barlow', sans-serif; background: #0d0d0f; min-height: 100vh; color: #e8e8ec; }

        .header {
          position: sticky; top: 0; z-index: 50;
          background: rgba(13,13,15,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid #1f1f26;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .btn-back {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #6b6b7a; background: none; border: none; cursor: pointer;
          padding: 6px 10px; border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .btn-back:hover { color: #e8e8ec; background: #1a1a22; }
        .btn-new {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #e8ff4a; color: #0d0d0f; border: none;
          padding: 8px 22px; border-radius: 8px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-new:hover { background: #f5ff80; transform: translateY(-1px); }

        .body { max-width: 860px; margin: 0 auto; padding: 36px 24px 80px; }

        .hero {
          display: flex; align-items: center; gap: 20px;
          padding-bottom: 28px; margin-bottom: 32px;
          border-bottom: 1px solid #1a1a24;
        }
        .avatar {
          width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;
          background: #1a1a2a; border: 2px solid #2a2a3a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; color: #4a4a6a;
          overflow: hidden;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .hero-info { flex: 1; }
        .hero-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 32px; font-weight: 800; color: #e8e8ec; line-height: 1;
        }
        .hero-sub {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
          color: #4a4a5a; margin-top: 4px;
        }
        .count-pill {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #4a4a5a; background: #16161e; border: 1px solid #1f1f2a;
          padding: 5px 12px; border-radius: 20px;
        }
        .count-pill span { color: #a0a0c0; margin-left: 4px; }

        .section-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #4a4a5a; margin-bottom: 14px;
        }

        .list { display: flex; flex-direction: column; gap: 10px; }

        .program-card {
          background: #111116; border: 1px solid #1a1a24; border-radius: 12px;
          padding: 18px 20px; display: flex; align-items: center; gap: 16px;
          transition: border-color 0.2s;
          animation: fadeUp 0.3s ease both;
        }
        .program-card:hover { border-color: #2a2a40; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        .prog-index {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
          color: #3a3a4a; min-width: 32px;
        }
        .prog-info { flex: 1; min-width: 0; }
        .prog-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px; font-weight: 700; color: #e0e0ec;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .prog-date { font-size: 12px; color: #3a3a4a; margin-top: 3px; }

        .prog-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .btn-view {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #16162a; color: #8888cc; border: 1px solid #22223a;
          padding: 7px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .btn-view:hover { background: #1e1e3a; border-color: #3a3a60; color: #aaaae8; }
        .btn-edit {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #1a1e0a; color: #b0c040; border: 1px solid #2a3010;
          padding: 7px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .btn-edit:hover { background: #222810; border-color: #4a5818; color: #e8ff4a; }

        .skeleton { background: linear-gradient(90deg,#16161e 25%,#1e1e28 50%,#16161e 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:12px; height:72px; }
        @keyframes shimmer { to { background-position:-200% 0; } }

        .empty {
          text-align: center; padding: 64px 24px;
          border: 1px dashed #1f1f2a; border-radius: 12px;
        }
        .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.3; }
        .empty-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px; font-weight: 700; color: #3a3a4a;
          letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px;
        }
        .empty-sub { font-size: 13px; color: #2a2a3a; }

        .error-bar {
          display: flex; align-items: center; gap: 8px;
          background: #2a0f0f; border: 1px solid #5a1a1a; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #ff7070;
        }
      `}</style>

      <div className="root">
        <header className="header">
          <button className="btn-back" onClick={() => router.push('/admin/athletes')}>← Athletes</button>
          <button className="btn-new" onClick={() => router.push(`/admin/programs/${athleteId}/new`)}>
            + New Program
          </button>
        </header>

        <main className="body">
          <div className="hero">
            <div className="avatar">
              {athlete?.avatar_url
                ? <img src={athlete.avatar_url} alt="" />
                : athlete ? `${athlete.name[0]}${athlete.surname[0]}` : '?'
              }
            </div>
            <div className="hero-info">
              <div className="hero-name">{athlete?.fullName ?? '—'}</div>
              <div className="hero-sub">Training Programs</div>
            </div>
            <div className="count-pill">Programs<span>{programs.length}</span></div>
          </div>

          {error && <div className="error-bar">⚠ {error}</div>}

          <div className="section-label">All Programs</div>

          {loading
            ? <div className="list">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ animationDelay:`${i*0.1}s` }} />)}</div>
            : programs.length === 0
              ? (
                <div className="empty">
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No Programs Yet</div>
                  <div className="empty-sub">Create the first program for this athlete</div>
                </div>
              )
              : (
                <div className="list">
                  {programs.map((p, i) => (
                    <div key={p.id} className="program-card" style={{ animationDelay:`${i*0.05}s` }}>
                      <div className="prog-index">#{String(i+1).padStart(2,'0')}</div>
                      <div className="prog-info">
                        <div className="prog-title">{p.title}</div>
                        <div className="prog-date">{fmt(p.created_at)}</div>
                      </div>
                      <div className="prog-actions">
                        <button className="btn-view" onClick={() => router.push(`/program/${p.public_token}`)}>
                          View
                        </button>
                        <button className="btn-edit" onClick={() => router.push(`/admin/programs/${athleteId}/edit/${p.id}`)}>
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </main>
      </div>
    </>
  )
}
