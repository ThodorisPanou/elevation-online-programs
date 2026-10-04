// lib/services/coachService.ts
// Coach accounts and the signed-in user's own account — all through our API routes, because they need
// the service role (creating auth users, clearing must_change_password).

import { apiFetch } from '@/lib/services/apiClient'
import { supabase } from '@/lib/supabaseClient'

// ─── Me ───────────────────────────────────────────────────────────────────

export interface Me {
  email:   string
  isAdmin: boolean
  coach: {
    id:                   string
    username:             string
    name:                 string
    active:               boolean
    must_change_password: boolean
  } | null
  athlete: {
    id:             string
    username:       string | null
    login_disabled: boolean
    has_password:   boolean
  } | null
}

export const getMe = () => apiFetch<Me>('/api/me')

export async function changeMyPassword(password: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  await apiFetch<{ success: true }>('/api/me/password', { method: 'POST', body: { password } })

  // Supabase ends every session of a user whose password the server changes — this one too. Sign straight
  // back in with the new password so the user stays logged in.
  const email = session?.user.email
  if (!email) return
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Password changed — please sign in again with the new password')
}

// ─── Coaches (admin) ──────────────────────────────────────────────────────

export interface Coach {
  id:                   string
  username:             string
  name:                 string
  email:                string | null
  active:               boolean
  must_change_password: boolean
  created_at:           string
  athletes:             number
  programs:             number
  exercises:            number
}

export interface CoachInput {
  username: string
  name:     string
  email:    string
}

export async function getCoaches(): Promise<Coach[]> {
  return (await apiFetch<{ coaches: Coach[] }>('/api/coaches')).coaches
}

export const createCoach = (input: CoachInput) =>
  apiFetch<{ coach: Coach, tempPassword: string }>('/api/coaches', { method: 'POST', body: input })

export const updateCoach = (id: string, input: CoachInput) =>
  apiFetch<{ coach: Coach }>(`/api/coaches/${id}`, { method: 'PATCH', body: { action: 'update', ...input } })

export const resetCoachPassword = (id: string) =>
  apiFetch<{ tempPassword: string }>(`/api/coaches/${id}`, { method: 'PATCH', body: { action: 'reset-password' } })

export const setCoachActive = (id: string, active: boolean) =>
  apiFetch<{ coach: Coach }>(`/api/coaches/${id}`, { method: 'PATCH', body: { action: active ? 'activate' : 'deactivate' } })
