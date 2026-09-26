'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useEditProgram } from '@/lib/hooks/useEditProgram'
import { useExercises } from '@/lib/hooks/useExercises'
import ProgramEditor from '@/components/programEditor'
import { Loader } from '@/components/pageStatus'

export default function EditProgramPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId  = params?.athlete_id  as string
  const programId  = params?.program_id  as string

  const { catalogue } = useExercises()

  const {
    title, description, visibleDays, totalExercises, saving, loading, error,
    setTitle, setDescription, addDay, removeDay, updateDayName,
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

  if (loading) return <Loader />

  return (
    <ProgramEditor
      title={title}
      description={description ?? ''}
      visibleDays={visibleDays}
      totalExercises={totalExercises}
      saving={saving}
      error={error}
      catalogue={catalogue}
      saveLabel="Save Changes"
      breadcrumb="Edit Program"
      setTitle={setTitle}
      setDescription={setDescription}
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