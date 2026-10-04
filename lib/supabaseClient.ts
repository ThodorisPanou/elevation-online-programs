import { createClient, SupportedStorage } from "@supabase/supabase-js"

// ─── Session storage: localStorage + a cookie copy ──────────────────────────
// iPhone "Add to Home Screen" (iOS 17+) copies Safari's COOKIES into the new home-screen app, but not its
// localStorage. Athletes sign in through a login link in Safari and then install the app, so the session must
// also live in a cookie to survive that hand-over. localStorage stays the main store: Safari caps cookies
// written by JavaScript at 7 days, while a home-screen app's localStorage isn't wiped. Reads fall back to the
// cookie only when localStorage is empty — i.e. on the installed app's first launch.

const COOKIE_CHUNK = 3000   // characters per cookie; browsers allow ~4 KB per cookie including the name
const COOKIE_MAX   = 6      // chunks; a session is ~2–4 KB

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find(c => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie = value === null
    ? `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    : `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`
}

const cookieCopy = {
  get(key: string): string | null {
    let value = ""
    for (let i = 0; i < COOKIE_MAX; i++) {
      const chunk = readCookie(`${key}.${i}`)
      if (chunk === null) break
      value += chunk
    }
    return value || null
  },
  set(key: string, value: string | null) {
    for (let i = 0; i < COOKIE_MAX; i++) {
      const chunk = value?.slice(i * COOKIE_CHUNK, (i + 1) * COOKIE_CHUNK)
      writeCookie(`${key}.${i}`, chunk || null)
    }
  },
}

const sessionStorageAdapter: SupportedStorage = {
  getItem(key) {
    const local = localStorage.getItem(key)
    if (local !== null) return local
    const copied = cookieCopy.get(key)
    if (copied !== null) localStorage.setItem(key, copied)
    return copied
  },
  setItem(key, value) {
    localStorage.setItem(key, value)
    cookieCopy.set(key, value)
  },
  removeItem(key) {
    localStorage.removeItem(key)
    cookieCopy.set(key, null)
  },
}

// cache: 'no-store' — never let the browser serve a saved API response. PostgREST answers some errors with
// HTTP 300, which browsers may cache on their own; a stale error then sticks even after the cause is fixed.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    // Server rendering has no localStorage/document: fall back to supabase-js's default there
    auth: typeof window === "undefined" ? undefined : { storage: sessionStorageAdapter },
  }
)
