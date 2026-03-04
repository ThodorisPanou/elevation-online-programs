'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

interface Program {
  id: string
  title: string
  public_token: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
      else fetchPrograms()
    }
    checkSession()
  }, [])

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
    if (error) return alert(error.message)
    setPrograms(data)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <button
        onClick={() => router.push('/admin/athletes')}
        className="bg-green-500 text-white px-3 py-1 rounded mb-4"
      >
        Manage Athletes
      </button>

      <h2 className="text-xl mb-2">Programs</h2>
      <ul>
        {programs.map(p => (
          <li key={p.id} className="flex justify-between items-center mb-2">
            <span>{p.title}</span>
            <div className="flex gap-2">
              <button onClick={() => router.push(`/admin/program/${p.id}`)} className="bg-blue-500 text-white px-2 py-1 rounded">
                Edit
              </button>
              <a href={`/program/${p.public_token}`} target="_blank" className="bg-gray-500 text-white px-2 py-1 rounded">
                Public Link
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}