// lib/programDates.ts
// Program availability (migration F): a program is open from its start date through its end date, both included.
// The database decides what athletes get (by the date in Greece); these helpers only label things on screen.

export type ProgramStatus = 'upcoming' | 'active' | 'ended'

// Today in Greece as YYYY-MM-DD — the same "today" the database uses
export function todayInGreece(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date())
}

// YYYY-MM-DD strings compare correctly as text
export function programStatus(start?: string, end?: string, today = todayInGreece()): ProgramStatus {
  if (start && today < start) return 'upcoming'
  if (end && today > end)     return 'ended'
  return 'active'
}

// "2026-11-17" → "17 Nov 2026" (read as a calendar date, never shifted by the device's time zone)
export function fmtDay(day?: string | null, withYear = true): string {
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  })
}

// The one rule for a program's dates — the editor and the service both use it (the database enforces it too).
// null when fine.
export function checkProgramDates(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return 'Set the program’s start and end date'
  if (end < start)    return 'The end date can’t be before the start date'
  return null
}

// YYYY-MM-DD plus n days
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}
