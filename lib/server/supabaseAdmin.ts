// lib/server/supabaseAdmin.ts
// Service-role Supabase client: bypasses RLS and can manage auth users. Server only —
// the key must never reach the browser (no NEXT_PUBLIC_ prefix, `server-only` import guard).

import 'server-only'
import { createClient } from '@supabase/supabase-js'

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — see .env.local / Vercel env')
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
