'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getAllAthletes, createAthlete } from '@/lib/services/athleteService'
import { AthleteListItemViewModel } from '@/lib/viewModels/AthleteViewModel'

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
        .logo {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          color: #e8ff4a;
        }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .btn-logout {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #4a4a5a; background: none; border: 1px solid #1f1f2a;
          padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s;
        }
        .btn-logout:hover { color: #ff6060; border-color: #3a1a1a; background: #1a1010; }
        .btn-new {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #e8ff4a; color: #0d0d0f; border: none;
          padding: 8px 22px; border-radius: 8px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-new:hover { background: #f5ff80; transform: translateY(-1px); }

        .body { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }

        .page-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #4a4a5a; margin-bottom: 10px;
        }
        .page-heading {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 42px; font-weight: 800; letter-spacing: -0.01em;
          color: #e8e8ec; margin-bottom: 32px; line-height: 1;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }

        .athlete-card {
          background: #111116; border: 1px solid #1a1a24; border-radius: 12px;
          padding: 20px; cursor: pointer;
          display: flex; align-items: center; gap: 16px;
          transition: border-color 0.2s, transform 0.15s;
          animation: fadeUp 0.3s ease both;
        }
        .athlete-card:hover { border-color: #e8ff4a44; transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        .avatar {
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          background: #1a1a2a; border: 2px solid #2a2a3a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; color: #4a4a6a;
          overflow: hidden;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .athlete-info { flex: 1; min-width: 0; }
        .athlete-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px; font-weight: 700; color: #e0e0ec;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .athlete-arrow { font-size: 18px; color: #2a2a3a; transition: color 0.15s; }
        .athlete-card:hover .athlete-arrow { color: #e8ff4a; }

        .skeleton {
          background: linear-gradient(90deg, #16161e 25%, #1e1e28 50%, #16161e 75%);
          background-size: 200% 100%; animation: shimmer 1.4s infinite;
          border-radius: 12px; height: 88px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        .empty {
          grid-column: 1 / -1; text-align: center; padding: 64px;
          border: 1px dashed #1f1f2a; border-radius: 12px;
        }
        .empty-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          color: #2a2a3a; margin-bottom: 8px;
        }
        .empty-sub { font-size: 13px; color: #222230; }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .modal {
          background: #141418; border: 1px solid #22222e;
          border-radius: 16px; padding: 28px; width: 100%; max-width: 440px;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

        .modal-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 24px; font-weight: 800; color: #e8e8ec; margin-bottom: 20px;
        }

        .field { margin-bottom: 14px; }
        .field-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #4a4a5a; margin-bottom: 6px; display: block;
        }
        .field-input {
          width: 100%; background: #0d0d12; border: 1px solid #1e1e2e;
          color: #e8e8ec; padding: 10px 12px; border-radius: 8px; outline: none;
          font-family: 'Barlow', sans-serif; font-size: 14px;
          transition: border-color 0.15s;
        }
        .field-input::placeholder { color: #2a2a3a; }
        .field-input:focus { border-color: #e8ff4a55; }
        textarea.field-input { resize: vertical; min-height: 72px; }

        .form-error {
          font-size: 13px; color: #ff7070;
          background: #2a1010; border: 1px solid #4a1a1a;
          padding: 8px 12px; border-radius: 8px; margin-bottom: 16px;
        }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .btn-cancel {
          flex: 1; font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #1a1a22; color: #6a6a7a; border: 1px solid #2a2a36;
          padding: 10px; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .btn-cancel:hover:not(:disabled) { background: #22222e; color: #e8e8ec; }
        .btn-create {
          flex: 1; font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          background: #e8ff4a; color: #0d0d0f; border: none;
          padding: 10px; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .btn-create:hover:not(:disabled) { background: #f5ff80; }
        .btn-create:disabled, .btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

        .avatar-upload {
          display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
          padding-bottom: 20px; border-bottom: 1px solid #1a1a24;
        }
        .avatar-preview {
          width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
          background: #1a1a2a; border: 2px solid #2a2a3a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; color: #3a3a5a;
          overflow: hidden; cursor: pointer; transition: border-color 0.2s;
        }
        .avatar-preview:hover { border-color: #e8ff4a55; }
        .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-upload-info { flex: 1; }
        .avatar-upload-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          color: #6a6aaa; cursor: pointer; transition: color 0.15s;
        }
        .avatar-upload-label:hover { color: #aaaae8; }
        .avatar-upload-sub { font-size: 12px; color: #2a2a3a; margin-top: 4px; }
      `}</style>

      <div className="root">
        <header className="header">
          <div className="logo">Coach Panel</div>
          <div className="header-right">
            <button className="btn-new" onClick={openModal}>+ New Athlete</button>
            <button
              className="btn-logout"
              onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="body">
          <div className="page-title">Admin</div>
          <div className="page-heading">Athletes</div>

          <div className="grid">
            {loading
              ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i*0.08}s` }} />)
              : athletes.length === 0
                ? (
                  <div className="empty">
                    <div className="empty-title">No athletes yet</div>
                    <div className="empty-sub">Click "+ New Athlete" to add your first one</div>
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
              <label className="avatar-preview" htmlFor="avatar-input">
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
                style={{ display: 'none' }}
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
              <label className="field-label">Notes <span style={{ color:'#2a2a3a', fontWeight:400 }}>(optional)</span></label>
              <textarea
                className="field-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any relevant notes about the athlete…"
              />
            </div>

            {formError && <div className="form-error">⚠ {formError}</div>}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn-create" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Athlete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
