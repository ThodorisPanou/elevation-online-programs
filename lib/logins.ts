// lib/logins.ts
// Username logins, shared by the login page and the server routes (no secrets here).
// Supabase Auth needs an email, so a username is stored as `<username>@login.invalid` — `.invalid` is a
// reserved TLD, so nothing is ever delivered there. Admins keep logging in with their real email.

export const LOGIN_DOMAIN = 'login.invalid'

// Same rule as the `coaches.username` check constraint
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/
export const USERNAME_HINT    = '3–32 characters: lowercase letters, digits, dot, dash, underscore'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72   // bcrypt ignores anything longer

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

/** What the login form sends to Supabase: an email stays as is, a username gets the internal domain. */
export function toLoginEmail(input: string): string {
  const value = input.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${LOGIN_DOMAIN}`
}

/** Error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`
  return null
}
