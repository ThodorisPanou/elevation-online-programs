// lib/hooks/useEditProgram.ts

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  days:             UIDay[]
  saving:           boolean
  loading:          boolean
  error:            string | null
  // Derived
  visibleDays:      UIDay[]
  totalExercises:   number
  // Title
  setTitle:         (title: string) => void
  // Day actions
  addDay:           () => void
  removeDay:        (tempId: string) => void
  updateDayName:    (tempId: string, name: string) => void
  // Block actions
  addBlock:         (dayTempId: string) => void
  removeBlock:      (dayTempId: string, blockTempId: string) => void
  updateBlockName:  (dayTempId: string, blockTempId: string, name: string) => void
  // Exercise actions
  addExercise:      (dayTempId: string, blockTempId: string) => void
  removeExercise:   (dayTempId: string, blockTempId: string, idx: number) => void
  updateExField:    (dayTempId: string, blockTempId: string, idx: number, field: keyof UIBlockExercise, value: string) => void
  resolveExerciseId: (dayTempId: string, blockTempId: string, idx: number, name: string) => void
  // Save
  save:             () => Promise<void>
}

interface UseEditProgramOptions {
  athleteId:  string
  programId?: string          // undefined = new program mode
  onSuccess:  (athleteId: string) => void
  catalogue:  { id: string; name: string; video_url?: string }[]
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

  const [title,   setTitle]   = useState('')
  const [days,    setDays]    = useState<UIDay[]>([])
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(!!programId)  // only loading if editing
  const [error,   setError]   = useState<string | null>(null)

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
        setDays(vm.days)
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
                const matched = catalogueRef.current.find(e => e.name.toLowerCase() === value.toLowerCase())
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
    const matched = catalogueRef.current.find(e => e.name.toLowerCase() === name.toLowerCase())
    if (!matched) return
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) =>
              i === idx ? {
                ...ex,
                exerciseName: matched.name,
                exerciseId:   matched.id,
                video_url:    matched.video_url ?? undefined,
              } : ex
            ),
          }
        }),
      }
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!title.trim()) { setError('Title is required'); return }

    setSaving(true)
    setError(null)

    const vm: EditProgramViewModel = { programId, title, days }

    try {
      if (programId) {
        await updateProgram(vm)
      } else {
        await createProgram(athleteId, vm)
      }
      onSuccess(athleteId)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return {
    title,
    days,
    saving,
    loading,
    error,
    visibleDays:    getVisibleDays(days),
    totalExercises: getTotalExercises(days),
    setTitle,
    addDay,
    removeDay,
    updateDayName,
    addBlock,
    removeBlock,
    updateBlockName,
    addExercise,
    removeExercise,
    updateExField,
    resolveExerciseId,
    save,
  }
}

