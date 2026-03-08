// lib/services/athleteService.ts

import { supabase } from '@/lib/supabaseClient'
import {
  AthleteViewModel,
  AthleteListItemViewModel,
  mapToAthleteViewModel,
  mapToAthleteListItemViewModel,
} from '@/lib/viewModels/AthleteViewModel'

export async function getAthleteById(id: string): Promise<AthleteViewModel | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, name, surname, notes, avatar_url, created_at')
    .eq('id', id)
    .single()

  if (error) { console.error('getAthleteById:', error); return null }
  if (!data)  return null

  return mapToAthleteViewModel(data)
}

export async function getAllAthletes(): Promise<AthleteListItemViewModel[]> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id, name, surname, avatar_url')
    .order('surname')

  if (error) { console.error('getAllAthletes:', error); return [] }

  return (data ?? []).map(mapToAthleteListItemViewModel)
}

export async function uploadAthleteAvatar(athleteId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${athleteId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('AtheletesImages')
    .upload(path, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('AtheletesImages')
    .getPublicUrl(path)

  return data.publicUrl
}

export async function createAthlete(
  name:      string,
  surname:   string,
  notes?:    string,
  avatarFile?: File,
): Promise<string> {
  // Insert athlete first to get the id
  const { data, error } = await supabase
    .from('athletes')
    .insert([{ name: name.trim(), surname: surname.trim(), notes: notes?.trim() || null }])
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