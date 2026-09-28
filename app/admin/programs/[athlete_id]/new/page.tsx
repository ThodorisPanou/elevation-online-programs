'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEditProgram } from '@/lib/hooks/useEditProgram'
import { useExercises } from '@/lib/hooks/useExercises'
import ProgramEditor from '@/components/programEditor'

export default function NewProgramPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId = params?.athlete_id as string

  const { catalogue } = useExercises(athleteId)

  const editor = useEditProgram({
    athleteId,
    catalogue,
    onSuccess: (id) => router.push(`/admin/programs/${id}`),
  })


  return (
    <ProgramEditor
      {...editor}
      catalogue={catalogue}
      saveLabel="Create Program"
      breadcrumb="New Program"
      onSave={editor.save}
      onBack={() => router.push(`/admin/programs/${athleteId}`)}
    />
  )
}