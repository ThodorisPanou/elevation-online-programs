'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAthletePrograms } from '@/lib/hooks/useAthleteProgram'
import { deleteProgram, copyProgram } from '@/lib/services/programService'
import { getAllAthletes } from '@/lib/services/athleteService'
import Modal from '@/components/modal'
import Menu from '@/components/menu'
import AthleteLoginPanel from '@/components/athleteLogin'
import AthleteRecords from '@/components/athleteRecords'
import { ArrowLeft, Check, ClipboardList, Copy, Eye, Link, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'
import { copyText } from '@/lib/clipboard'
import './programs.css'

// "3 days · 24 exercises"
function programStats(p: ProgramViewModel) {
  const exercises = p.days.reduce((n, d) => n + d.blocks.reduce((m, b) => m + b.block_exercises.length, 0), 0)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return `${plural(p.days.length, 'day')} · ${plural(exercises, 'exercise')}`
}

export default function AthleteProgramsPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId = params?.athlete_id as string

  const { programs, athlete, loading, error, refresh } = useAthletePrograms(athleteId)

  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)

  // Copy modal state
  const [copyId,       setCopyId]       = useState<string | null>(null)
  const [copyTitle,    setCopyTitle]    = useState('')
  const [allAthletes,  setAllAthletes]  = useState<{id:string,fullName:string}[]>([])
  const [copyTarget,   setCopyTarget]   = useState('')
  const [copying,      setCopying]      = useState(false)
  const [copiedId,     setCopiedId]     = useState<string | null>(null)
  const [copyError,    setCopyError]    = useState<string | null>(null)


  const fmt = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const openConfirm = (id: string, title: string) => {
    setConfirmId(id)
    setConfirmTitle(title)
    setDeleteError(null)
  }

  const closeConfirm = () => {
    if (deleting) return
    setConfirmId(null)
    setConfirmTitle('')
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!confirmId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProgram(confirmId)
      setConfirmId(null)
      refresh()
    } catch (e: any) {
      setDeleteError(e.message ?? 'Failed to delete program')
    } finally {
      setDeleting(false)
    }
  }

  const handleShareCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/program/${token}`
    if (!(await copyText(url))) { window.prompt('Copy the share link:', url); return }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openCopy = async (id: string, title: string) => {
    setCopyId(id); setCopyTitle(title); setCopyError(null); setCopyTarget('')
    // Only the same coach's athletes: the program's exercises belong to that coach
    const athletes = await getAllAthletes()
    setAllAthletes(athletes.filter(a => a.coachId === (athlete?.coachId ?? null)))
  }

  const closeCopy = () => { if (copying) return; setCopyId(null) }

  const handleCopy = async () => {
    if (!copyId || !copyTarget) { setCopyError('Please select an athlete'); return }
    setCopying(true); setCopyError(null)
    try {
      const newId = await copyProgram(copyId, copyTarget)
      setCopyId(null)
      router.push(`/admin/programs/${copyTarget}/edit/${newId}`)
    } catch (e: any) {
      setCopyError(e.message ?? 'Failed to copy program')
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <div className="page">
        <header className="header">
          <button className="btn-back" onClick={() => router.push('/admin/athletes')}>
            <ArrowLeft size={16} aria-hidden /> Athletes
          </button>
          <button className="btn btn-primary" onClick={() => router.push(`/admin/programs/${athleteId}/new`)}>
            <Plus size={16} aria-hidden /> New Program
          </button>
        </header>

        <main className="page-body">
          <div className="athlete-hero">
            <div className="avatar avatar-lg">
              {athlete?.avatar_url
                ? <img src={athlete.avatar_url} alt="" />
                : athlete ? `${athlete.name[0]}${athlete.surname[0]}` : '?'
              }
            </div>
            <div className="athlete-hero-info">
              <h1 className="athlete-hero-name">{athlete?.fullName ?? '—'}</h1>
              <div className="athlete-hero-sub">Training Programs</div>
            </div>
            <div className="pill">Programs<span>{programs.length}</span></div>
            <button
              className="btn btn-edit"
              onClick={() => router.push(`/admin/athletes/${athleteId}/edit`)}
              aria-label={`Edit athlete ${athlete?.fullName ?? ''}`}
            >
              <Pencil size={14} aria-hidden /> Edit
            </button>
          </div>

          {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

          {athlete && <AthleteLoginPanel athleteId={athleteId} athleteName={athlete.fullName} />}

          <div className="eyebrow">All Programs</div>

          {loading
            ? <div className="program-list">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ animationDelay:`${i*0.1}s` }} />)}</div>
            : programs.length === 0
              ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><ClipboardList size={36} aria-hidden /></div>
                  <div className="empty-state-title">No Programs Yet</div>
                  <div className="empty-state-sub">Create the first program for this athlete</div>
                </div>
              )
              : (
                <div className="program-list">
                  {programs.map((p, i) => (
                    <div key={p.id} className="program-card" style={{ animationDelay:`${i*0.05}s` }}>
                      <button
                        type="button"
                        className="prog-main"
                        onClick={() => router.push(`/admin/programs/${athleteId}/edit/${p.id}`)}
                        aria-label={`Edit ${p.title}`}
                      >
                        <div className="prog-info">
                          <div className="prog-title">{p.title}</div>
                          <div className="prog-meta">{programStats(p)} · {fmt(p.created_at)}</div>
                        </div>
                        <Pencil className="prog-edit-icon" size={15} aria-hidden />
                      </button>
                      <div className="prog-actions">
                        <button
                          className={`btn ${copiedId === p.id ? 'btn-success' : 'btn-share'}`}
                          onClick={() => handleShareCopy(p.public_token, p.id)}
                          aria-live="polite"
                        >
                          {copiedId === p.id
                            ? <><Check size={14} aria-hidden /> Copied</>
                            : <><Link size={14} aria-hidden /> Link</>}
                        </button>
                        <button className="btn btn-view" onClick={() => router.push(`/program/${p.public_token}`)}>
                          <Eye size={14} aria-hidden /> View
                        </button>
                        <Menu
                          label={`More actions for ${p.title}`}
                          items={[
                            { label: 'Copy to athlete…', icon: <Copy size={15} aria-hidden />, onSelect: () => openCopy(p.id, p.title) },
                            { label: 'Delete program',  icon: <Trash2 size={15} aria-hidden />, danger: true, onSelect: () => openConfirm(p.id, p.title) },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )
          }

          {athlete && <AthleteRecords athleteId={athleteId} />}
        </main>
      </div>

      {/* Copy Modal */}
      {copyId && (
        <Modal onClose={closeCopy} title="Copy Program" className="modal modal-teal">
            <div className="modal-icon"><Copy size={20} aria-hidden /></div>
            <div className="modal-title">Copy Program</div>
            <div className="modal-text">Copying <strong>{copyTitle}</strong> to another athlete of the same coach.</div>
            <label className="field-label" htmlFor="copy-target">Select Athlete</label>
            <select
              id="copy-target"
              className="field-input"
              value={copyTarget}
              onChange={e => setCopyTarget(e.target.value)}
            >
              <option value="">— Pick an athlete —</option>
              {allAthletes.map(a => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </select>
            {allAthletes.length === 0 && (
              <div className="modal-note">No other athletes found.</div>
            )}
            {copyError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {copyError}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={closeCopy} disabled={copying}>Cancel</button>
              <button className="btn btn-teal" onClick={handleCopy} disabled={copying || !copyTarget}>
                {copying ? 'Copying…' : 'Copy Program'}
              </button>
            </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmId && (
        <Modal onClose={closeConfirm} title="Delete Program" className="modal modal-danger">
            <div className="modal-icon"><Trash2 size={20} aria-hidden /></div>
            <div className="modal-title">Delete Program</div>
            <div className="modal-text">You are about to permanently delete:</div>
            <div className="modal-program-name">{confirmTitle}</div>
            <div className="modal-warning">This will also delete all days, blocks and exercises inside it. This cannot be undone.</div>
            {deleteError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {deleteError}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={closeConfirm} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
        </Modal>
      )}
    </>
  )
}
