'use client'

// components/ProgramEditor.tsx
// Shared editor UI used by both NewProgramPage and EditProgramPage.
// Receives everything it needs from useEditProgram — pure render component.

import { UIDay, UIBlockExercise } from '@/lib/viewModels/EditProgramViewModel'
import { uploadExerciseVideo, removeExerciseVideo, UploadPhase } from '@/lib/services/exerciseService'
import { useEffect, useRef, useState } from 'react'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'
import Modal from '@/components/modal'
import { SortableItem, SortableList } from '@/components/sortable'
import ExercisePicker from '@/components/exercisePicker'
import { ArrowLeft, Play, Plus, StickyNote, Trash2, TriangleAlert, Upload, X } from 'lucide-react'
import './programEditor.css'

interface ProgramEditorProps {
  // State
  title:          string
  description:    string
  visibleDays:    UIDay[]
  totalExercises: number
  saving:         boolean
  error:          string | null
  dirty:          boolean
  catalogue:      ExerciseCatalogueItem[]
  // Labels
  saveLabel:      string
  breadcrumb:     string
  // Callbacks — passed straight from useEditProgram
  setTitle:       (v: string) => void
  setDescription: (v: string) => void
  addDay:         () => void
  removeDay:      (tempId: string) => void
  updateDayName:  (tempId: string, name: string) => void
  moveDay:        (activeTempId: string, overTempId: string) => void
  addBlock:       (dayTempId: string) => void
  removeBlock:    (dayTempId: string, blockTempId: string) => void
  updateBlockName:(dayTempId: string, blockTempId: string, name: string) => void
  moveBlock:      (dayTempId: string, activeTempId: string, overTempId: string) => void
  addExercise:    (dayTempId: string, blockTempId: string) => void
  removeExercise: (dayTempId: string, blockTempId: string, idx: number) => void
  updateExField:     (dayTempId: string, blockTempId: string, idx: number, field: keyof UIBlockExercise, value: string) => void
  resolveExerciseId: (dayTempId: string, blockTempId: string, idx: number, name: string) => void
  selectExercise: (dayTempId: string, blockTempId: string, idx: number, item: ExerciseCatalogueItem) => void
  moveExercise:   (dayTempId: string, blockTempId: string, activeTempId: string, overTempId: string) => void
  onSave:         () => void
  onBack:         () => void
}

// What the confirm dialog is currently asking about
type PendingConfirm =
  | { kind: 'day';   dayTempId: string; name: string; detail: string }
  | { kind: 'block'; dayTempId: string; blockTempId: string; name: string; detail: string }
  | { kind: 'leave' }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Exercises that would actually be saved (not deleted, and named)
const countFilled = (exercises: UIBlockExercise[]) =>
  exercises.filter(e => !e._deleted && e.exerciseName?.trim()).length

export default function ProgramEditor({
  title, description, visibleDays, totalExercises, saving, error, dirty, catalogue,
  saveLabel, breadcrumb,
  setTitle, setDescription, addDay, removeDay, updateDayName, moveDay,
  addBlock, removeBlock, updateBlockName, moveBlock,
  addExercise, removeExercise, updateExField, moveExercise,
  resolveExerciseId, selectExercise,
  onSave, onBack,
}: ProgramEditorProps) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  // Warn before closing the tab / reloading with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Save errors render at the top of the page — make sure they're seen
  useEffect(() => {
    if (error) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])

  const handleBack = () => (dirty ? setPending({ kind: 'leave' }) : onBack())

  // Only ask for confirmation when something would actually be lost
  const requestRemoveDay = (day: UIDay) => {
    const blocks    = day.blocks.filter(b => !b._deleted)
    const exercises = blocks.reduce((n, b) => n + countFilled(b.exercises), 0)
    if (blocks.length === 0) return removeDay(day._tempId)
    setPending({
      kind: 'day', dayTempId: day._tempId, name: day.name || 'this day',
      detail: `${plural(blocks.length, 'block')} and ${plural(exercises, 'exercise')}`,
    })
  }

  const requestRemoveBlock = (day: UIDay, blockTempId: string) => {
    const block     = day.blocks.find(b => b._tempId === blockTempId)!
    const exercises = countFilled(block.exercises)
    if (exercises === 0) return removeBlock(day._tempId, blockTempId)
    setPending({
      kind: 'block', dayTempId: day._tempId, blockTempId, name: block.name || 'this block',
      detail: plural(exercises, 'exercise'),
    })
  }

  const confirmPending = () => {
    if (!pending) return
    if (pending.kind === 'day')   removeDay(pending.dayTempId)
    if (pending.kind === 'block') removeBlock(pending.dayTempId, pending.blockTempId)
    if (pending.kind === 'leave') onBack()
    setPending(null)
  }

  return (
    <>
      <div className="page">
        <header className="header">
          <div className="header-left">
            <button className="btn-back" onClick={handleBack}><ArrowLeft size={16} aria-hidden /> Back</button>
            <span className="breadcrumb">/ {breadcrumb}</span>
          </div>
          <div className="header-right">
            {dirty && <span className="unsaved-dot" title="Unsaved changes">Unsaved</span>}
            <div className="pill editor-pill">Days<span>{visibleDays.length}</span></div>
            <div className="pill editor-pill">Exercises<span>{totalExercises}</span></div>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </header>

        <main className="page-body">
          {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

          <label className="eyebrow" htmlFor="program-title">Program Title</label>
          <input
            id="program-title"
            className="editor-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled Program"
          />

          <textarea
            className="editor-description"
            aria-label="Program description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description — goals, notes, methodology…"
            rows={2}
          />

          <div className="editor-days">
            <SortableList ids={visibleDays.map(d => d._tempId)} onMove={moveDay}>
              {visibleDays.map((day, di) => {
                const blocks = day.blocks.filter(b => !b._deleted)
                return (
                  <SortableItem key={day._tempId} id={day._tempId} className="editor-day" handleLabel={`Reorder ${day.name || `day ${di + 1}`}`}>
                    {handle => (
                      <>
                        <div className="editor-day-header">
                          {handle}
                          <span className="editor-day-index">Day {di + 1}</span>
                          <input
                            className="editor-day-name"
                            aria-label={`Day ${di + 1} name`}
                            value={day.name}
                            onChange={e => updateDayName(day._tempId, e.target.value)}
                            placeholder="Day name"
                          />
                          <div className="editor-day-actions">
                            <button className="btn-add-block" onClick={() => addBlock(day._tempId)}>
                              <Plus size={13} aria-hidden /> Block
                            </button>
                            <button className="btn-icon danger" aria-label={`Remove ${day.name || `day ${di + 1}`}`} onClick={() => requestRemoveDay(day)}>
                              <X size={16} aria-hidden />
                            </button>
                          </div>
                        </div>

                        <div className="editor-day-body">
                          {blocks.length === 0 && (
                            <div className="editor-empty">No blocks yet — add one above</div>
                          )}
                          <SortableList ids={blocks.map(b => b._tempId)} onMove={(a, o) => moveBlock(day._tempId, a, o)}>
                            {blocks.map(block => {
                              const exercises = block.exercises.filter(e => !e._deleted)
                              return (
                                <SortableItem key={block._tempId} id={block._tempId} className="editor-block" handleLabel={`Reorder ${block.name || 'block'}`}>
                                  {blockHandle => (
                                    <>
                                      <div className="editor-block-header">
                                        {blockHandle}
                                        <input
                                          className="editor-block-name"
                                          aria-label="Block name"
                                          value={block.name}
                                          onChange={e => updateBlockName(day._tempId, block._tempId, e.target.value)}
                                          placeholder="Block name"
                                        />
                                        <button className="btn-add-ex" onClick={() => addExercise(day._tempId, block._tempId)}>
                                          <Plus size={12} aria-hidden /> Exercise
                                        </button>
                                        <button className="btn-icon danger" aria-label={`Remove ${block.name || 'block'}`} onClick={() => requestRemoveBlock(day, block._tempId)}>
                                          <X size={16} aria-hidden />
                                        </button>
                                      </div>

                                      {exercises.length > 0 && (
                                        <div className="editor-exercises">
                                          <div className="ex-header-row" aria-hidden>
                                            <div />
                                            <div className="ex-col-label">Exercise</div>
                                            <div className="ex-col-label">Video</div>
                                            <div className="ex-col-label">Sets</div>
                                            <div className="ex-col-label">Reps</div>
                                            <div className="ex-col-label">Kg</div>
                                            <div className="ex-col-label">Rest (s)</div>
                                            <div />
                                          </div>
                                          <SortableList
                                            ids={exercises.map(e => e._tempId)}
                                            onMove={(a, o) => moveExercise(day._tempId, block._tempId, a, o)}
                                          >
                                            {block.exercises.map((be, idx) =>
                                              be._deleted ? null : (
                                                <ExerciseRow
                                                  key={be._tempId}
                                                  be={be}
                                                  idx={idx}
                                                  catalogue={catalogue}
                                                  dayTempId={day._tempId}
                                                  blockTempId={block._tempId}
                                                  updateExField={updateExField}
                                                  resolveExerciseId={resolveExerciseId}
                                                  selectExercise={selectExercise}
                                                  removeExercise={removeExercise}
                                                  onAddNext={() => addExercise(day._tempId, block._tempId)}
                                                  onVideoUploaded={(url) => updateExField(day._tempId, block._tempId, idx, 'video_url', url)}
                                                  onVideoRemoved={() => updateExField(day._tempId, block._tempId, idx, 'video_url', '')}
                                                />
                                              )
                                            )}
                                          </SortableList>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </SortableItem>
                              )
                            })}
                          </SortableList>
                        </div>
                      </>
                    )}
                  </SortableItem>
                )
              })}
            </SortableList>

            <button className="add-day-btn" onClick={addDay}>
              <Plus size={18} aria-hidden /> Add Day
            </button>
          </div>
        </main>
      </div>

      {pending && (
        <Modal
          onClose={() => setPending(null)}
          title={pending.kind === 'leave' ? 'Discard changes?' : `Remove ${pending.kind}?`}
          className="modal modal-danger"
        >
          {pending.kind === 'leave' ? (
            <>
              <div className="modal-title">Discard changes?</div>
              <div className="modal-text">You have unsaved changes to this program. If you leave now they will be lost.</div>
            </>
          ) : (
            <>
              <div className="modal-title">Remove {pending.kind}?</div>
              <div className="modal-text">
                <strong>{pending.name}</strong> contains {pending.detail}. They&apos;ll be removed when you save.
              </div>
            </>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setPending(null)} data-autofocus>
              {pending.kind === 'leave' ? 'Keep editing' : 'Cancel'}
            </button>
            <button className="btn btn-danger" onClick={confirmPending}>
              {pending.kind === 'leave' ? 'Discard' : <><Trash2 size={14} aria-hidden /> Remove</>}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── ExerciseRow sub-component ────────────────────────────────────────────
// Handles its own upload state to avoid re-rendering the whole editor on upload.

function ExerciseRow({
  be, idx, catalogue, dayTempId, blockTempId,
  updateExField, resolveExerciseId, selectExercise, removeExercise, onAddNext, onVideoUploaded, onVideoRemoved,
}: {
  be:                UIBlockExercise
  idx:               number
  catalogue:         ExerciseCatalogueItem[]
  dayTempId:         string
  blockTempId:       string
  updateExField:     (d: string, b: string, i: number, f: keyof UIBlockExercise, v: string) => void
  resolveExerciseId: (d: string, b: string, i: number, name: string) => void
  selectExercise:    (d: string, b: string, i: number, item: ExerciseCatalogueItem) => void
  removeExercise:    (d: string, b: string, i: number) => void
  onAddNext:         () => void
  onVideoUploaded:   (url: string) => void
  onVideoRemoved:    () => void
}) {
  const [uploading,  setUploading]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [phase,      setPhase]      = useState<UploadPhase>('upload')
  const [removing,   setRemoving]   = useState(false)
  const [uploadErr,  setUploadErr]  = useState<string | null>(null)
  const [showNotes,  setShowNotes]  = useState(!!be.notes)
  const fileRef = useRef<HTMLInputElement>(null)

  // A row that mounts empty and unsaved was just added — focus it (not rows loaded from the DB)
  const [isNew] = useState(!be.id && !be.exerciseName)

  const handleVideoRemove = async () => {
    if (!be.exerciseId) return
    setRemoving(true)
    setUploadErr(null)
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
      const url = await uploadExerciseVideo(be.exerciseId, file, (pct, p) => { setProgress(pct); setPhase(p) })
      onVideoUploaded(url)
    } catch (err: any) {
      setUploadErr(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  const set = (field: keyof UIBlockExercise) =>
    (e: React.ChangeEvent<HTMLInputElement>) => updateExField(dayTempId, blockTempId, idx, field, e.target.value)

  const name      = be.exerciseName?.trim() ?? ''
  const hasVideo  = !!be.video_url
  const canUpload = !!be.exerciseId
  const label     = name || 'exercise'

  return (
    <SortableItem id={be._tempId} className="exercise-item" handleLabel={`Reorder ${label}`}>
      {handle => (
        <>
          <div className="exercise-row">
            {handle}
            <ExercisePicker
              value={be.exerciseName || ''}
              selectedId={be.exerciseId}
              catalogue={catalogue}
              autoFocus={isNew}
              onChange={name => updateExField(dayTempId, blockTempId, idx, 'exerciseName', name)}
              onSelect={item => selectExercise(dayTempId, blockTempId, idx, item)}
              onCommit={name => resolveExerciseId(dayTempId, blockTempId, idx, name)}
            />

            {/* Video upload/delete cell */}
            <div className="video-cell">
              <button
                type="button"
                className={
                  'btn-upload-video' +
                  (hasVideo ? ' has-video' : '') +
                  (uploading ? ' in-progress' : '')
                }
                disabled={uploading || removing || !canUpload}
                aria-label={hasVideo ? `Replace video for ${label}` : `Upload video for ${label}`}
                onClick={() => fileRef.current?.click()}
                // Progress bar fill — the only style that depends on runtime state
                style={uploading ? {
                  background: `linear-gradient(to right, #1a2a1a ${progress}%, #101a10 ${progress}%)`,
                } : undefined}
              >
                {uploading
                  ? phase === 'compress' ? `Compressing ${progress}%` : `${progress}%`
                  : hasVideo
                    ? <><Play size={11} aria-hidden /> Video</>
                    : <><Upload size={11} aria-hidden /> Video</>}
              </button>
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={handleVideoUpload} />
              {hasVideo && !uploading && (
                <button
                  type="button"
                  className="btn-remove-video"
                  onClick={handleVideoRemove}
                  disabled={removing}
                  aria-label={`Remove video for ${label}`}
                >
                  {removing ? '…' : <X size={12} aria-hidden />}
                </button>
              )}
            </div>

            <input className="ex-input ex-input-sm ex-sets" aria-label="Sets" placeholder="Sets" inputMode="numeric" value={be.sets || ''} onChange={set('sets')} />
            <input className="ex-input ex-input-sm ex-reps" aria-label="Reps" placeholder="Reps" value={be.reps || ''} onChange={set('reps')} />
            <input className="ex-input ex-input-sm ex-kg"   aria-label="Kg"   placeholder="Kg"   value={be.kg || ''}   onChange={set('kg')} />
            <input
              className="ex-input ex-input-sm ex-rest"
              aria-label="Rest in seconds"
              placeholder="Rest"
              inputMode="numeric"
              value={be.rest_seconds || ''}
              onChange={set('rest_seconds')}
              // Enter on the last field adds the next exercise
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddNext() } }}
            />

            <div className="ex-row-actions">
              <button
                type="button"
                className={`btn-icon btn-note${be.notes ? ' has-note' : ''}`}
                aria-label={showNotes ? `Hide note for ${label}` : `Add note for ${label}`}
                aria-expanded={showNotes}
                onClick={() => setShowNotes(s => !s)}
              >
                <StickyNote size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon danger"
                aria-label={`Remove ${label}`}
                onClick={() => removeExercise(dayTempId, blockTempId, idx)}
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          </div>

          {showNotes && (
            <input
              className="ex-input ex-notes-input"
              aria-label={`Note for ${label}`}
              placeholder="Note for the athlete — tempo, cues, RPE…"
              value={be.notes || ''}
              autoFocus={!be.notes}
              onChange={set('notes')}
            />
          )}

          {name && !canUpload && (
            <div className="ex-hint ex-hint-new">New exercise — it&apos;s added to the catalogue when you save. Save first to attach a video.</div>
          )}
          {uploadErr && (
            <div className="ex-hint ex-hint-error" role="alert">
              <TriangleAlert size={12} aria-hidden /> {uploadErr}
              <button type="button" className="ex-hint-dismiss" aria-label="Dismiss" onClick={() => setUploadErr(null)}>
                <X size={12} aria-hidden />
              </button>
            </div>
          )}
        </>
      )}
    </SortableItem>
  )
}
