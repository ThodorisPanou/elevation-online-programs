'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAthletePrograms } from '@/lib/hooks/useAthleteProgram'
import { deleteProgram, copyProgram } from '@/lib/services/programService'
import { getAllAthletes } from '@/lib/services/athleteService'
import './programs.css'

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

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

  const handleShareCopy = (token: string, id: string) => {
    const url = `${window.location.origin}/program/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openCopy = async (id: string, title: string) => {
    setCopyId(id); setCopyTitle(title); setCopyError(null); setCopyTarget('')
    const athletes = await getAllAthletes()
    setAllAthletes(athletes)
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
          <button className="btn-back" onClick={() => router.push('/admin/athletes')}>← Athletes</button>
          <button className="btn btn-primary" onClick={() => router.push(`/admin/programs/${athleteId}/new`)}>
            + New Program
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
              <div className="athlete-hero-name">{athlete?.fullName ?? '—'}</div>
              <div className="athlete-hero-sub">Training Programs</div>
            </div>
            <div className="pill">Programs<span>{programs.length}</span></div>
          </div>

          {error && <div className="alert-error">⚠ {error}</div>}

          <div className="eyebrow">All Programs</div>

          {loading
            ? <div className="program-list">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ animationDelay:`${i*0.1}s` }} />)}</div>
            : programs.length === 0
              ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">No Programs Yet</div>
                  <div className="empty-state-sub">Create the first program for this athlete</div>
                </div>
              )
              : (
                <div className="program-list">
                  {programs.map((p, i) => (
                    <div key={p.id} className="program-card" style={{ animationDelay:`${i*0.05}s` }}>
                      <div className="prog-index">#{String(i+1).padStart(2,'0')}</div>
                      <div className="prog-info">
                        <div className="prog-title">{p.title}</div>
                        <div className="prog-date">{fmt(p.created_at)}</div>
                      </div>
                      <div className="prog-actions">
                        <button className="btn btn-view" onClick={() => router.push(`/program/${p.public_token}`)}>
                          View
                        </button>
                        <button className="btn btn-edit" onClick={() => router.push(`/admin/programs/${athleteId}/edit/${p.id}`)}>
                          Edit
                        </button>
                        <button
                          className={`btn ${copiedId === p.id ? 'btn-success' : 'btn-share'}`}
                          onClick={() => handleShareCopy(p.public_token, p.id)}
                        >
                          {copiedId === p.id ? '✓ Copied!' : '🔗 Link'}
                        </button>
                        <button className="btn btn-copy" onClick={() => openCopy(p.id, p.title)}>
                          Copy
                        </button>
                        <button className="btn btn-delete" onClick={() => openConfirm(p.id, p.title)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </main>
      </div>

      {/* Copy Modal */}
      {copyId && (
        <div className="modal-overlay" onClick={closeCopy}>
          <div className="modal modal-teal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">📋</div>
            <div className="modal-title">Copy Program</div>
            <div className="modal-text">Copying <strong>{copyTitle}</strong> to another athlete.</div>
            <label className="field-label">Select Athlete</label>
            <select
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
            {copyError && <div className="alert-error">⚠ {copyError}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={closeCopy} disabled={copying}>Cancel</button>
              <button className="btn btn-teal" onClick={handleCopy} disabled={copying || !copyTarget}>
                {copying ? 'Copying…' : 'Copy Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmId && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal modal-danger" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑</div>
            <div className="modal-title">Delete Program</div>
            <div className="modal-text">You are about to permanently delete:</div>
            <div className="modal-program-name">{confirmTitle}</div>
            <div className="modal-warning">This will also delete all days, blocks and exercises inside it. This cannot be undone.</div>
            {deleteError && <div className="alert-error">⚠ {deleteError}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={closeConfirm} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
