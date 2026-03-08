// lib/services/programService.ts

import { supabase } from '@/lib/supabaseClient'
import { ProgramViewModel, mapToProgramViewModel } from '@/lib/viewModels/ProgramViewModel'
import { EditProgramViewModel, UIDay, UIBlock, UIBlockExercise } from '@/lib/viewModels/EditProgramViewModel'

// ─── Shared query ─────────────────────────────────────────────────────────

const PROGRAM_QUERY = `
  id, title, public_token, created_at,
  athletes ( id, name, surname, avatar_url ),
  program_days (
    id, name, order_index,
    blocks (
      id, name, order_index,
      block_exercises (
        id, sets, reps, kg, rest_seconds, notes, order_index,
        exercises ( id, name, video_url )
      )
    )
  )
`

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getProgramByToken(token: string): Promise<ProgramViewModel | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_QUERY)
    .eq('public_token', token)
    .maybeSingle()

  if (error) { console.error('getProgramByToken:', error); return null }
  if (!data)  return null

  return mapToProgramViewModel(data)
}

export async function getProgramById(id: string): Promise<ProgramViewModel | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_QUERY)
    .eq('id', id)
    .maybeSingle()

  if (error) { console.error('getProgramById:', error); return null }
  if (!data)  return null

  return mapToProgramViewModel(data)
}

export async function getProgramsByAthleteId(athleteId: string): Promise<ProgramViewModel[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_QUERY)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (error) { console.error('getProgramsByAthleteId:', error); return [] }

  return (data ?? []).map(mapToProgramViewModel)
}

// Raw load for edit page — returns unnested DB shape for mapToEditProgramViewModel
export async function getProgramRawById(id: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      id, title,
      program_days (
        id, name, order_index,
        blocks (
          id, name, order_index,
          block_exercises (
            id, sets, reps, kg, rest_seconds, notes, order_index,
            exercises ( id, name, video_url )
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) { console.error('getProgramRawById:', error); return null }
  return data
}

// ─── Write ────────────────────────────────────────────────────────────────

export async function createProgram(athleteId: string, vm: EditProgramViewModel): Promise<string | null> {
  const { data, error } = await supabase
    .from('programs')
    .insert([{ athlete_id: athleteId, title: vm.title }])
    .select()
    .single()

  if (error) { console.error('createProgram:', error); throw error }

  await saveDays(data.id, vm.days)
  return data.id
}

export async function updateProgram(vm: EditProgramViewModel): Promise<void> {
  if (!vm.programId) throw new Error('programId is required for updateProgram')

  const { error } = await supabase
    .from('programs')
    .update({ title: vm.title })
    .eq('id', vm.programId)

  if (error) { console.error('updateProgram:', error); throw error }

  await saveDays(vm.programId, vm.days)
}

export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', programId)
  if (error) { console.error('deleteProgram:', error); throw error }
}

// ─── Private save helpers ─────────────────────────────────────────────────

async function saveDays(programId: string, days: UIDay[]): Promise<void> {
  for (let di = 0; di < days.length; di++) {
    const day = days[di]
    let dayId = day.id

    if (day._deleted && dayId) {
      const { error } = await supabase.from('program_days').delete().eq('id', dayId)
      if (error) throw error
      continue
    }

    if (!dayId) {
      const { data, error } = await supabase
        .from('program_days')
        .insert([{ program_id: programId, name: day.name, order_index: di }])
        .select()
        .single()
      if (error) throw error
      dayId = data.id
    } else {
      const { error } = await supabase
        .from('program_days')
        .update({ name: day.name, order_index: di })
        .eq('id', dayId)
      if (error) throw error
    }

    await saveBlocks(dayId as string, day.blocks)
  }
}

async function saveBlocks(dayId: string, blocks: UIBlock[]): Promise<void> {
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]
    let blockId = block.id

    if (block._deleted && blockId) {
      const { error } = await supabase.from('blocks').delete().eq('id', blockId)
      if (error) throw error
      continue
    }

    if (!blockId) {
      const { data, error } = await supabase
        .from('blocks')
        .insert([{ day_id: dayId, name: block.name, order_index: bi }])
        .select()
        .single()
      if (error) throw error
      blockId = data.id
    } else {
      const { error } = await supabase
        .from('blocks')
        .update({ name: block.name, order_index: bi })
        .eq('id', blockId)
      if (error) throw error
    }

    await saveBlockExercises(blockId as string, block.exercises)
  }
}

// Resolves the exercise_id to use:
// 1. Name matches catalogue → use existing exercise id as-is
// 2. Has an existing block_exercise id (editing saved row) + no catalogue match
//    → update the exercise name in place, reuse the same exercise_id
// 3. No existing id at all → create a new exercise row
async function resolveExerciseId(ex: UIBlockExercise): Promise<string | null> {
  if (!ex.exerciseName?.trim()) return null

  // Matched to a catalogue exercise — use it directly
  if (ex.exerciseId) return ex.exerciseId

  // Existing saved row whose exercise name was changed to something not in catalogue
  // Update the exercise name in place rather than creating a duplicate
  if (ex.id) {
    // Fetch current exercise_id for this block_exercise row
    const { data: beRow, error: fetchError } = await supabase
      .from('block_exercises')
      .select('exercise_id')
      .eq('id', ex.id)
      .single()
    if (fetchError) throw fetchError

    if (beRow?.exercise_id) {
      const { error: updateError } = await supabase
        .from('exercises')
        .update({ name: ex.exerciseName.trim() })
        .eq('id', beRow.exercise_id)
      if (updateError) throw updateError
      return beRow.exercise_id
    }
  }

  // Brand new exercise — create it
  const { data, error } = await supabase
    .from('exercises')
    .insert([{ name: ex.exerciseName.trim() }])
    .select()
    .single()
  if (error) throw error
  return data.id
}

async function saveBlockExercises(blockId: string, exercises: UIBlockExercise[]): Promise<void> {
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei]

    // Hard delete
    if (ex._deleted && ex.id) {
      const { error } = await supabase.from('block_exercises').delete().eq('id', ex.id)
      if (error) throw error
      continue
    }

    // Skip rows with no name at all
    if (!ex.exerciseName?.trim()) continue

    // Resolve or create the exercise, getting back a guaranteed id
    const exerciseId = await resolveExerciseId(ex)
    if (!exerciseId) continue

    const fields = {
      exercise_id:  exerciseId,
      sets:         ex.sets         ? parseInt(ex.sets)         : null,
      reps:         ex.reps         || null,
      kg:           ex.kg           || null,
      rest_seconds: ex.rest_seconds ? parseInt(ex.rest_seconds) : null,
      notes:        ex.notes        || null,
      order_index:  ei,
    }

    if (!ex.id) {
      // INSERT
      const { error } = await supabase
        .from('block_exercises')
        .insert([{ block_id: blockId, ...fields }])
      if (error) throw error
    } else {
      // UPDATE — block_id never changes for an existing row
      const { error } = await supabase
        .from('block_exercises')
        .update(fields)
        .eq('id', ex.id)
      if (error) throw error
    }
  }
}



// ─── Copy ──────────────────────────────────────────────────────────────────

export async function copyProgram(programId: string, targetAthleteId: string): Promise<string> {
  // 1. Fetch full program
  const { data: prog, error: progErr } = await supabase
    .from('programs')
    .select(`
      title,
      program_days (
        name, order_index,
        blocks (
          name, order_index,
          block_exercises (
            sets, reps, kg, rest_seconds, notes, order_index, exercise_id
          )
        )
      )
    `)
    .eq('id', programId)
    .single()

  if (progErr) throw progErr

  // 2. Insert new program for target athlete
  const { data: newProg, error: newProgErr } = await supabase
    .from('programs')
    .insert([{
      athlete_id:   targetAthleteId,
      title:        prog.title + ' (Copy)',
      public_token: crypto.randomUUID(),
    }])
    .select()
    .single()

  if (newProgErr) throw newProgErr

  // 3. Insert days → blocks → exercises sequentially
  for (const day of (prog.program_days ?? [])) {
    const { data: newDay, error: dayErr } = await supabase
      .from('program_days')
      .insert([{ program_id: newProg.id, name: day.name, order_index: day.order_index }])
      .select()
      .single()

    if (dayErr) throw dayErr

    for (const block of (day.blocks ?? [])) {
      const { data: newBlock, error: blockErr } = await supabase
        .from('blocks')
        .insert([{ day_id: newDay.id, name: block.name, order_index: block.order_index }])
        .select()
        .single()

      if (blockErr) throw blockErr

      const exercises = (block.block_exercises ?? []).map((be: any) => ({
        block_id:     newBlock.id,
        exercise_id:  be.exercise_id,
        sets:         be.sets,
        reps:         be.reps,
        kg:           be.kg,
        rest_seconds: be.rest_seconds,
        notes:        be.notes,
        order_index:  be.order_index,
      }))

      if (exercises.length > 0) {
        const { error: exErr } = await supabase.from('block_exercises').insert(exercises)
        if (exErr) throw exErr
      }
    }
  }

  return newProg.id
}