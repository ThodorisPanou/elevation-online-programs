'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'


export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      fetchAthletes()
    }
    check()
  }, [])

const fetchAthletes = async () => {
  const res = await supabase.from('athletes').select('*');
  console.log('fetch athletes response', res);
  if (res.error) {
    alert(res.error.message);
    return;
  }
  if (!res.data) {
    console.warn('supabase returned no data (null)');
    return;
  }
  setAthletes(res.data);
};

  const addAthlete = async () => {
    if (!name || !surname) return
    const { error } = await supabase.from('athletes').insert([{ name, surname }])
    if (error) return alert(error.message)
    setName(''); setSurname('')
    setShowModal(false)
    fetchAthletes()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6 text-center text-gray-900">Athletes</h1>

        <ul className="space-y-4">
          {athletes.map(a => (
            <li
              key={a.id}
              className="flex items-center gap-4 p-4 bg-white rounded-lg shadow hover:shadow-md transition"
            >
              {a.avatar_url ? (
                <img
                  src={a.avatar_url}
                  alt="avatar"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
              )}
              <span className="flex-1 font-medium text-gray-800">
                {a.name} {a.surname}
              </span>

              <button
                onClick={() => router.push(`/admin/programs/${a.id}`)}
                className="text-blue-600 hover:text-blue-800 transition mr-3"
              >
                Programs
              </button>
              <button
                onClick={() => router.push(`/admin/programs/${a.id}/new`)}
                className="text-green-600 hover:text-green-800 transition"
              >
                +Program
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-center mt-8">
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-full shadow hover:bg-blue-700 transition"
          >
            Add athlete
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-8 rounded-xl shadow-xl w-96 text-black">
            <h2 className="text-2xl font-semibold mb-4">New athlete</h2>
            <div className="flex flex-col gap-3">
              <input
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border p-2 rounded text-black w-full"
              />
              <input
                placeholder="Surname"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                className="border p-2 rounded text-black w-full"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded border text-black"
              >
                Cancel
              </button>
              <button
                onClick={addAthlete}
                className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}