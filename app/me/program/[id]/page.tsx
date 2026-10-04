'use client'

// app/me/program/[id]/page.tsx
// One of the athlete's own programs, in the same view as the share link.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LogShell, ProgramLoader, ProgramView } from '@/components/programView'
import { ProgramViewModel } from '@/lib/viewModels/ProgramViewModel'
import { getMyProgram } from '@/lib/services/athleteAppService'
import { MeNav } from '../../meNav'

export default function MyProgramPage() {
  const id = useParams()?.id as string

  const [program,   setProgram]   = useState<ProgramViewModel | null>(null)
  const [state,     setState]     = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [activeDay, setActiveDay] = useState(0)

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

  return <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} nav={<MeNav back />} />
}
