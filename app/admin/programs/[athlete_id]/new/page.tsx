'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEditProgram } from '@/lib/hooks/useEditProgram'
import { useExercises } from '@/lib/hooks/useExercises'
import ProgramEditor from '@/components/programEditor'

export default function NewProgramPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId = params?.athlete_id as string

  const { catalogue } = useExercises()

  const {
    title, visibleDays, totalExercises, saving, error,
    setTitle, addDay, removeDay, updateDayName,
    addBlock, removeBlock, updateBlockName,
    addExercise, removeExercise, updateExField, resolveExerciseId,
    save,
  } = useEditProgram({
    athleteId,
    catalogue,
    onSuccess: (id) => router.push(`/admin/programs/${id}`),
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

  return (
    <ProgramEditor
      title={title}
      visibleDays={visibleDays}
      totalExercises={totalExercises}
      saving={saving}
      error={error}
      catalogue={catalogue}
      saveLabel="Create Program"
      breadcrumb="New Program"
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
