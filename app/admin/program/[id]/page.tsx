'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'


export default function ProgramEditor({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [programDays, setProgramDays] = useState<ProgramDay[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  useEffect(() => {
    fetchProgram()
    fetchExercises()
  }, [])

  const fetchProgram = async () => {
    const { data, error } = await supabase
      .from('program_days')
      .select(`
        id,
        name,
        blocks (
          id,
          name,
          block_exercises (
            id,
            exercises:id,name
          )
        )
      `)
      .eq('program_id', params.id)

    if (error) return alert(error.message)
    // setProgramDays(data || [])
  }

  const fetchExercises = async () => {
    const { data } = await supabase.from('exercises').select('*')
    setAllExercises(data || [])
  }

  const addDay = async () => {
    const dayName = `Day ${programDays.length + 1}`
    const { data, error } = await supabase
      .from('program_days')
      .insert([{ program_id: params.id, name: dayName, order_index: programDays.length }])
      .select('*')
      .single()
    if (error) return alert(error.message)
    setProgramDays([...programDays, { ...data, blocks: [] }])
  }

  const addBlock = async (dayId: string) => {
    const { data, error } = await supabase
      .from('blocks')
      .insert([{ day_id: dayId, name: 'New Block', order_index: 0 }])
      .select('*')
      .single()
    if (error) return alert(error.message)

    setProgramDays(programDays.map(day => 
      day.id === dayId ? { ...day, blocks: [...(day.blocks || []), { ...data, block_exercises: [] }] } : day
    ))
  }

  const addExerciseToBlock = async (blockId: string, exerciseId: string) => {
    const { data, error } = await supabase
      .from('block_exercises')
      .insert([{ block_id: blockId, exercise_id: exerciseId, order_index: 0 }])
      .select(`*, exercises(*)`)
      .single()
    if (error) return alert(error.message)

    setProgramDays(programDays.map(day => ({
      ...day,
      blocks: (day.blocks || []).map(block => 
        block.id === blockId ? { ...block, block_exercises: [...(block.block_exercises || []) , { ...data, exercise: data.exercises }] } : block
      )
    })))
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Program Builder</h1>
      <button onClick={addDay} className="bg-green-500 text-white px-3 py-1 rounded mb-4">Add Day</button>

      {programDays.map(day => (
        <div key={day.id} className="mb-4 border p-2 rounded">
          <h2 className="text-xl font-semibold">{day.name}</h2>
          <button onClick={() => addBlock(day.id)} className="bg-blue-500 text-white px-2 py-1 rounded my-2">
            Add Block
          </button>

          {(day.blocks || []).map(block => (
            <div key={block.id} className="ml-4 mb-2 p-2 border rounded">
              <h3 className="font-semibold">{block.name}</h3>
              <select
                onChange={e => addExerciseToBlock(block.id, e.target.value)}
                className="border p-1 rounded my-2"
              >
                <option value="">Add Exercise...</option>
                {allExercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>

              <ul className="ml-2">
                {block.block_exercises?.map(be => (
                  <li key={be.id}>{be.exercise.name} {be.sets && `- ${be.sets} sets`} {be.reps && `x ${be.reps}`} {be.kg && `@ ${be.kg}`}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}