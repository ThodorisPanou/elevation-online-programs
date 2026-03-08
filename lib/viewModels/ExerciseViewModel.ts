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
