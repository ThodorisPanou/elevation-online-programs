'use client'

// app/program/[token]/page.tsx
// The program by share link — no login needed, read-only. The athlete's coach (or the admin) opening it with
// "View" also sees the athlete's records under tracked exercises, still read-only; the record count opens the
// exercise's history. Nobody logs anything here:
// athletes do that in their app (/me).

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { useCoachRecords } from '@/lib/hooks/useCoachRecords'
import { ProgramLoader, ProgramNotFound, ProgramView, StepExtra } from '@/components/programView'
import { RecordHistorySheet, RecordLine } from '@/components/exerciseRecords'
import { ViewBlockExercise } from '@/lib/viewModels/ProgramViewModel'

export default function PublicProgramPage() {
  const params = useParams()
  const guid   = params?.token as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(guid)
  const records = useCoachRecords(program)
  const [history, setHistory] = useState<ViewBlockExercise | null>(null)

  if (loading) return <ProgramLoader />
  if (notFound || !program) return <ProgramNotFound />

  const logsOf = (be: ViewBlockExercise) => (records ?? []).filter(l => l.exercise_id === be.exercise?.id)

  const stepExtra: StepExtra | undefined = records
    ? be => be.track && be.exercise?.id
      ? <RecordLine be={be} logs={logsOf(be)} onHistory={() => setHistory(be)} />
      : null
    : undefined

  return (
    <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} stepExtra={stepExtra}>
      {history && (
        <RecordHistorySheet
          be={history}
          logs={logsOf(history)}
          athleteName={program.athlete?.name ?? 'The athlete'}
          onClose={() => setHistory(null)}
        />
      )}
    </ProgramView>
  )
}
