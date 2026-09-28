// lib/services/apiClient.ts
// Calls our own API routes with the Supabase access token (the routes verify it server-side).

import { supabase } from '@/lib/supabaseClient'

export async function apiFetch<T>(path: string, init: { method?: string, body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch(path, {
    method:  init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body:    init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status)
  return json as T
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}
