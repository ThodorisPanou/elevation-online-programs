// lib/services/athleteLoginService.ts
// An athlete's app login, managed by their coach or the admin through the server routes
// (the login columns are service-role only, see migration C).

import { apiFetch } from '@/lib/services/apiClient'

export interface AthleteLogin {
  username:     string | null
  hasAccount:   boolean          // created by the first login link
  disabled:     boolean
  lastSignInAt: string | null
  link:         { expiresAt: string } | null   // current unused, unexpired link
}

export interface LoginLink {
  url:       string
  expiresAt: string
}

export async function getAthleteLogin(athleteId: string): Promise<AthleteLogin> {
  return (await apiFetch<{ login: AthleteLogin }>(`/api/athletes/${athleteId}/login`)).login
}

export async function setAthleteUsername(athleteId: string, username: string): Promise<AthleteLogin> {
  return (await apiFetch<{ login: AthleteLogin }>(`/api/athletes/${athleteId}/login`, {
    method: 'PUT', body: { username },
  })).login
}

export async function setAthleteLoginEnabled(athleteId: string, enabled: boolean): Promise<AthleteLogin> {
  return (await apiFetch<{ login: AthleteLogin }>(`/api/athletes/${athleteId}/login`, {
    method: 'PATCH', body: { action: enabled ? 'enable' : 'disable' },
  })).login
}

export async function createLoginLink(athleteId: string): Promise<LoginLink> {
  return apiFetch<LoginLink>(`/api/athletes/${athleteId}/login-link`, { method: 'POST' })
}
