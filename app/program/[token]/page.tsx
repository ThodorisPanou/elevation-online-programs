'use client'

import { useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { Loader, NotFound } from '@/components/pageStatus'
import { ProgramHero, ProgramDays } from '@/components/programView'

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(guid)

  if (loading) return <Loader />
  if (notFound || !program) return <NotFound message="Program not found" />

  return (
    <div className="page">
      <ProgramHero program={program} />
      <ProgramDays days={program.days} activeDay={activeDay} setActiveDay={setActiveDay} />
    </div>
  )
}
