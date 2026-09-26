'use client'

// components/ProgramEditor.tsx
// Shared editor UI used by both NewProgramPage and EditProgramPage.
// Receives everything it needs from useEditProgram — pure render component.

import { UIBlock, UIDay, UIBlockExercise } from '@/lib/viewModels/EditProgramViewModel'
import { uploadExerciseVideo, removeExerciseVideo } from '@/lib/services/exerciseService'
import { useState } from 'react'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'
import './programEditor.css'

interface ProgramEditorProps {
  // State
  title:          string
  description:    string
  visibleDays:    UIDay[]
  totalExercises: number
  saving:         boolean
  error:          string | null
  catalogue:      ExerciseCatalogueItem[]
  // Labels
  saveLabel:      string
  // Callbacks — passed straight from useEditProgram
  setDescription: (v: string) => void
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
  title, description, visibleDays, totalExercises, saving, error, catalogue,
  saveLabel, breadcrumb,
  setTitle, setDescription, addDay, removeDay, updateDayName,
  addBlock, removeBlock, updateBlockName,
  addExercise, removeExercise, updateExField,
  resolveExerciseId,
  onSave, onBack,
}: ProgramEditorProps) {
  return (
    <>
      <div className="page">
        <header className="header">
          <div className="header-left">
            <button className="btn-back" onClick={onBack}>← Back</button>
            <span className="breadcrumb">/ {breadcrumb}</span>
          </div>
          <div className="header-right">
            <div className="pill">Days<span>{visibleDays.length}</span></div>
            <div className="pill">Exercises<span>{totalExercises}</span></div>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </header>

        <main className="page-body">
          {error && <div className="alert-error"><span>⚠</span> {error}</div>}

          <div className="eyebrow">Program Title</div>
          <input
            className="editor-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled Program"
          />

          <textarea
            className="editor-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description — goals, notes, methodology…"
            rows={2}
          />

          <div className="editor-days">
            {visibleDays.map((day, di) => (
              <div key={day._tempId} className="editor-day">
                <div className="editor-day-header">
                  <span className="editor-day-index">Day {di + 1}</span>
                  <input
                    className="editor-day-name"
                    value={day.name}
                    onChange={e => updateDayName(day._tempId, e.target.value)}
                    placeholder="Day name"
                  />
                  <div className="editor-day-actions">
                    <button className="btn-add-block" onClick={() => addBlock(day._tempId)}>+ Block</button>
                    <button className="btn-icon" onClick={() => removeDay(day._tempId)}>×</button>
                  </div>
                </div>

                <div className="editor-day-body">
                  {day.blocks.filter(b => !b._deleted).length === 0 && (
                    <div className="editor-empty">No blocks yet — add one above</div>
                  )}
                  {day.blocks.filter(b => !b._deleted).map(block => (
                    <div key={block._tempId} className="editor-block">
                      <div className="editor-block-header">
                        <div className="block-dot" />
                        <input
                          className="editor-block-name"
                          value={block.name}
                          onChange={e => updateBlockName(day._tempId, block._tempId, e.target.value)}
                          placeholder="Block name"
                        />
                        <button className="btn-add-ex" onClick={() => addExercise(day._tempId, block._tempId)}>
                          + Exercise
                        </button>
                        <button className="btn-icon" onClick={() => removeBlock(day._tempId, block._tempId)}>×</button>
                      </div>

                      {block.exercises.filter(e => !e._deleted).length > 0 && (
                        <div className="editor-exercises">
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
              <span className="add-day-plus">+</span> Add Day
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
  const [progress,   setProgress]   = useState(0)
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
    setProgress(0)
    setUploadErr(null)
    try {
      const url = await uploadExerciseVideo(be.exerciseId, file, (pct) => setProgress(pct))
      onVideoUploaded(url)
    } catch (err: any) {
      setUploadErr(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  const hasVideo  = !!be.video_url
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
            (uploading || removing || !canUpload ? ' uploading' : '') +
            (uploading ? ' in-progress' : '')
          }
          title={
            !canUpload ? 'Select an exercise first'
            : hasVideo ? 'Has video — click to replace'
            : 'Upload video'
          }
          // Progress bar fill — the only style that depends on runtime state
          style={uploading ? {
            background: `linear-gradient(to right, #1a2a1a ${progress}%, #101a10 ${progress}%)`,
          } : undefined}
        >
          {uploading ? `${progress}%` : hasVideo ? '▶ Video' : '+ Video'}
          <input
            type="file"
            accept="video/*"
            hidden
            disabled={uploading || removing || !canUpload}
            onChange={handleVideoUpload}
          />
        </label>
        {hasVideo && !uploading && (
          <button
            className="btn-remove-video"
            onClick={handleVideoRemove}
            disabled={removing || uploading}
            title="Remove video"
          >
            {removing ? '…' : '×'}
          </button>
        )}
        {uploadErr && <span className="video-error" title={uploadErr}>!</span>}
      </div>

      <input className="ex-input ex-input-sm" placeholder="—" value={be.sets || ''}         onChange={e => updateExField(dayTempId, blockTempId, idx, 'sets',         e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.reps || ''}         onChange={e => updateExField(dayTempId, blockTempId, idx, 'reps',         e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.kg || ''}           onChange={e => updateExField(dayTempId, blockTempId, idx, 'kg',           e.target.value)} />
      <input className="ex-input ex-input-sm" placeholder="—" value={be.rest_seconds || ''}  onChange={e => updateExField(dayTempId, blockTempId, idx, 'rest_seconds',  e.target.value)} />
      <button className="ex-remove" onClick={() => removeExercise(dayTempId, blockTempId, idx)}>×</button>
    </div>
  )
}
