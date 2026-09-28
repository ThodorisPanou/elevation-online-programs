// lib/viewmodels/AthleteViewModel.ts

// ─── View Interfaces ──────────────────────────────────────────────────────

export interface AthleteViewModel {
  id:          string
  coachId:     string | null   // null only before migration A2 (all rows get a coach)
  name:        string
  surname:     string
  fullName:    string   // convenience: `${name} ${surname}`
  notes?:      string
  avatar_url?: string
  created_at:  string
}

export interface AthleteListItemViewModel {
  id:          string
  coachId:     string | null
  name:        string
  surname:     string
  fullName:    string
  avatar_url?: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────

export function mapToAthleteViewModel(raw: any): AthleteViewModel {
  return {
    id:         raw.id,
    coachId:    raw.coach_id ?? null,
    name:       raw.name,
    surname:    raw.surname,
    fullName:   `${raw.name} ${raw.surname}`,
    notes:      raw.notes      ?? undefined,
    avatar_url: raw.avatar_url ?? undefined,
    created_at: raw.created_at,
  }
}

export function mapToAthleteListItemViewModel(raw: any): AthleteListItemViewModel {
  return {
    id:         raw.id,
    coachId:    raw.coach_id ?? null,
    name:       raw.name,
    surname:    raw.surname,
    fullName:   `${raw.name} ${raw.surname}`,
    avatar_url: raw.avatar_url ?? undefined,
  }
}
