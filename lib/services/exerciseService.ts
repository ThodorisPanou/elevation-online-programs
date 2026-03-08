// lib/services/exerciseService.ts

import { supabase } from '@/lib/supabaseClient'
import {
  ExerciseViewModel,
  ExerciseCatalogueItem,
  mapToExerciseViewModel,
  mapToExerciseCatalogueItem,
} from '@/lib/viewModels/ExerciseViewModel'

// Full details — used if you build an exercise management page
export async function getAllExercises(): Promise<ExerciseViewModel[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, description, video_url, created_at')
    .order('name')

  if (error) { console.error('getAllExercises:', error); return [] }

  return (data ?? []).map(mapToExerciseViewModel)
}

// Lightweight list — used in dropdowns and datalists on program edit/create
export async function getExerciseCatalogue(): Promise<ExerciseCatalogueItem[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, video_url')
    .order('name')

  if (error) { console.error('getExerciseCatalogue:', error); return [] }

  return (data ?? []).map(mapToExerciseCatalogueItem)
}

export async function getExerciseById(id: string): Promise<ExerciseViewModel | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, description, video_url, created_at')
    .eq('id', id)
    .single()

  if (error) { console.error('getExerciseById:', error); return null }
  if (!data)  return null

  return mapToExerciseViewModel(data)
}

// Upload a video to Supabase Storage and save the public URL on the exercise.
// The bucket name is 'exercise-videos' — create it in Supabase Storage first.
export async function uploadExerciseVideo(exerciseId: string, file: File): Promise<string> {
  const ext      = file.name.split('.').pop()
  const path     = `${exerciseId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('exercise-videos')
    .upload(path, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('exercise-videos')
    .getPublicUrl(path)

  const publicUrl = data.publicUrl

  const { error: updateError } = await supabase
    .from('exercises')
    .update({ video_url: publicUrl })
    .eq('id', exerciseId)

  if (updateError) throw updateError

  return publicUrl
}

export async function removeExerciseVideo(exerciseId: string): Promise<void> {
  // Fetch current video_url to get the storage path
  const { data, error: fetchError } = await supabase
    .from('exercises')
    .select('video_url')
    .eq('id', exerciseId)
    .single()

  if (fetchError) throw fetchError

  if (data?.video_url) {
    const path = data.video_url.split('/').pop()!
    await supabase.storage.from('exercise-videos').remove([path])
  }

  const { error } = await supabase
    .from('exercises')
    .update({ video_url: null })
    .eq('id', exerciseId)

  if (error) throw error
}
