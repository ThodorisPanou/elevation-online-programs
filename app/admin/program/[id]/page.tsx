'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useProgram } from '@/lib/hooks/useProgram'
import { Loader, NotFound } from '@/components/pageStatus'
import { ProgramHero, ProgramDays } from '@/components/programView'

export default function AdminProgramPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params?.id as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(id)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [])

  if (loading) return <Loader />
  if (notFound || !program) return <NotFound message="Program not found" />

  return (
    <div className="page">
      <header className="header">
        <button className="btn-back" onClick={() => router.back()}>← Back</button>
        <button
          className="btn btn-edit"
          onClick={() => router.push(`/admin/programs/${program.athlete?.id ?? ''}/edit/${program.id}`)}
        >
          Edit Program
        </button>
      </header>

      <ProgramHero program={program} compact />
      <ProgramDays days={program.days} activeDay={activeDay} setActiveDay={setActiveDay} belowHeader />
    </div>
  )
}
