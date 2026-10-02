'use client'

import { useRouter, useParams } from 'next/navigation'
import { useProgram } from '@/lib/hooks/useProgram'
import { Loader, NotFound } from '@/components/pageStatus'
import { ProgramView } from '@/components/programView'
import { ArrowLeft, Pencil } from 'lucide-react'

export default function AdminProgramPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params?.id as string

  const { program, loading, notFound, activeDay, setActiveDay } = useProgram(id)


  if (loading) return <Loader />
  if (notFound || !program) return <NotFound message="Program not found" />

  return (
    <div className="page">
      <header className="header">
        <button className="btn-back" onClick={() => router.back()}><ArrowLeft size={16} aria-hidden /> Back</button>
        <button
          className="btn btn-edit"
          onClick={() => router.push(`/admin/programs/${program.athlete?.id ?? ''}/edit/${program.id}`)}
        >
          <Pencil size={14} aria-hidden /> Edit Program
        </button>
      </header>

      {/* Exactly what the athlete sees on the share link */}
      <ProgramView program={program} activeDay={activeDay} setActiveDay={setActiveDay} />
    </div>
  )
}
