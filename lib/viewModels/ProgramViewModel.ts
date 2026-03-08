// lib/viewmodels/ProgramViewModel.ts

// ─── View Interfaces ──────────────────────────────────────────────────────

export interface ViewExercise {
  id:        string
  name:      string
  video_url?: string
}

export interface ViewBlockExercise {
  id:            string
  order_index:   number
  sets?:         number
  reps?:         string
  kg?:           string
  rest_seconds?: number
  notes?:        string
  exercise:      ViewExercise
}

export interface ViewBlock {
  id:              string
  name:            string
  order_index:     number
  block_exercises: ViewBlockExercise[]
}

export interface ViewDay {
  id:          string
  name:        string
  order_index: number
  blocks:      ViewBlock[]
}

export interface ViewAthlete {
  id:          string
  name:        string
  surname:     string
  avatar_url?: string
}

export interface ProgramViewModel {
  id:           string
  title:        string
  public_token: string
  created_at:   string
  athlete:      ViewAthlete
  days:         ViewDay[]   // pre-sorted by order_index
}

// ─── Mapper ───────────────────────────────────────────────────────────────
// Accepts the raw Supabase join response (typed as `any` because Supabase's
// inferred join types don't match our hand-written interfaces) and returns
// a clean, fully-typed ProgramViewModel.
// This is the equivalent of an AutoMapper profile in C#.

export function mapToProgramViewModel(raw: any): ProgramViewModel {
  return {
    id:           raw.id,
    title:        raw.title,
    public_token: raw.public_token,
    created_at:   raw.created_at,

    // Supabase names the joined row after the table: `athletes`, not `athlete`
    athlete: {
      id:          raw.athletes?.id,
      name:        raw.athletes?.name,
      surname:     raw.athletes?.surname,
      avatar_url:  raw.athletes?.avatar_url ?? undefined,
    } as ViewAthlete,

    days: [...(raw.program_days ?? [])]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((d: any): ViewDay => ({
        id:          d.id,
        name:        d.name,
        order_index: d.order_index,

        blocks: [...(d.blocks ?? [])]
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((b: any): ViewBlock => ({
            id:          b.id,
            name:        b.name,
            order_index: b.order_index,

            block_exercises: [...(b.block_exercises ?? [])]
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((be: any): ViewBlockExercise => ({
                id:           be.id,
                order_index:  be.order_index,
                sets:         be.sets          ?? undefined,
                reps:         be.reps          ?? undefined,
                kg:           be.kg            ?? undefined,
                rest_seconds: be.rest_seconds  ?? undefined,
                notes:        be.notes         ?? undefined,
                // Supabase returns the joined row as `exercises` (table name)
                exercise: {
                  id:        be.exercises?.id,
                  name:      be.exercises?.name,
                  video_url: be.exercises?.video_url ?? undefined,
                } as ViewExercise,
              })),
          })),
      })),
  }
}
