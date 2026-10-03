// lib/services/athleteService.ts

import { supabase } from '@/lib/supabaseClient'
import { apiFetch } from '@/lib/services/apiClient'
import {
  AthleteViewModel,
  AthleteListItemViewModel,
  mapToAthleteViewModel,
  mapToAthleteListItemViewModel,
} from '@/lib/viewModels/AthleteViewModel'

export async function getAthleteById(id: string): Promise<AthleteViewModel | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, coach_id, name, surname, notes, avatar_url, created_at')
    .eq('id', id)
    .single()

  if (error) { console.error('getAthleteById:', error); return null }
  if (!data)  return null

  return mapToAthleteViewModel(data)
}

export async function getAllAthletes(): Promise<AthleteListItemViewModel[]> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, coach_id, name, surname, avatar_url')
    .order('surname')

  if (error) { console.error('getAllAthletes:', error); return [] }

  return (data ?? []).map(mapToAthleteListItemViewModel)
}

// ─── Avatars (Supabase Storage) ───────────────────────────────────────────

const AVATAR_BUCKET = 'AtheletesImages'

// Storage path from a public URL: …/object/public/AtheletesImages/<path>
function avatarPath(url: string): string | null {
  const marker = `/object/public/${AVATAR_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

async function deleteAvatarFile(url?: string | null) {
  const path = url ? avatarPath(url) : null
  if (!path) return
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
  if (error) console.warn('Avatar file delete failed:', error)
}

export async function uploadAthleteAvatar(athleteId: string, file: File): Promise<string> {
  // Photos live in the coach's folder — storage policies only let a coach write inside their own
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes').select('coach_id').eq('id', athleteId).single()
  if (athleteError) throw athleteError

  const ext    = file.name.split('.').pop()
  const folder = athlete.coach_id ? `${athlete.coach_id}/` : ''
  // New name per upload — reusing one path lets browsers keep showing the cached old photo
  const path   = `${folder}${athleteId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

// coachId: required when the admin creates an athlete; a coach leaves it out (the DB fills in their own id)
export async function createAthlete(
  name:      string,
  surname:   string,
  notes?:    string,
  avatarFile?: File,
  coachId?:  string,
): Promise<string> {
  // Insert athlete first to get the id
  const { data, error } = await supabase
    .from('athletes')
    .insert([{
      name: name.trim(), surname: surname.trim(), notes: notes?.trim() || null,
      ...(coachId ? { coach_id: coachId } : {}),
    }])
    .select()
    .single()

  if (error) { console.error('createAthlete:', error); throw error }

  // Upload avatar if provided — non-blocking, athlete is created regardless
  if (avatarFile) {
    try {
      const url = await uploadAthleteAvatar(data.id, avatarFile)
      await supabase
        .from('athletes')
        .update({ avatar_url: url })
        .eq('id', data.id)
    } catch (e) {
      console.warn('Avatar upload failed, athlete created without photo:', e)
    }
  }

  return data.id
}

// ─── Edit / delete ────────────────────────────────────────────────────────

export async function updateAthlete(
  id:     string,
  fields: { name: string; surname: string; notes?: string },
): Promise<void> {
  const { error } = await supabase
    .from('athletes')
    .update({ name: fields.name.trim(), surname: fields.surname.trim(), notes: fields.notes?.trim() || null })
    .eq('id', id)

  if (error) { console.error('updateAthlete:', error); throw error }
}

// Uploads the new photo, points the athlete at it, then removes the old file
export async function replaceAthleteAvatar(id: string, file: File, oldUrl?: string): Promise<string> {
  const url = await uploadAthleteAvatar(id, file)

  const { error } = await supabase.from('athletes').update({ avatar_url: url }).eq('id', id)
  if (error) {
    await deleteAvatarFile(url)
    console.error('replaceAthleteAvatar:', error)
    throw error
  }

  await deleteAvatarFile(oldUrl)
  return url
}

export async function removeAthleteAvatar(id: string, url: string): Promise<void> {
  const { error } = await supabase.from('athletes').update({ avatar_url: null }).eq('id', id)
  if (error) { console.error('removeAthleteAvatar:', error); throw error }

  await deleteAvatarFile(url)
}

export async function countAthletePrograms(id: string): Promise<number> {
  const { count, error } = await supabase
    .from('programs')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_id', id)

  if (error) { console.error('countAthletePrograms:', error); throw error }
  return count ?? 0
}

// Permanently deletes the athlete and all their programs in one transaction via the
// delete_athlete Postgres function (defined in Supabase, security invoker) — if the athlete
// can't be deleted, nothing is. Then removes their photo file.
// Server route: also removes the athlete's login (auth user), which the browser can't do
export async function deleteAthlete(id: string): Promise<void> {
  await apiFetch(`/api/athletes/${id}`, { method: 'DELETE' })
}
