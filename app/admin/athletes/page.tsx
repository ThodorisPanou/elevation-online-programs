'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getAllAthletes, createAthlete } from '@/lib/services/athleteService'
import { AthleteListItemViewModel } from '@/lib/viewModels/AthleteViewModel'
import './athletes.css'

export default function AthletesPage() {
  const router = useRouter()
  const [athletes, setAthletes] = useState<AthleteListItemViewModel[]>([])
  const [loading,  setLoading]  = useState(true)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [name,      setName]      = useState('')
  const [surname,   setSurname]   = useState('')
  const [notes,     setNotes]     = useState('')
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadAthletes = async () => {
    const data = await getAllAthletes()
    setAthletes(data)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      await loadAthletes()
      setLoading(false)
    }
    init()
  }, [])

  const openModal = () => {
    setName(''); setSurname(''); setNotes(''); setFormError(null)
    setAvatarFile(null); setAvatarPreview(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
  }

  const handleCreate = async () => {
    if (!name.trim())    { setFormError('First name is required'); return }
    if (!surname.trim()) { setFormError('Last name is required');  return }
    setSaving(true)
    setFormError(null)
    try {
      const id = await createAthlete(name, surname, notes, avatarFile ?? undefined)
      setModalOpen(false)
      await loadAthletes()
      router.push(`/admin/programs/${id}`)
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to create athlete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page">
        <header className="header">
          <div className="logo">Coach Panel</div>
          <div className="header-right">
            <button className="btn btn-primary" onClick={openModal}>+ New Athlete</button>
            <button
              className="btn btn-logout"
              onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="page-body">
          <div className="eyebrow">Admin</div>
          <div className="page-heading">Athletes</div>

          <div className="athlete-grid">
            {loading
              ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i*0.08}s` }} />)
              : athletes.length === 0
                ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No athletes yet</div>
                    <div className="empty-state-sub">Click "+ New Athlete" to add your first one</div>
                  </div>
                )
                : athletes.map((a, i) => (
                  <div
                    key={a.id}
                    className="athlete-card"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => router.push(`/admin/programs/${a.id}`)}
                  >
                    <div className="avatar">
                      {a.avatar_url
                        ? <img src={a.avatar_url} alt="" />
                        : `${a.name[0]}${a.surname[0]}`
                      }
                    </div>
                    <div className="athlete-info">
                      <div className="athlete-name">{a.fullName}</div>
                    </div>
                    <div className="athlete-arrow">→</div>
                  </div>
                ))
            }
          </div>
        </main>
      </div>

      {/* New Athlete Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Athlete</div>

            {/* Avatar upload */}
            <div className="avatar-upload">
              <label className="avatar avatar-upload-preview" htmlFor="avatar-input">
                {avatarPreview
                  ? <img src={avatarPreview} alt="preview" />
                  : (name && surname ? `${name[0]}${surname[0]}` : '?')
                }
              </label>
              <div className="avatar-upload-info">
                <label className="avatar-upload-label" htmlFor="avatar-input">
                  {avatarFile ? 'Change photo' : 'Upload photo'}
                </label>
                <div className="avatar-upload-sub">JPG, PNG or WEBP</div>
              </div>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setAvatarFile(file)
                  setAvatarPreview(URL.createObjectURL(file))
                  e.target.value = ''
                }}
              />
            </div>

            <div className="field">
              <label className="field-label">First Name</label>
              <input
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Nikos"
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Last Name</label>
              <input
                className="field-input"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                placeholder="e.g. Papadopoulos"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="field">
              <label className="field-label">Notes <span className="field-hint">(optional)</span></label>
              <textarea
                className="field-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any relevant notes about the athlete…"
              />
            </div>

            {formError && <div className="alert-error">⚠ {formError}</div>}

            <div className="modal-actions">
              <button className="btn" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Athlete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
