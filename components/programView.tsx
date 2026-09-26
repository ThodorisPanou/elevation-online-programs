'use client'

// components/programView.tsx
// Read-only program UI shared by the public page and the admin program page.

import React, { useState } from 'react'
import { ProgramViewModel, ViewBlock, ViewDay } from '@/lib/viewModels/ProgramViewModel'
import Modal from '@/components/modal'
import { ClipboardList, Play, StickyNote, X } from 'lucide-react'
import './programView.css'

// 45 → "45s", 90 → "1:30", 120 → "2:00"
function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// ─── Hero ─────────────────────────────────────────────────────────────────

export function ProgramHero({ program, compact = false }: {
  program: ProgramViewModel
  compact?: boolean
}) {
  const { athlete, days } = program
  const initials = `${athlete?.name?.[0] ?? ''}${athlete?.surname?.[0] ?? ''}`

  return (
    <div className={`program-hero${compact ? ' compact' : ''}`}>
      <div className="program-hero-inner">
        <div className="program-badge"><ClipboardList size={13} aria-hidden /> Training Program</div>
        <h1 className="program-title">{program.title}</h1>
        {program.description && (
          <div className="program-description">{program.description}</div>
        )}
        <div className="program-meta">
          <div className="program-athlete">
            <div className={`avatar ${compact ? 'avatar-sm' : 'avatar-xl'}`}>
              {athlete?.avatar_url ? <img src={athlete.avatar_url} alt="" /> : initials}
            </div>
            <div className="program-athlete-info">
              {!compact && <div className="program-athlete-label">Athlete</div>}
              <div className="program-athlete-name">{athlete?.name} {athlete?.surname}</div>
            </div>
          </div>
          <div className="program-meta-divider" />
          <div className="program-meta-text">
            {new Date(program.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>
          <div className="program-meta-divider" />
          <div className="program-meta-text">{days.length} day{days.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Day tabs + blocks ────────────────────────────────────────────────────

export type Video = { url: string; name: string }

export function ProgramDays({ days, activeDay, setActiveDay, belowHeader = false }: {
  days:         ViewDay[]
  activeDay:    number
  setActiveDay: (index: number) => void
  belowHeader?: boolean  // offset the sticky tabs when the page has a sticky header
}) {
  const [video, setVideo] = useState<Video | null>(null)
  const currentDay = days[activeDay] ?? null

  return (
    <>
      {days.length > 0 && (
        <div className={`day-tabs-wrap${belowHeader ? ' below-header' : ''}`}>
          <div className="day-tabs" role="tablist" aria-label="Program days">
            {days.map((d, i) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={activeDay === i}
                className={`day-tab${activeDay === i ? ' active' : ''}`}
                onClick={() => setActiveDay(i)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="page-body">
        {!currentDay ? (
          <div className="empty-day">No days in this program</div>
        ) : (
          <>
            <h2 className="day-title">{currentDay.name}</h2>
            {currentDay.blocks.length === 0 ? (
              <div className="empty-day">No blocks</div>
            ) : (
              <div className="blocks-list">
                {currentDay.blocks.map((block, bi) => (
                  <BlockCard key={block.id} block={block} index={bi} onPlayVideo={setVideo} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {video && <VideoModal video={video} onClose={() => setVideo(null)} />}
    </>
  )
}

// ─── BlockCard ────────────────────────────────────────────────────────────
// Only shows the Sets/Reps/Kg/Rest columns that have at least one value.

function BlockCard({ block, index, onPlayVideo }: {
  block:       ViewBlock
  index:       number
  onPlayVideo: (video: Video) => void
}) {
  const exercises = block.block_exercises
  const showSets  = exercises.some(be => be.sets != null && be.sets !== 0)
  const showReps  = exercises.some(be => be.reps != null && be.reps !== '')
  const showKg    = exercises.some(be => be.kg != null && be.kg !== '')
  const showRest  = exercises.some(be => be.rest_seconds != null)
  const colSpan   = 1 + [showSets, showReps, showKg, showRest].filter(Boolean).length

  return (
    <div className="block-card" style={{ animationDelay: `${index * 0.07}s` }}>
      <div className="block-header">
        <div className="block-dot" />
        <div className="block-name">{block.name}</div>
      </div>
      {exercises.length > 0 && (
        <table className="ex-table">
          <thead className="ex-thead">
            <tr>
              <th>Exercise</th>
              {showSets && <th>Sets</th>}
              {showReps && <th>Reps</th>}
              {showKg   && <th>Kg</th>}
              {showRest && <th>Rest</th>}
            </tr>
          </thead>
          <tbody>
            {exercises.map(be => (
              <React.Fragment key={be.id}>
                <tr className="ex-row">
                  <td className="ex-name">
                    <span className="ex-name-text">{be.exercise?.name ?? '—'}</span>
                    {be.exercise?.video_url && (
                      <button
                        className="btn-play"
                        aria-label={`Play video: ${be.exercise?.name ?? 'exercise'}`}
                        onClick={() => onPlayVideo({ url: be.exercise.video_url!, name: be.exercise?.name ?? '' })}
                      >
                        <Play size={12} aria-hidden /> Video
                      </button>
                    )}
                  </td>
                  {showSets && <td className="ex-cell"><span className={be.sets != null ? 'ex-cell-val' : ''}>{be.sets ?? '—'}</span></td>}
                  {showReps && <td className="ex-cell"><span className={be.reps ? 'ex-cell-val' : ''}>{be.reps ?? '—'}</span></td>}
                  {showKg   && <td className="ex-cell"><span className={be.kg ? 'ex-cell-val' : ''}>{be.kg ?? '—'}</span></td>}
                  {showRest && <td className="ex-cell"><span className={be.rest_seconds != null ? 'ex-cell-val' : ''}>{be.rest_seconds != null ? formatRest(be.rest_seconds) : '—'}</span></td>}
                </tr>
                {be.notes && (
                  <tr className="ex-row">
                    <td colSpan={colSpan} className="ex-notes">
                      <StickyNote size={13} aria-hidden /> {be.notes}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── VideoModal ───────────────────────────────────────────────────────────

export function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title={video.name} className="video-modal" overlayClassName="video-modal-overlay">
      <div className="video-modal-header">
        <div className="video-modal-title">{video.name}</div>
        <button className="video-modal-close" onClick={onClose} aria-label="Close video">
          <X size={18} aria-hidden />
        </button>
      </div>
      <video className="video-player" src={video.url} controls playsInline />
    </Modal>
  )
}
