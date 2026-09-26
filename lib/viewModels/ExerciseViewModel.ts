// lib/viewmodels/ExerciseViewModel.ts

// ─── View Interfaces ──────────────────────────────────────────────────────

export interface ExerciseViewModel {
  id:           string
  name:         string
  description?: string
  video_url?:   string
  created_at:   string
}

// Lightweight version used in dropdowns / datalists
export interface ExerciseCatalogueItem {
  id:        string
  name:      string
  video_url?: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────

export function mapToExerciseViewModel(raw: any): ExerciseViewModel {
  return {
    id:          raw.id,
    name:        raw.name,
    description: raw.description ?? undefined,
    video_url:   raw.video_url   ?? undefined,
    created_at:  raw.created_at,
  }
}

export function mapToExerciseCatalogueItem(raw: any): ExerciseCatalogueItem {
  return {
    id:        raw.id,
    name:      raw.name,
    video_url: raw.video_url ?? undefined,
  }
}

// ─── Exercise library (admin) ─────────────────────────────────────────────
// An exercise with a video, plus every program that uses it.

export interface ExerciseProgramRef {
  id:          string
  title:       string
  athleteName: string
  uses:        number   // times the exercise appears in this program
}

export interface ExerciseLibraryItem {
  id:        string
  name:      string
  video_url: string
  programs:  ExerciseProgramRef[]   // sorted by title, one entry per program
}

// Raw shape: exercises → block_exercises → blocks → program_days → programs → athletes
export function mapToExerciseLibraryItem(raw: any): ExerciseLibraryItem {
  const byId = new Map<string, ExerciseProgramRef>()

  for (const be of raw.block_exercises ?? []) {
    const program = be.blocks?.program_days?.programs
    if (!program?.id) continue

    const existing = byId.get(program.id)
    if (existing) { existing.uses++; continue }

    const athlete = program.athletes
    byId.set(program.id, {
      id:          program.id,
      title:       program.title,
      athleteName: athlete ? `${athlete.name} ${athlete.surname}`.trim() : '',
      uses:        1,
    })
  }

  return {
    id:        raw.id,
    name:      raw.name,
    video_url: raw.video_url,
    programs:  [...byId.values()].sort((a, b) => a.title.localeCompare(b.title)),
  }
}
