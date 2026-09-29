import { createClient } from "@supabase/supabase-js"

// cache: 'no-store' — never let the browser serve a saved API response. PostgREST answers some errors with
// HTTP 300, which browsers may cache on their own; a stale error then sticks even after the cause is fixed.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } }
)
