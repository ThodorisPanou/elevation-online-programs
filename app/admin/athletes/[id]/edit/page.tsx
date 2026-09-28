'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  getAthleteById, updateAthlete, replaceAthleteAvatar, removeAthleteAvatar,
  countAthletePrograms, deleteAthlete,
} from '@/lib/services/athleteService'
import { AthleteViewModel } from '@/lib/viewModels/AthleteViewModel'
import Modal from '@/components/modal'
import AvatarPicker from '@/components/avatarPicker'
import { Loader, NotFound } from '@/components/pageStatus'
import { ArrowLeft, Check, Trash2, TriangleAlert } from 'lucide-react'
import './edit.css'

// Photo change waiting for Save: keep as is, replace with a picked file, or remove
type PhotoChange = { kind: 'keep' } | { kind: 'replace'; file: File; preview: string } | { kind: 'remove' }

export default function EditAthletePage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId = params?.id as string

  const [athlete,  setAthlete]  = useState<AthleteViewModel | null>(null)
  const [loading,  setLoading]  = useState(true)

  // Form
  const [name,    setName]    = useState('')
  const [surname, setSurname] = useState('')
  const [notes,   setNotes]   = useState('')
  const [photo,   setPhoto]   = useState<PhotoChange>({ kind: 'keep' })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [programCount, setProgramCount] = useState<number | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)

  const fillForm = (a: AthleteViewModel) => {
    setAthlete(a)
    setName(a.name); setSurname(a.surname); setNotes(a.notes ?? '')
    setPhoto({ kind: 'keep' })
  }

  useEffect(() => {
    const init = async () => {
      const a = await getAthleteById(athleteId)
      if (a) fillForm(a)
      setLoading(false)
    }
    init()
  }, [athleteId])

  // Free the object URL of a replaced preview
  useEffect(() => {
    if (photo.kind !== 'replace') return
    return () => URL.revokeObjectURL(photo.preview)
  }, [photo])

  if (loading)  return <Loader />
  if (!athlete) return <NotFound message="Athlete not found" />

  const previewUrl =
    photo.kind === 'replace' ? photo.preview :
    photo.kind === 'remove'  ? null :
    athlete.avatar_url ?? null

  const dirty =
    name.trim()    !== athlete.name ||
    surname.trim() !== athlete.surname ||
    notes.trim()   !== (athlete.notes ?? '') ||
    photo.kind     !== 'keep'

  const edited = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSaved(false) }
  const setPhotoChange = edited(setPhoto)

  const handleSave = async () => {
    if (!name.trim())    { setFormError('First name is required'); return }
    if (!surname.trim()) { setFormError('Last name is required');  return }
    setSaving(true)
    setFormError(null)
    try {
      await updateAthlete(athlete.id, { name, surname, notes })
      if (photo.kind === 'replace') {
        await replaceAthleteAvatar(athlete.id, photo.file, athlete.avatar_url)
      } else if (photo.kind === 'remove' && athlete.avatar_url) {
        await removeAthleteAvatar(athlete.id, athlete.avatar_url)
      }
      const fresh = await getAthleteById(athlete.id)
      if (fresh) fillForm(fresh)
      setSaved(true)
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save athlete')
    } finally {
      setSaving(false)
    }
  }

  const openConfirm = async () => {
    setDeleteError(null)
    setProgramCount(null)
    setConfirmOpen(true)
    try {
      setProgramCount(await countAthletePrograms(athlete.id))
    } catch {
      // The warning falls back to generic wording
    }
  }

  const closeConfirm = () => { if (!deleting) setConfirmOpen(false) }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAthlete(athlete.id)
      router.replace('/admin/athletes')
    } catch (e: any) {
      setDeleteError(e.message ?? 'Failed to delete athlete')
      setDeleting(false)
    }
  }

  const programsLabel =
    programCount === null ? 'all of their programs' :
    programCount === 0    ? 'their profile (they have no programs)' :
    `${programCount} program${programCount === 1 ? '' : 's'}`

  return (
    <>
      <div className="page">
        <header className="header">
          <button className="btn-back" onClick={() => router.push(`/admin/programs/${athlete.id}`)}>
            <ArrowLeft size={16} aria-hidden /> {athlete.fullName}
          </button>
        </header>

        <main className="page-body edit-athlete">
          <div className="eyebrow">Athlete</div>
          <h1 className="page-heading">Edit Athlete</h1>

          <form
            className="edit-card"
            onSubmit={e => { e.preventDefault(); handleSave() }}
          >
            <AvatarPicker
              inputId="edit-avatar-input"
              previewUrl={previewUrl}
              initials={`${name[0] ?? ''}${surname[0] ?? ''}` || '?'}
              onPick={file => setPhotoChange({ kind: 'replace', file, preview: URL.createObjectURL(file) })}
              onRemove={() => setPhotoChange(athlete.avatar_url ? { kind: 'remove' } : { kind: 'keep' })}
            />

            <div className="edit-name-row">
              <div className="field">
                <label className="field-label" htmlFor="edit-name">First Name</label>
                <input id="edit-name" className="field-input" value={name} onChange={e => edited(setName)(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-surname">Last Name</label>
                <input id="edit-surname" className="field-input" value={surname} onChange={e => edited(setSurname)(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-notes">Notes <span className="field-hint">(optional)</span></label>
              <textarea
                id="edit-notes"
                className="field-input"
                value={notes}
                onChange={e => edited(setNotes)(e.target.value)}
                placeholder="Any relevant notes about the athlete…"
              />
            </div>

            {formError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {formError}</div>}

            <div className="edit-actions">
              <span className="edit-saved" aria-live="polite">
                {saved && !dirty && <><Check size={14} aria-hidden /> Saved</>}
              </span>
              <button type="button" className="btn" onClick={() => fillForm(athlete)} disabled={!dirty || saving}>
                Discard
              </button>
              <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>

          <section className="danger-zone" aria-labelledby="danger-zone-title">
            <div className="danger-zone-info">
              <h2 id="danger-zone-title" className="danger-zone-title">Delete athlete</h2>
              <p className="danger-zone-text">
                Permanently removes {athlete.fullName}, their photo and all of their programs.
              </p>
            </div>
            <button className="btn btn-danger" onClick={openConfirm}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          </section>
        </main>
      </div>

      {confirmOpen && (
        <Modal onClose={closeConfirm} title="Delete Athlete" className="modal modal-danger">
          <div className="modal-icon"><Trash2 size={20} aria-hidden /></div>
          <div className="modal-title">Delete Athlete</div>
          <div className="modal-text">You are about to permanently delete:</div>
          <div className="modal-program-name">{athlete.fullName}</div>
          <div className="modal-warning">
            This also deletes {programsLabel} and their photo. Shared program links will stop working.
            This cannot be undone.
          </div>
          {deleteError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {deleteError}</div>}
          <div className="modal-actions">
            <button className="btn" onClick={closeConfirm} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
