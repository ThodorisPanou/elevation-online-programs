// lib/hooks/useEditProgram.ts

import { useState, useEffect, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { getProgramRawById, createProgram, updateProgram } from '@/lib/services/programService'
import {
  EditProgramViewModel,
  UIDay,
  UIBlock,
  UIBlockExercise,
  mapToEditProgramViewModel,
  createUIDay,
  createUIBlock,
  createUIBlockExercise,
  getVisibleDays,
  getTotalExercises,
} from '@/lib/viewModels/EditProgramViewModel'

interface UseEditProgramResult {
  // State
  title:            string
  description:      string
  days:             UIDay[]
  saving:           boolean
  loading:          boolean
  error:            string | null
  // Derived
  visibleDays:      UIDay[]
  totalExercises:   number
  dirty:            boolean   // unsaved changes since load / last save
  // Title
  setTitle:         (title: string) => void
  setDescription:   (desc: string) => void
  // Day actions
  addDay:           () => void
  removeDay:        (tempId: string) => void
  updateDayName:    (tempId: string, name: string) => void
  moveDay:          (activeTempId: string, overTempId: string) => void
  // Block actions
  addBlock:         (dayTempId: string) => void
  removeBlock:      (dayTempId: string, blockTempId: string) => void
  updateBlockName:  (dayTempId: string, blockTempId: string, name: string) => void
  moveBlock:        (dayTempId: string, activeTempId: string, overTempId: string) => void
  // Exercise actions
  addExercise:      (dayTempId: string, blockTempId: string) => void
  removeExercise:   (dayTempId: string, blockTempId: string, idx: number) => void
  updateExField:    (dayTempId: string, blockTempId: string, idx: number, field: keyof UIBlockExercise, value: string) => void
  resolveExerciseId: (dayTempId: string, blockTempId: string, idx: number, name: string) => void
  selectExercise:   (dayTempId: string, blockTempId: string, idx: number, item: CatalogueItem) => void
  moveExercise:     (dayTempId: string, blockTempId: string, activeTempId: string, overTempId: string) => void
  // Save
  save:             () => Promise<void>
}

type CatalogueItem = { id: string; name: string; video_url?: string }

// The catalogue can hold names that differ only by case (or are identical).
// Prefer an exact-case match, then any case-insensitive match with a video.
function matchByName(catalogue: CatalogueItem[], name: string): CatalogueItem | undefined {
  const exact = catalogue.filter(e => e.name === name)
  const loose = exact.length ? exact : catalogue.filter(e => e.name.toLowerCase() === name.toLowerCase())
  return loose.find(e => e.video_url) ?? loose[0]
}

interface UseEditProgramOptions {
  athleteId:  string
  programId?: string          // undefined = new program mode
  onSuccess:  (athleteId: string) => void
  catalogue:  CatalogueItem[]
}

export function useEditProgram({
  athleteId,
  programId,
  onSuccess,
  catalogue,
}: UseEditProgramOptions): UseEditProgramResult {
  // Keep a ref to catalogue so closures always see the latest value
  // even if catalogue prop updates after initial render
  const catalogueRef = useRef(catalogue)
  useEffect(() => { catalogueRef.current = catalogue }, [catalogue])

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [days,    setDays]    = useState<UIDay[]>([])
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(!!programId)  // only loading if editing
  const [error,   setError]   = useState<string | null>(null)

  // Snapshot of the last loaded/saved state; anything different is unsaved
  const snapshot = (t: string, d: string, ds: UIDay[]) => JSON.stringify({ t, d, ds })
  const [saved, setSaved] = useState(() => snapshot('', '', []))

  // Load existing program when in edit mode
  useEffect(() => {
    if (!programId) { setLoading(false); return }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      const raw = await getProgramRawById(programId)

      if (cancelled) return

      if (!raw) {
        setError('Program not found')
      } else {
        const vm = mapToEditProgramViewModel(raw)
        setTitle(vm.title)
        setDescription(vm.description ?? '')
        setDays(vm.days)
        setSaved(snapshot(vm.title, vm.description ?? '', vm.days))
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [programId])

  // ── Day mutations ─────────────────────────────────────────────────────────

  const addDay = () => {
    setDays(prev => [...prev, createUIDay(getVisibleDays(prev).length)])
  }

  const removeDay = (tempId: string) =>
    setDays(prev =>
      prev
        .map(d => d._tempId === tempId ? (d.id ? { ...d, _deleted: true } : null) : d)
        .filter(Boolean) as UIDay[]
    )

  const updateDayName = (tempId: string, name: string) =>
    setDays(prev => prev.map(d => d._tempId === tempId ? { ...d, name } : d))

  // ── Reordering ────────────────────────────────────────────────────────────
  // Arrays still contain soft-deleted items; moving by tempId within the full
  // array is fine because save() derives order_index from array position.

  const move = <T extends { _tempId: string }>(items: T[], activeId: string, overId: string): T[] => {
    const from = items.findIndex(i => i._tempId === activeId)
    const to   = items.findIndex(i => i._tempId === overId)
    return from < 0 || to < 0 ? items : arrayMove(items, from, to)
  }

  const moveDay = (activeId: string, overId: string) =>
    setDays(prev => move(prev, activeId, overId))

  const moveBlock = (dayTempId: string, activeId: string, overId: string) =>
    setDays(prev => prev.map(d =>
      d._tempId !== dayTempId ? d : { ...d, blocks: move(d.blocks, activeId, overId) }
    ))

  const moveExercise = (dayTempId: string, blockTempId: string, activeId: string, overId: string) =>
    setDays(prev => prev.map(d =>
      d._tempId !== dayTempId ? d : {
        ...d,
        blocks: d.blocks.map(b =>
          b._tempId !== blockTempId ? b : { ...b, exercises: move(b.exercises, activeId, overId) }
        ),
      }
    ))

  // ── Block mutations ───────────────────────────────────────────────────────

  const addBlock = (dayTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      const count = d.blocks.filter(b => !b._deleted).length
      return { ...d, blocks: [...d.blocks, createUIBlock(count)] }
    }))

  const removeBlock = (dayTempId: string, blockTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks
          .map(b => b._tempId === blockTempId ? (b.id ? { ...b, _deleted: true } : null) : b)
          .filter(Boolean) as UIBlock[],
      }
    }))

  const updateBlockName = (dayTempId: string, blockTempId: string, name: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return { ...d, blocks: d.blocks.map(b => b._tempId === blockTempId ? { ...b, name } : b) }
    }))

  // ── Exercise mutations ────────────────────────────────────────────────────

  const addExercise = (dayTempId: string, blockTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return { ...b, exercises: [...b.exercises, createUIBlockExercise()] }
        }),
      }
    }))

  const removeExercise = (dayTempId: string, blockTempId: string, idx: number) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises
              .map((ex, i) => i === idx ? (ex.id ? { ...ex, _deleted: true } : null) : ex)
              .filter(Boolean) as UIBlockExercise[],
          }
        }),
      }
    }))

  // Updates exerciseName live on every keystroke (for the input display)
  const updateExField = (
    dayTempId:   string,
    blockTempId: string,
    idx:         number,
    field:       keyof UIBlockExercise,
    value:       string,
  ) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) => {
              if (i !== idx) return ex
              if (field === 'exerciseName') {
                const matched = matchByName(catalogueRef.current, value)
                return {
                  ...ex,
                  exerciseName: value,
                  exerciseId:   matched?.id        ?? '',
                  video_url:    matched?.video_url ?? undefined,
                }
              }
              return { ...ex, [field]: value }
            }),
          }
        }),
      }
    }))

  // Resolves exerciseId on blur — catches cases where onChange fired mid-type
  // and the final name was never matched (e.g. user typed slowly, datalist filled)
  const resolveExerciseId = (
    dayTempId:   string,
    blockTempId: string,
    idx:         number,
    name:        string,
  ) => {
    const matched = matchByName(catalogueRef.current, name)
    if (!matched) return
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) => {
              if (i !== idx) return ex
              // Keep an exercise picked by id if its name still matches — it may be
              // one of several catalogue entries sharing this name
              const current = catalogueRef.current.find(e => e.id === ex.exerciseId)
              if (current && current.name.toLowerCase() === name.toLowerCase()) return ex
              return {
                ...ex,
                exerciseName: matched.name,
                exerciseId:   matched.id,
                video_url:    matched.video_url ?? undefined,
              }
            }),
          }
        }),
      }
    }))
  }

  // Picked from the exercise picker: use that exact catalogue entry
  const selectExercise = (dayTempId: string, blockTempId: string, idx: number, item: CatalogueItem) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) => i !== idx ? ex : {
              ...ex,
              exerciseName: item.name,
              exerciseId:   item.id,
              video_url:    item.video_url ?? undefined,
            }),
          }
        }),
      }
    }))

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!title.trim()) { setError('Title is required'); return }

    setSaving(true)
    setError(null)

    const vm: EditProgramViewModel = { programId, title, description, days }

    try {
      if (programId) {
        await updateProgram(vm)
      } else {
        await createProgram(athleteId, vm)
      }
      setSaved(snapshot(title, description, days))
      onSuccess(athleteId)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return {
    title,
    description,
    days,
    saving,
    loading,
    error,
    visibleDays:    getVisibleDays(days),
    totalExercises: getTotalExercises(days),
    dirty:          !loading && snapshot(title, description, days) !== saved,
    setTitle,
    setDescription,
    addDay,
    removeDay,
    updateDayName,
    moveDay,
    addBlock,
    removeBlock,
    updateBlockName,
    moveBlock,
    addExercise,
    removeExercise,
    updateExField,
    resolveExerciseId,
    selectExercise,
    moveExercise,
    save,
  }
}