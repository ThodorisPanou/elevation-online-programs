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

  const editor = useEditProgram({
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

  if (editor.loading) return <Loader />

  return (
    <ProgramEditor
      {...editor}
      catalogue={catalogue}
      saveLabel="Save Changes"
      breadcrumb="Edit Program"
      onSave={editor.save}
      onBack={() => router.back()}
    />
  )
}