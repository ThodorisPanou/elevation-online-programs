'use client'

// components/ProgramEditor.tsx
// Shared editor UI used by both NewProgramPage and EditProgramPage.
// Receives everything it needs from useEditProgram — pure render component.

import { UIBlock, UIDay, UIBlockExercise } from '@/lib/viewModels/EditProgramViewModel'
import { uploadExerciseVideo, removeExerciseVideo } from '@/lib/services/exerciseService'
import { useState } from 'react'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'

interface ProgramEditorProps {
  // State
  title:          string
  visibleDays:    UIDay[]
  totalExercises: number
  saving:         boolean
  error:          string | null
  catalogue:      ExerciseCatalogueItem[]
  // Labels
  saveLabel:      string
  breadcrumb:     string
  // Callbacks — passed straight from useEditProgram
  setTitle:       (v: string) => void
  addDay:         () => void
  removeDay:      (tempId: string) => void
  updateDayName:  (tempId: string, name: string) => void
  addBlock:       (dayTempId: string) => void
  removeBlock:    (dayTempId: string, blockTempId: string) => void
  updateBlockName:(dayTempId: string, blockTempId: string, name: string) => void
  addExercise:    (dayTempId: string, blockTempId: string) => void
  removeExercise: (dayTempId: string, blockTempId: string, idx: number) => void
  updateExField:     (dayTempId: string, blockTempId: string, idx: number, field: keyof UIBlockExercise, value: string) => void
  resolveExerciseId: (dayTempId: string, blockTempId: string, idx: number, name: string) => void
  onSave:         () => void
  onBack:         () => void
}

export default function ProgramEditor({
  title, visibleDays, totalExercises, saving, error, catalogue,
  saveLabel, breadcrumb,
  setTitle, addDay, removeDay, updateDayName,
  addBlock, removeBlock, updateBlockName,
  addExercise, removeExercise, updateExField,
  resolveExerciseId,
  onSave, onBack,
}: ProgramEditorProps) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .pg-root { font-family: 'Barlow', sans-serif; background: #0d0d0f; min-height: 100vh; color: #e8e8ec; }

        .pg-header {
          position: sticky; top: 0; z-index: 50;
          background: rgba(13,13,15,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid #1f1f26;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .pg-header-left { display: flex; align-items: center; gap: 16px; }
        .btn-back {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #6b6b7a; background: none; border: none; cursor: pointer;
          padding: 6px 10px; border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .btn-back:hover { color: #e8e8ec; background: #1a1a22; }
        .pg-breadcrumb {
          font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase; color: #3a3a4a;
        }
        .pg-stats { display: flex; gap: 20px; align-items: center; }
        .stat-pill {
          font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #4a4a5a;
          background: #16161e; border: 1px solid #1f1f2a; padding: 4px 10px; border-radius: 20px;
        }
        .stat-pill span { color: #a0a0c0; margin-left: 4px; }
        .btn-save {
          font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: #e8ff4a; color: #0d0d0f; border: none;
          padding: 8px 22px; border-radius: 8px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-save:hover { background: #f5ff80; transform: translateY(-1px); }
        .btn-save:disabled { background: #2a2a35; color: #4a4a5a; cursor: not-allowed; transform: none; }

        .pg-body { max-width: 860px; margin: 0 auto; padding: 36px 24px 80px; }
        .section-label {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: #4a4a5a; margin-bottom: 10px;
        }
        .title-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 800;
          background: transparent; border: none; border-bottom: 2px solid #1f1f2a;
          color: #e8e8ec; width: 100%; padding: 4px 0 10px; outline: none;
          transition: border-color 0.2s; margin-bottom: 36px;
        }
        .title-input::placeholder { color: #2a2a38; }
        .title-input:focus { border-bottom-color: #e8ff4a; }

        .error-bar {
          display: flex; align-items: center; gap: 8px;
          background: #2a0f0f; border: 1px solid #5a1a1a; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 24px; font-size: 13px; color: #ff7070;
        }

        .days-container { display: flex; flex-direction: column; gap: 16px; }

        .day-card {
          background: #111116; border: 1px solid #1a1a24; border-radius: 12px; overflow: hidden;
          transition: border-color 0.2s;
        }
        .day-card:focus-within { border-color: #2a2a40; }
        .day-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; background: #14141a; border-bottom: 1px solid #1a1a24;
        }
        .day-index {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 800;
          letter-spacing: 0.15em; text-transform: uppercase; color: #e8ff4a;
          background: #1e2010; border: 1px solid #3a4010;
          padding: 3px 8px; border-radius: 4px; white-space: nowrap;
        }
        .day-name-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700;
          background: transparent; border: none; color: #e8e8ec; flex: 1; outline: none; min-width: 0;
        }
        .day-name-input::placeholder { color: #2a2a3a; }
        .day-header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        .btn-add-block {
          font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #6a6aaa;
          background: #16162a; border: 1px solid #22223a; padding: 5px 12px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .btn-add-block:hover { color: #aaaae8; background: #1e1e38; border-color: #2e2e50; }
        .btn-icon {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid transparent; border-radius: 6px;
          color: #3a3a4a; cursor: pointer; font-size: 16px; transition: all 0.15s;
        }
        .btn-icon:hover { color: #ff6060; border-color: #3a1a1a; background: #1a1010; }

        .day-body { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
        .empty-day { font-size: 13px; color: #2a2a3a; font-style: italic; padding: 4px 0; }

        .block-card { background: #0d0d12; border: 1px solid #18182a; border-radius: 8px; overflow: hidden; }
        .block-header {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-bottom: 1px solid #18182a;
        }
        .block-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a4aaa; flex-shrink: 0; }
        .block-name-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          background: transparent; border: none; color: #8888cc; flex: 1; outline: none;
        }
        .block-name-input::placeholder { color: #222230; }
        .btn-add-ex {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #4a4a6a;
          background: none; border: none; cursor: pointer; padding: 3px 8px; border-radius: 4px;
          transition: color 0.15s;
        }
        .btn-add-ex:hover { color: #8888cc; }

        .block-exercises { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
        .ex-header-row {
          display: grid; grid-template-columns: 1fr 90px 52px 52px 52px 52px 24px;
          gap: 6px; padding: 0 0 4px;
        }
        .ex-col-label {
          font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #2e2e3e; text-align: center;
        }
        .ex-col-label:first-child { text-align: left; }
        .exercise-row {
          display: grid; grid-template-columns: 1fr 90px 52px 52px 52px 52px 24px;
          gap: 6px; align-items: center;
        }
        .ex-input {
          font-family: 'Barlow', sans-serif; font-size: 13px;
          background: #131320; border: 1px solid #1e1e2e; color: #c0c0d8;
          padding: 6px 8px; border-radius: 6px; outline: none; width: 100%;
          transition: border-color 0.15s;
        }
        .ex-input::placeholder { color: #2a2a3a; font-size: 12px; }
        .ex-input:focus { border-color: #3a3a5a; }
        .ex-input-sm { text-align: center; padding: 6px 4px; }
        .ex-remove {
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
          background: none; border: none; color: #2a2a3a; cursor: pointer; border-radius: 4px;
          font-size: 14px; transition: color 0.15s;
        }
        .ex-remove:hover { color: #ff6060; }

        .video-cell { display: flex; align-items: center; gap: 6px; }
        .btn-upload-video {
          display: flex; align-items: center; gap: 4px;
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          background: #12121e; color: #4a4a6a; border: 1px solid #1e1e32;
          padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-upload-video:hover { color: #8888cc; border-color: #3a3a5a; background: #18183a; }
        .btn-upload-video.has-video { color: #60c060; border-color: #1a3a1a; background: #101a10; }
        .btn-upload-video.has-video:hover { color: #ff7070; border-color: #3a1a1a; background: #1a1010; }
        .btn-upload-video.uploading { opacity: 0.5; cursor: not-allowed; }
        .btn-remove-video {
          width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid #3a1a1a; border-radius: 4px;
          color: #6a3a3a; cursor: pointer; font-size: 13px; transition: all 0.15s; flex-shrink: 0;
        }
        .btn-remove-video:hover:not(:disabled) { color: #ff6060; border-color: #5a2020; background: #1a1010; }
        .btn-remove-video:disabled { opacity: 0.4; cursor: not-allowed; }

        .add-day-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 14px; background: transparent;
          border: 1px dashed #1f1f2a; border-radius: 12px; color: #3a3a4a;
          font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;
          transition: all 0.2s; margin-top: 4px;
        }
        .add-day-btn:hover { border-color: #e8ff4a44; color: #e8ff4a; background: #12130a; }
      `}</style>

      <div className="pg-root">
        <header className="pg-header">
          <div className="pg-header-left">
            <button className="btn-back" onClick={onBack}>← Back</button>
            <span className="pg-breadcrumb">/ {breadcrumb}</span>
          </div>
          <div className="pg-stats">
            <div className="stat-pill">Days<span>{visibleDays.length}</span></div>
            <div className="stat-pill">Exercises<span>{totalExercises}</span></div>
            <button className="btn-save" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </header>

        <main className="pg-body">
          {error && <div className="error-bar"><span>⚠</span> {error}</div>}

          <div className="section-label">Program Title</div>
          <input
            className="title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled Program"
          />

          <div className="days-container">
            {visibleDays.map((day, di) => (
              <div key={day._tempId} className="day-card">
                <div className="day-header">
                  <span className="day-index">Day {di + 1}</span>
                  <input
                    className="day-name-input"
                    value={day.name}
                    onChange={e => updateDayName(day._tempId, e.target.value)}
                    placeholder="Day name"
                  />
                  <div className="day-header-actions">
                    <button className="btn-add-block" onClick={() => addBlock(day._tempId)}>+ Block</button>
                    <button className="btn-icon" onClick={() => removeDay(day._tempId)}>×</button>
                  </div>
                </div>

                <div className="day-body">
                  {day.blocks.filter(b => !b._deleted).length === 0 && (
                    <div className="empty-day">No blocks yet — add one above</div>
                  )}
                  {day.blocks.filter(b => !b._deleted).map(block => (
                    <div key={block._tempId} className="block-card">
                      <div className="block-header">
                        <div className="block-dot" />
                        <input
                          className="block-name-input"
                          value={block.name}
                          onChange={e => updateBlockName(day._tempId, block._tempId, e.target.value)}
                          placeholder="Block name"
                        />
                        <button className="btn-add-ex" onClick={() => addExercise(day._tempId, block._tempId)}>
                          + Exercise
                        </button>
                        <button
                          className="btn-icon"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => removeBlock(day._tempId, block._tempId)}
                        >×</button>
                      </div>

                      {block.exercises.filter(e => !e._deleted).length > 0 && (
                        <div className="block-exercises">
                          <div className="ex-header-row">
                            <div className="ex-col-label">Exercise</div>
                            <div className="ex-col-label">Video</div>
                            <div className="ex-col-label">Sets</div>
                            <div className="ex-col-label">Reps</div>
                            <div className="ex-col-label">Kg</div>
                            <div className="ex-col-label">Rest</div>
                            <div />
                          </div>
                          {block.exercises.map((be, idx) =>
                            be._deleted ? null : (
                              <ExerciseRow
                                key={idx}
                                be={be}
                                idx={idx}
                                dayTempId={day._tempId}
                                blockTempId={block._tempId}
                                updateExField={updateExField}
                                resolveExerciseId={resolveExerciseId}
                                removeExercise={removeExercise}
                                onVideoUploaded={(url) => updateExField(day._tempId, block._tempId, idx, 'video_url', url)}
                                onVideoRemoved={() => updateExField(day._tempId, block._tempId, idx, 'video_url', '')}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button className="add-day-btn" onClick={addDay}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Day
            </button>
          </div>
        </main>
      </div>

      <datalist id="exList">
        {catalogue.map(ex => <option key={ex.id} value={ex.name} />)}
      </datalist>
    </>
  )
}

// ─── ExerciseRow sub-component ────────────────────────────────────────────
// Handles its own upload state to avoid re-rendering the whole editor on upload.

function ExerciseRow({
  be, idx, dayTempId, blockTempId,
  updateExField, resolveExerciseId, removeExercise, onVideoUploaded, onVideoRemoved,
}: {
  be:                UIBlockExercise
  idx:               number
  dayTempId:         string
  blockTempId:       string
  updateExField:     (d: string, b: string, i: number, f: keyof UIBlockExercise, v: string) => void
  resolveExerciseId: (d: string, b: string, i: number, name: string) => void
  removeExercise:    (d: string, b: string, i: number) => void
  onVideoUploaded:   (url: string) => void
  onVideoRemoved:    () => void
}) {
  const [uploading,  setUploading]  = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [uploadErr,  setUploadErr]  = useState<string | null>(null)

  const handleVideoRemove = async () => {
    if (!be.exerciseId) return
    setRemoving(true)
    try {
      await removeExerciseVideo(be.exerciseId)
      onVideoRemoved()
    } catch (err: any) {
      setUploadErr(err.message ?? 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !be.exerciseId) return
    setUploading(true)
    setUploadErr(null)
    try {
      const url = await uploadExerciseVideo(be.exerciseId, file)
      onVideoUploaded(url)
    } catch (err: any) {
      setUploadErr(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const hasVideo = !!be.video_url
  const canUpload = !!be.exerciseId

  return (
    <div className="exercise-row">
      <input
        list="exList"
        className="ex-input"
        value={be.exerciseName || ''}
        placeholder="Search exercise…"
        onChange={e => updateExField(dayTempId, blockTempId, idx, 'exerciseName', e.target.value)}
        onBlur={e => resolveExerciseId(dayTempId, blockTempId, idx, e.target.value)}
      />

      {/* Video upload/delete cell */}
      <div className="video-cell">
        <label
          className={
            'btn-upload-video' +
            (hasVideo ? ' has-video' : '') +
            (uploading || removing || !canUpload ? ' uploading' : '')
          }
          title={
            !canUpload ? 'Select an exercise first'
            : hasVideo ? 'Has video — click to replace'
            : 'Upload video'
          }
        >
          {uploading ? '↑…' : hasVideo ? '▶ Video' : '+ Video'}
          <input
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            disabled={uploading || removing || !canUpload}
            onChange={handleVideoUpload}
          />
        </label>
        {hasVideo && (
          <button
            className="btn-remove-video"
            onClick={handleVideoRemove}
            disabled={removing || uploading}
            title="Remove video"
          >
            {removing ? '…' : '×'}
          </button>
        )}
        {uploadErr && <span style={{ fontSize: 10, color: '#ff6060' }} title={uploadErr}>!</span>}
      </div>

      <input className="ex-input ex-input-sm" placeholder="—" value={be.sets || ''}         onChange={e => updateExField(dayTempId, blockTempId, idx, 'sets',         e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.reps || ''}         onChange={e => updateExField(dayTempId, blockTempId, idx, 'reps',         e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.kg || ''}           onChange={e => updateExField(dayTempId, blockTempId, idx, 'kg',           e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.rest_seconds || ''}  onChange={e => updateExField(dayTempId, blockTempId, idx, 'rest_seconds',  e.target.value)} />
      <button className="ex-remove" onClick={() => removeExercise(dayTempId, blockTempId, idx)}>×</button>
    </div>
  )
}
