'use client'

import { useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { ProgramLoader, ProgramNotFound, ProgramView } from '@/components/programView'

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(guid)

  if (loading) return <ProgramLoader />
  if (notFound || !program) return <ProgramNotFound />

  return <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} />
}
