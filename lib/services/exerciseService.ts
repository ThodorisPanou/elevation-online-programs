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

// ─── Cloudflare R2 — direct browser upload via presigned URL ───────────────
// Flow:
//   1. Ask our API route for a presigned PUT URL (no file involved, tiny request)
//   2. Browser PUTs the file directly to R2 — no server size limit
//   3. Save the public URL to exercises.video_url

export async function uploadExerciseVideo(
  exerciseId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // 1. Delete old video if exists (fire and forget)
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

  // 2. Get presigned URL from our API route
  const res = await fetch('/api/upload-video', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ filename: file.name, contentType: file.type }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Failed to get upload URL')
  }

  const { presignedUrl, publicUrl } = await res.json()

  // 3. Upload directly to R2 from the browser with progress tracking
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`R2 upload failed: ${xhr.status} ${xhr.responseText}`))
    }

    xhr.onerror = () => reject(new Error('R2 upload network error'))
    xhr.send(file)
  })

  // 4. Save the public URL to the DB
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
