// lib/viewmodels/EditProgramViewModel.ts
//
// UI-layer types used by both NewProgramPage and EditProgramPage.
// These are NOT domain models — they extend the domain with UI-specific
// concerns: _tempId (stable React key), _deleted (soft-delete), and
// sets/rest_seconds as strings (so form inputs work without constant casting).

// ─── UI State Interfaces ──────────────────────────────────────────────────

export interface UIBlockExercise {
  id?:           string    // undefined = not yet persisted
  exerciseId?:   string
  exerciseName?: string
  video_url?:    string    // read from exercises.video_url — display only in editor
  sets?:         string    // string while editing, parsed to number on save
  reps?:         string
  kg?:           string
  rest_seconds?: string    // string while editing, parsed to number on save
  notes?:        string
  _deleted?:     boolean
}

export interface UIBlock {
  id?:       string        // undefined = not yet persisted
  _tempId:   string        // stable React key (uuid or Date.now())
  name:      string
  exercises: UIBlockExercise[]
  _deleted?: boolean
}

export interface UIDay {
  id?:       string        // undefined = not yet persisted
  _tempId:   string
  name:      string
  blocks:    UIBlock[]
  _deleted?: boolean
}

export interface EditProgramViewModel {
  programId?: string       // undefined = new program
  title:      string
  days:       UIDay[]
}

// ─── Factory helpers ──────────────────────────────────────────────────────
// Use these instead of inline object literals to ensure consistent defaults.

export function createUIBlockExercise(): UIBlockExercise {
  return {
    exerciseId:   '',
    exerciseName: '',
    sets:         '',
    reps:         '',
    kg:           '',
    rest_seconds: '',
    notes:        '',
  }
}

export function createUIBlock(existingCount: number): UIBlock {
  return {
    _tempId:   Date.now().toString(),
    name:      `Block ${existingCount + 1}`,
    exercises: [],
  }
}

export function createUIDay(existingCount: number): UIDay {
  return {
    _tempId: Date.now().toString(),
    name:    `Day ${existingCount + 1}`,
    blocks:  [],
  }
}

// ─── Mapper (DB response → EditProgramViewModel) ──────────────────────────
// Used by useEditProgram to populate state from a loaded program.

export function mapToEditProgramViewModel(raw: any): EditProgramViewModel {
  return {
    programId: raw.id,
    title:     raw.title,
    days: [...(raw.program_days ?? [])]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((d: any): UIDay => ({
        id:      d.id,
        _tempId: d.id,
        name:    d.name,
        blocks: [...(d.blocks ?? [])]
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((b: any): UIBlock => ({
            id:      b.id,
            _tempId: b.id,
            name:    b.name,
            exercises: [...(b.block_exercises ?? [])]
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((be: any): UIBlockExercise => ({
                id:           be.id,
                exerciseId:   be.exercises?.id,
                exerciseName: be.exercises?.name      ?? '',
                video_url:    be.exercises?.video_url ?? undefined,
                sets:         be.sets?.toString()     ?? '',
                reps:         be.reps                 ?? '',
                kg:           be.kg                   ?? '',
                rest_seconds: be.rest_seconds?.toString() ?? '',
                notes:        be.notes                ?? '',
              })),
          })),
      })),
  }
}

// ─── Derived helpers ──────────────────────────────────────────────────────
// Utility functions shared between NewProgramPage and EditProgramPage.

export function getVisibleDays(days: UIDay[]): UIDay[] {
  return days.filter(d => !d._deleted)
}

export function getTotalExercises(days: UIDay[]): number {
  return getVisibleDays(days).reduce(
    (a, d) => a + d.blocks
      .filter(b => !b._deleted)
      .reduce((a2, b) => a2 + b.exercises.filter(e => !e._deleted).length, 0),
    0,
  )
}
