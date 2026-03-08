'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEditProgram } from '@/lib/hooks/useEditProgram'
import { useExercises } from '@/lib/hooks/useExercises'
import ProgramEditor from '@/components/programEditor'

export default function EditProgramPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId  = params?.athlete_id  as string
  const programId  = params?.program_id  as string

  const { catalogue } = useExercises()

  const {
    title, visibleDays, totalExercises, saving, loading, error,
    setTitle, addDay, removeDay, updateDayName,
    addBlock, removeBlock, updateBlockName,
    addExercise, removeExercise, updateExField, resolveExerciseId,
    save,
  } = useEditProgram({
    athleteId,
    programId,
    catalogue,
    onSuccess: (id) => router.push(`/admin/programs/${id}`),
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');
        body { background:#0d0d0f; margin:0; }
        .loader { display:flex; align-items:center; justify-content:center; min-height:100vh; gap:8px; }
        .loader-dot { width:8px; height:8px; border-radius:50%; background:#e8ff4a; animation:bounce 0.8s infinite alternate; }
        .loader-dot:nth-child(2){animation-delay:0.2s} .loader-dot:nth-child(3){animation-delay:0.4s}
        @keyframes bounce { to { transform:translateY(-12px); opacity:0.4; } }
      `}</style>
      <div className="loader">
        <div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/>
      </div>
    </>
  )

  return (
    <ProgramEditor
      title={title}
      visibleDays={visibleDays}
      totalExercises={totalExercises}
      saving={saving}
      error={error}
      catalogue={catalogue}
      saveLabel="Save Changes"
      breadcrumb="Edit Program"
      setTitle={setTitle}
      addDay={addDay}
      removeDay={removeDay}
      updateDayName={updateDayName}
      addBlock={addBlock}
      removeBlock={removeBlock}
      updateBlockName={updateBlockName}
      addExercise={addExercise}
      removeExercise={removeExercise}
      updateExField={updateExField}
      resolveExerciseId={resolveExerciseId}
      onSave={save}
      onBack={() => router.back()}
    />
  )
}
