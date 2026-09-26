// lib/viewModels/AnalyticsViewModel.ts

// ─── View Interfaces ──────────────────────────────────────────────────────

export interface AnalyticsProgram {
  id:          string
  title:       string
  createdAt:   Date
  monthKey:    string   // 'YYYY-MM' in local time
  athleteId:   string | null
  athleteName: string
  dayCount:    number
  exerciseIds: string[] // one entry per block_exercise row (duplicates kept)
}

export interface AnalyticsAthlete {
  id:            string
  fullName:      string
  initials:      string
  avatar_url?:   string
  createdAt?:    Date
  programCount:  number
  lastProgramAt: Date | null
  daysSinceLast: number | null
}

export interface MonthBucket {
  key:   string   // 'YYYY-MM'
  label: string   // 'Sep'
  long:  string   // 'September 2026'
  count: number
}

export interface ExerciseUsage {
  id:    string
  name:  string
  count: number
}

export interface AnalyticsViewModel {
  programs:          AnalyticsProgram[]
  athletes:          AnalyticsAthlete[]   // sorted by programCount desc
  exerciseNames:     Record<string, string>
  totalExercises:    number
  exercisesWithVideo: number
  months:            MonthBucket[]        // last 12 months, oldest first
  topExercises:      ExerciseUsage[]
}

export interface MonthReview {
  month:            MonthBucket
  programs:         AnalyticsProgram[]
  previousCount:    number
  athletesServed:   number
  newAthletes:      number
  avgDays:          number
  topExercises:     ExerciseUsage[]
}

// Athletes whose last program is older than this are flagged
export const STALE_AFTER_DAYS = 30

// ─── Helpers ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthFromKey(key: string): MonthBucket {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return {
    key,
    label: d.toLocaleDateString('en-GB', { month: 'short' }),
    long:  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    count: 0,
  }
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

function rankExercises(ids: string[], names: Record<string, string>, limit: number): ExerciseUsage[] {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: names[id] ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// ─── Mappers ──────────────────────────────────────────────────────────────

export function mapToAnalyticsViewModel(
  rawPrograms:  any[],
  rawAthletes:  any[],
  rawExercises: any[],
  now:          Date = new Date(),
): AnalyticsViewModel {
  const exerciseNames: Record<string, string> = {}
  for (const e of rawExercises) exerciseNames[e.id] = e.name

  const programs: AnalyticsProgram[] = rawPrograms.map(p => {
    const createdAt = new Date(p.created_at)
    const days = p.program_days ?? []
    const exerciseIds: string[] = []
    for (const d of days)
      for (const b of d.blocks ?? [])
        for (const be of b.block_exercises ?? [])
          if (be.exercise_id) exerciseIds.push(be.exercise_id)

    return {
      id:          p.id,
      title:       p.title,
      createdAt,
      monthKey:    monthKey(createdAt),
      athleteId:   p.athlete_id ?? null,
      athleteName: p.athletes ? `${p.athletes.name} ${p.athletes.surname}` : 'Unassigned',
      dayCount:    days.length,
      exerciseIds,
    }
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const athletes: AnalyticsAthlete[] = rawAthletes.map(a => {
    const own  = programs.filter(p => p.athleteId === a.id)
    const last = own[0]?.createdAt ?? null   // programs are newest first
    return {
      id:            a.id,
      fullName:      `${a.name} ${a.surname}`,
      initials:      `${a.name?.[0] ?? ''}${a.surname?.[0] ?? ''}`,
      avatar_url:    a.avatar_url ?? undefined,
      createdAt:     a.created_at ? new Date(a.created_at) : undefined,
      programCount:  own.length,
      lastProgramAt: last,
      daysSinceLast: last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null,
    }
  }).sort((a, b) => b.programCount - a.programCount || a.fullName.localeCompare(b.fullName))

  const currentKey = monthKey(now)
  const months: MonthBucket[] = []
  for (let i = 11; i >= 0; i--) {
    const bucket = monthFromKey(shiftMonth(currentKey, -i))
    bucket.count = programs.filter(p => p.monthKey === bucket.key).length
    months.push(bucket)
  }

  return {
    programs,
    athletes,
    exerciseNames,
    totalExercises:     rawExercises.length,
    exercisesWithVideo: rawExercises.filter(e => e.video_url).length,
    months,
    topExercises:       rankExercises(programs.flatMap(p => p.exerciseIds), exerciseNames, 10),
  }
}

export function buildMonthReview(vm: AnalyticsViewModel, key: string): MonthReview {
  const month    = monthFromKey(key)
  const programs = vm.programs.filter(p => p.monthKey === key)
  month.count    = programs.length

  const prevKey = shiftMonth(key, -1)
  const totalDays = programs.reduce((sum, p) => sum + p.dayCount, 0)

  return {
    month,
    programs,
    previousCount:  vm.programs.filter(p => p.monthKey === prevKey).length,
    athletesServed: new Set(programs.map(p => p.athleteId).filter(Boolean)).size,
    newAthletes:    vm.athletes.filter(a => a.createdAt && monthKey(a.createdAt) === key).length,
    avgDays:        programs.length ? totalDays / programs.length : 0,
    topExercises:   rankExercises(programs.flatMap(p => p.exerciseIds), vm.exerciseNames, 5),
  }
}
