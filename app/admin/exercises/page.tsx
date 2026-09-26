'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getExerciseLibrary } from '@/lib/services/exerciseService'
import { ExerciseLibraryItem } from '@/lib/viewModels/ExerciseViewModel'
import { Video, VideoModal } from '@/components/programView'
import { ArrowLeft, Play, Search, TriangleAlert, Video as VideoIcon, X } from 'lucide-react'
import './exercises.css'

type Filter = 'all' | 'used' | 'unused'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'used',   label: 'Used' },
  { key: 'unused', label: 'Not used yet' },
]

export default function ExerciseLibraryPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [query,     setQuery]     = useState('')
  const [filter,    setFilter]    = useState<Filter>('all')
  const [video,     setVideo]     = useState<Video | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      try {
        setExercises(await getExerciseLibrary())
      } catch (e: any) {
        setError(e.message ?? 'Failed to load exercises')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const counts = useMemo(() => ({
    all:    exercises.length,
    used:   exercises.filter(e => e.programs.length > 0).length,
    unused: exercises.filter(e => e.programs.length === 0).length,
  }), [exercises])

  // Search matches the exercise name, a program title, or an athlete name
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter(e => {
      if (filter === 'used'   && e.programs.length === 0) return false
      if (filter === 'unused' && e.programs.length > 0)   return false
      if (!q) return true
      return e.name.toLowerCase().includes(q)
        || e.programs.some(p => p.title.toLowerCase().includes(q) || p.athleteName.toLowerCase().includes(q))
    })
  }, [exercises, query, filter])

  return (
    <div className="page">
      <header className="header">
        <button className="btn-back" onClick={() => router.push('/admin/athletes')}>
          <ArrowLeft size={16} aria-hidden /> Athletes
        </button>
        <div className="pill">Videos<span>{counts.all}</span></div>
      </header>

      <main className="page-body">
        <div className="eyebrow">Admin</div>
        <h1 className="page-heading">Exercise Library</h1>

        {error && <div className="alert-error" role="alert"><TriangleAlert size={14} aria-hidden /> {error}</div>}

        <div className="lib-toolbar">
          <div className="lib-search">
            <Search size={16} aria-hidden className="lib-search-icon" />
            <input
              className="field-input"
              type="search"
              aria-label="Search exercises, programs or athletes"
              placeholder="Search exercises, programs or athletes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button className="btn-icon lib-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={15} aria-hidden />
              </button>
            )}
          </div>
          <div className="lib-filters" role="group" aria-label="Filter by usage">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`lib-filter${filter === f.key ? ' active' : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}<span>{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading
          ? <div className="lib-list">{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ animationDelay: `${i*0.08}s` }} />)}</div>
          : visible.length === 0
            ? (
              <div className="empty-state">
                <div className="empty-state-icon"><VideoIcon size={36} aria-hidden /></div>
                <div className="empty-state-title">No exercises found</div>
                <div className="empty-state-sub">
                  {exercises.length === 0 ? 'Upload a video to an exercise in the program editor' : 'Try a different search or filter'}
                </div>
              </div>
            )
            : (
              <ul className="lib-list">
                {visible.map(ex => (
                  <li key={ex.id} className="lib-item">
                    <button
                      className="lib-play"
                      aria-label={`Play video: ${ex.name}`}
                      onClick={() => setVideo({ url: ex.video_url, name: ex.name })}
                    >
                      <Play size={18} aria-hidden />
                    </button>
                    <div className="lib-info">
                      <div className="lib-name">{ex.name}</div>
                      {ex.programs.length === 0
                        ? <div className="lib-unused">Not used in any program yet</div>
                        : (
                          <div className="lib-programs">
                            <span className="lib-programs-label">
                              Used in {ex.programs.length} program{ex.programs.length === 1 ? '' : 's'}
                            </span>
                            {ex.programs.map(p => (
                              <button
                                key={p.id}
                                className="lib-program"
                                title={`Open ${p.title}`}
                                onClick={() => router.push(`/admin/program/${p.id}`)}
                              >
                                <span className="lib-program-title">{p.title}</span>
                                {p.athleteName && <span className="lib-program-athlete">{p.athleteName}</span>}
                                {p.uses > 1 && <span className="lib-program-uses">×{p.uses}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            )
        }
      </main>

      {video && <VideoModal video={video} onClose={() => setVideo(null)} />}
    </div>
  )
}
