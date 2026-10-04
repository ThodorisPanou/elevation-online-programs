'use client'

// app/program/[token]/page.tsx
// The program by share link — no login needed, read-only. The athlete's coach (or the admin) opening it with
// "View" also sees the athlete's records under tracked exercises, still read-only. Nobody logs anything here:
// athletes do that in their app (/me).

import { useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { useCoachRecords } from '@/lib/hooks/useCoachRecords'
import { ProgramLoader, ProgramNotFound, ProgramView, StepExtra } from '@/components/programView'
import { RecordLine } from '@/components/exerciseRecords'

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(guid)
  const records = useCoachRecords(program)

  if (loading) return <ProgramLoader />
  if (notFound || !program) return <ProgramNotFound />

  const stepExtra: StepExtra | undefined = records
    ? be => be.track && be.exercise?.id
      ? <RecordLine be={be} logs={records.filter(l => l.exercise_id === be.exercise.id)} />
      : null
    : undefined

  return <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} stepExtra={stepExtra} />
}
