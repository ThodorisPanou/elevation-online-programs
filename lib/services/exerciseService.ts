// lib/services/exerciseService.ts

import { supabase } from '@/lib/supabaseClient'
import {
  ExerciseViewModel,
  ExerciseCatalogueItem,
  mapToExerciseViewModel,
  mapToExerciseCatalogueItem,
} from '@/lib/viewModels/ExerciseViewModel'

export async function getAllExercises(): Promise<ExerciseViewModel[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, description, video_url, created_at')
    .order('name')

  if (error) { console.error('getAllExercises:', error); return [] }
  return (data ?? []).map(mapToExerciseViewModel)
}

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

// ─── Cloudflare R2 ─────────────────────────────────────────────────────────
// video_url in the DB stores the full R2 public URL
// e.g. https://pub-xxx.r2.dev/uuid.mp4
// The <video> tag uses it directly.

export async function uploadExerciseVideo(exerciseId: string, file: File): Promise<string> {
  // 1. Delete old video from R2 if exists
  const { data: existing } = await supabase
    .from('exercises')
    .select('video_url')
    .eq('id', exerciseId)
    .single()

  if (existing?.video_url) {
    fetch('/api/delete-video', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ videoId: existing.video_url }),
    }).catch(e => console.warn('Old video delete failed:', e))
  }

  // 2. Upload to R2 via API route
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload-video', {
    method: 'POST',
    body:   formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Video upload failed')
  }

  const { videoId: publicUrl } = await res.json()

  // 3. Save the public URL to exercises table
  const { error: updateError } = await supabase
    .from('exercises')
    .update({ video_url: publicUrl })
    .eq('id', exerciseId)

  if (updateError) throw updateError

  return publicUrl
}

export async function removeExerciseVideo(exerciseId: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('exercises')
    .select('video_url')
    .eq('id', exerciseId)
    .single()

  if (fetchError) throw fetchError

  if (data?.video_url) {
    const res = await fetch('/api/delete-video', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ videoId: data.video_url }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Video delete failed')
    }
  }

  const { error } = await supabase
    .from('exercises')
    .update({ video_url: null })
    .eq('id', exerciseId)

  if (error) throw error
}
