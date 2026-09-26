// lib/services/exerciseService.ts

import { supabase } from '@/lib/supabaseClient'
import {
  ExerciseViewModel,
  ExerciseCatalogueItem,
  ExerciseLibraryItem,
  mapToExerciseViewModel,
  mapToExerciseCatalogueItem,
  mapToExerciseLibraryItem,
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

// Exercises that have a video, with the programs each one is used in
export async function getExerciseLibrary(): Promise<ExerciseLibraryItem[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select(`
      id, name, video_url,
      block_exercises (
        blocks (
          program_days (
            programs ( id, title, athletes ( name, surname ) )
          )
        )
      )
    `)
    .not('video_url', 'is', null)
    .order('name')

  if (error) throw error
  return (data ?? []).map(mapToExerciseLibraryItem)
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
//   1. Compress in the browser (ffmpeg.wasm) — falls back to the original file
//   2. Ask our API route for a presigned PUT URL (admin-only, tiny request)
//   3. Browser PUTs the file directly to R2 — no server size limit
//   4. Save the public URL to exercises.video_url, then delete the old video

export type UploadPhase = 'compress' | 'upload'

// The video API routes are admin-only — they verify this Supabase access token
async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
}

async function deleteVideoFile(videoUrl: string) {
  const res = await fetch('/api/delete-video', {
    method:  'DELETE',
    headers: await authHeaders(),
    body:    JSON.stringify({ videoId: videoUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Video delete failed')
  }
}

export async function uploadExerciseVideo(
  exerciseId: string,
  original: File,
  onProgress?: (pct: number, phase: UploadPhase) => void,
): Promise<string> {
  const { data: existing } = await supabase
    .from('exercises')
    .select('video_url')
    .eq('id', exerciseId)
    .single()

  // 1. Compress (loaded lazily — keeps ffmpeg out of the main bundle)
  onProgress?.(0, 'compress')
  const { compressVideo } = await import('@/lib/videoCompression')
  const file = await compressVideo(original, pct => onProgress?.(pct, 'compress'))

  // 2. Get presigned URL from our API route
  const contentType = file.type || 'video/mp4'
  const res = await fetch('/api/upload-video', {
    method:  'POST',
    headers: await authHeaders(),
    body:    JSON.stringify({ contentType, size: file.size }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to get upload URL')
  }

  const { presignedUrl, publicUrl } = await res.json()

  // 3. Upload directly to R2 from the browser with progress tracking.
  //    Content-Type and size must match what was signed.
  onProgress?.(0, 'upload')
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100), 'upload')
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

  // 5. Only now remove the old video, so a failed upload never loses it (fire and forget)
  if (existing?.video_url && existing.video_url !== publicUrl) {
    deleteVideoFile(existing.video_url).catch(e => console.warn('Old video delete failed:', e))
  }

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
    await deleteVideoFile(data.video_url)
  }

  const { error } = await supabase
    .from('exercises')
    .update({ video_url: null })
    .eq('id', exerciseId)

  if (error) throw error
}
