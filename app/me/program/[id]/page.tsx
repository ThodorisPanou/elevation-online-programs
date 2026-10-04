'use client'

// app/me/program/[id]/page.tsx
// One of the athlete's own programs, in the same view as the share link, plus a "Log" button on the exercises the
// coach tracks.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LogShell, ProgramLoader, ProgramView, StepExtra } from '@/components/programView'
import { RecordLine, RecordSheet, useExerciseLogs } from '@/components/exerciseRecords'
import { ProgramViewModel, ViewBlockExercise } from '@/lib/viewModels/ProgramViewModel'
import { getMyProgram } from '@/lib/services/athleteAppService'
import { MeNav } from '../../meNav'

export default function MyProgramPage() {
  const id = useParams()?.id as string

  const [program,   setProgram]   = useState<ProgramViewModel | null>(null)
  const [state,     setState]     = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [activeDay, setActiveDay] = useState(0)
  const [logging,   setLogging]   = useState<ViewBlockExercise | null>(null)
  const records = useExerciseLogs(program)

  useEffect(() => {
    let cancelled = false
    getMyProgram(id)
      .then(p => { if (cancelled) return; setProgram(p); setState(p ? 'ready' : 'missing') })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [id])

  if (state === 'loading') return <ProgramLoader />
  if (state !== 'ready' || !program) {
    return (
      <LogShell nav={<MeNav back />}>
        <h1 className="log-athlete">{state === 'missing' ? 'Program not found' : 'Something went wrong'}</h1>
        <p className="log-brief">
          {state === 'missing'
            ? 'It may have been removed by your coach.'
            : 'We couldn’t load this program. Check your connection and try again.'}
        </p>
      </LogShell>
    )
  }

  const stepExtra: StepExtra = be =>
    be.track && be.exercise?.id ? <RecordLine be={be} logs={records.of(be.exercise.id)} onLog={() => setLogging(be)} /> : null

  return (
    <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} nav={<MeNav back />} stepExtra={stepExtra}>
      {logging && <RecordSheet be={logging} records={records} onClose={() => setLogging(null)} />}
    </ProgramView>
  )
}
