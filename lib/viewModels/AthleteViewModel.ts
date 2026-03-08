// lib/viewmodels/AthleteViewModel.ts

// ─── View Interfaces ──────────────────────────────────────────────────────

export interface AthleteViewModel {
  id:          string
  name:        string
  surname:     string
  fullName:    string   // convenience: `${name} ${surname}`
  notes?:      string
  avatar_url?: string
  created_at:  string
}

export interface AthleteListItemViewModel {
  id:          string
  name:        string
  surname:     string
  fullName:    string
  avatar_url?: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────

export function mapToAthleteViewModel(raw: any): AthleteViewModel {
  return {
    id:         raw.id,
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
    name:       raw.name,
    surname:    raw.surname,
    fullName:   `${raw.name} ${raw.surname}`,
    avatar_url: raw.avatar_url ?? undefined,
  }
}
