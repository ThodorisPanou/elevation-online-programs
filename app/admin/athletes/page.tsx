'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/hooks/useMe'
import { getAllAthletes, createAthlete } from '@/lib/services/athleteService'
import { AthleteListItemViewModel } from '@/lib/viewModels/AthleteViewModel'
import Modal from '@/components/modal'
import AvatarPicker from '@/components/avatarPicker'
import { ChartColumn, ChevronRight, KeyRound, LogOut, Plus, TriangleAlert, UserCog, Users, Video } from 'lucide-react'
import './athletes.css'

export default function AthletesPage() {
  const router = useRouter()
  const { me, signOut } = useMe()
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
          <div className="header-left">
            <div className="logo">Coach Panel</div>
            <div className="header-user" title={me.email}>{me.coach?.name ?? (me.isAdmin ? 'Admin' : '')}</div>
          </div>
          <div className="header-right">
            {me.isAdmin && (
              <button className="btn" onClick={() => router.push('/admin/coaches')}>
                <UserCog size={15} aria-hidden /> <span className="btn-exercises-label">Coaches</span>
              </button>
            )}
            <button className="btn" onClick={() => router.push('/admin/exercises')}>
              <Video size={15} aria-hidden /> <span className="btn-exercises-label">Exercises</span>
            </button>
            <button className="btn" onClick={() => router.push('/admin/analytics')}>
              <ChartColumn size={15} aria-hidden /> <span className="btn-exercises-label">Analytics</span>
            </button>
            <button className="btn btn-primary" onClick={openModal}>
              <Plus size={16} aria-hidden /> New Athlete
            </button>
            <button className="btn-icon" onClick={() => router.push('/admin/password')} aria-label="Change password" title="Change password">
              <KeyRound size={16} aria-hidden />
            </button>
            <button className="btn btn-logout" onClick={signOut}>
              <LogOut size={14} aria-hidden /> <span className="btn-logout-label">Sign out</span>
            </button>
          </div>
        </header>

        <main className="page-body">
          <div className="eyebrow">Admin</div>
          <h1 className="page-heading">Athletes</h1>

          <div className="athlete-grid">
            {loading
              ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i*0.08}s` }} />)
              : athletes.length === 0
                ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Users size={36} aria-hidden /></div>
                    <div className="empty-state-title">No athletes yet</div>
                    <div className="empty-state-sub">Click &ldquo;New Athlete&rdquo; to add your first one</div>
                  </div>
                )
                : athletes.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
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
                    <ChevronRight className="athlete-arrow" size={20} aria-hidden />
                  </button>
                ))
            }
          </div>
        </main>
      </div>

      {/* New Athlete Modal */}
      {modalOpen && (
        <Modal onClose={closeModal} title="New Athlete">
            <div className="modal-title">New Athlete</div>

            <AvatarPicker
              inputId="avatar-input"
              previewUrl={avatarPreview}
              initials={name && surname ? `${name[0]}${surname[0]}` : '?'}
              onPick={file => { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)) }}
            />

            <div className="field">
              <label className="field-label" htmlFor="athlete-name">First Name</label>
              <input
                id="athlete-name"
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Nikos"
                data-autofocus
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="athlete-surname">Last Name</label>
              <input
                id="athlete-surname"
                className="field-input"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                placeholder="e.g. Papadopoulos"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="athlete-notes">Notes <span className="field-hint">(optional)</span></label>
              <textarea
                id="athlete-notes"
                className="field-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any relevant notes about the athlete…"
              />
            </div>

            {formError && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {formError}</div>}

            <div className="modal-actions">
              <button className="btn" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Athlete'}
              </button>
            </div>
        </Modal>
      )}
    </>
  )
}
