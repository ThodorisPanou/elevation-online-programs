'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// ─── UI-layer extensions (model files are never modified) ──────────────────
//
// The domain models (Block, BlockExercise, ProgramDay, Program, Exercise,
// Athlete) are declared globally via the .ts interface files.
// Here we create UI-specific variants that extend those shapes with:
//   - optional `id`  (undefined = row not yet persisted)
//   - `_tempId`      (stable React key that survives before the DB id exists)
//   - `_deleted`     (soft-delete flag; row is hidden then removed on save)
//   - `sets` / `rest_seconds` as strings (numeric fields while the user types)
//   - `exerciseId` / `exerciseName` flattened out of the Exercise relation

interface UIBlockExercise {
  id?:           string   // undefined → new row
  exerciseId?:   string
  exerciseName?: string
  sets?:         string   // stored as string while editing
  reps?:         string
  kg?:           string
  rest_seconds?: string   // stored as string while editing
  notes?:        string
  _deleted?:     boolean
}

interface UIBlock {
  id?:       string       // undefined → not yet in DB
  _tempId:   string       // stable key
  name:      string
  exercises: UIBlockExercise[]
  _deleted?: boolean
}

interface UIDay {
  id?:       string       // undefined → not yet in DB
  _tempId:   string
  name:      string
  blocks:    UIBlock[]
  _deleted?: boolean
}

// ───────────────────────────────────────────────────────────────────────────

export default function EditProgramPage() {
  const router    = useRouter()
  const params    = useParams()
  const athleteId  = params?.athlete_id as string
  const programId  = params?.program_id as string
    console.log('EditProgramPage params', params);
  const [title,   setTitle]   = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  // Exercise catalogue – typed with the global Exercise interface
  const [exerciseCatalogue, setExerciseCatalogue] = useState<Exercise[]>([])
  const [days, setDays] = useState<UIDay[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      await Promise.all([loadExercises(), loadProgram()])
      setLoading(false)
    }
    init()
  }, [])

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, description, created_at')
      .order('name')
    setExerciseCatalogue((data as Exercise[]) || [])
  }

  const loadProgram = async () => {
    const { data, error: err } = await supabase
      .from('programs')
      .select(`
        id, title,
        program_days (
          id, name, order_index,
          blocks (
            id, name, order_index,
            block_exercises (
              id, sets, reps, kg, rest_seconds, notes, order_index,
              exercises ( id, name )
            )
          )
        )
      `)
      .eq('id', programId)
      .single()

    if (err || !data) { setError('Program not found'); return }

    // Cast to Program for the title field; use `any` for the nested joins
    // since Supabase's inferred join types diverge from our hand-written interfaces.
    const program = data as unknown as Program
    setTitle(program.title)

    const raw = data as any

    const uiDays: UIDay[] = [...(raw.program_days ?? [])]
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
                exerciseName: be.exercises?.name ?? '',
                sets:         be.sets?.toString()         ?? '',
                reps:         be.reps                     ?? '',
                kg:           be.kg                       ?? '',
                rest_seconds: be.rest_seconds?.toString() ?? '',
                notes:        be.notes                    ?? '',
              })),
          })),
      }))

    setDays(uiDays)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const saveProgram = async () => {
    if (!title) return setError('Title is required')
    setSaving(true)
    setError(null)
    try {
      const { error: pErr } = await supabase
        .from('programs')
        .update({ title })
        .eq('id', programId)
      if (pErr) throw pErr

      for (let di = 0; di < days.length; di++) {
        const day = days[di]
        let dayId = day.id

        if (day._deleted && dayId) {
          await supabase.from('program_days').delete().eq('id', dayId)
          continue
        }

        if (!dayId) {
          const { data: nd, error: de } = await supabase
            .from('program_days')
            .insert([{ program_id: programId, name: day.name, order_index: di }])
            .select()
            .single()
          if (de) throw de
          dayId = nd.id
        } else {
          await supabase.from('program_days')
            .update({ name: day.name, order_index: di })
            .eq('id', dayId)
        }

        for (let bi = 0; bi < day.blocks.length; bi++) {
          const block = day.blocks[bi]
          let blockId = block.id

          if (block._deleted && blockId) {
            await supabase.from('blocks').delete().eq('id', blockId)
            continue
          }

          if (!blockId) {
            const { data: nb, error: be } = await supabase
              .from('blocks')
              .insert([{ day_id: dayId, name: block.name, order_index: bi }])
              .select()
              .single()
            if (be) throw be
            blockId = nb.id
          } else {
            await supabase.from('blocks')
              .update({ name: block.name, order_index: bi })
              .eq('id', blockId)
          }

          for (let ei = 0; ei < block.exercises.length; ei++) {
            const ex = block.exercises[ei]

            if (ex._deleted && ex.id) {
              await supabase.from('block_exercises').delete().eq('id', ex.id)
              continue
            }

            // Build payload matching the BlockExercise DB columns
            const payload = {
              block_id:     blockId,
              exercise_id:  ex.exerciseId,
              sets:         ex.sets         ? parseInt(ex.sets)         : null,
              reps:         ex.reps         || null,
              kg:           ex.kg           || null,
              rest_seconds: ex.rest_seconds ? parseInt(ex.rest_seconds) : null,
              notes:        ex.notes        || null,
              order_index:  ei,
            }

            if (!ex.id) {
              // New row – only insert if an exercise is actually selected
              if (ex.exerciseId) {
                await supabase.from('block_exercises').insert([payload])
              }
            } else {
              // Existing row – strip insert-only FK cols before updating
              const { block_id, exercise_id, ...updatePayload } = payload
              await supabase.from('block_exercises')
                .update(updatePayload)
                .eq('id', ex.id)
            }
          }
        }
      }

      router.push(`/admin/programs/${athleteId}`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  const addDay = () => {
    const visibleCount = days.filter(d => !d._deleted).length
    setDays(prev => [
      ...prev,
      { _tempId: Date.now().toString(), name: `Day ${visibleCount + 1}`, blocks: [] },
    ])
  }

  const removeDay = (tempId: string) =>
    setDays(prev =>
      prev
        .map(d => d._tempId === tempId ? (d.id ? { ...d, _deleted: true } : null) : d)
        .filter(Boolean) as UIDay[]
    )

  const addBlock = (dayTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      const count = d.blocks.filter(b => !b._deleted).length
      return {
        ...d,
        blocks: [
          ...d.blocks,
          { _tempId: Date.now().toString(), name: `Block ${count + 1}`, exercises: [] },
        ],
      }
    }))

  const removeBlock = (dayTempId: string, blockTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks
          .map(b => b._tempId === blockTempId ? (b.id ? { ...b, _deleted: true } : null) : b)
          .filter(Boolean) as UIBlock[],
      }
    }))

  const addExercise = (dayTempId: string, blockTempId: string) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: [
              ...b.exercises,
              { exerciseId: '', exerciseName: '', reps: '', kg: '', sets: '', rest_seconds: '', notes: '' },
            ],
          }
        }),
      }
    }))

  const removeExercise = (dayTempId: string, blockTempId: string, idx: number) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises
              .map((ex, i) => i === idx ? (ex.id ? { ...ex, _deleted: true } : null) : ex)
              .filter(Boolean) as UIBlockExercise[],
          }
        }),
      }
    }))

  const updateExField = (
    dayTempId:   string,
    blockTempId: string,
    idx:         number,
    field:       keyof UIBlockExercise,
    value:       string,
  ) =>
    setDays(prev => prev.map(d => {
      if (d._tempId !== dayTempId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b._tempId !== blockTempId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) => {
              if (i !== idx) return ex
              if (field === 'exerciseName') {
                const matched = exerciseCatalogue.find((e: Exercise) => e.name === value)
                return { ...ex, exerciseName: value, exerciseId: matched?.id }
              }
              return { ...ex, [field]: value }
            }),
          }
        }),
      }
    }))

  // ── Derived ───────────────────────────────────────────────────────────────

  const visibleDays = days.filter(d => !d._deleted)
  const totalExercises = visibleDays.reduce(
    (a, d) => a + d.blocks
      .filter(b => !b._deleted)
      .reduce((a2, b) => a2 + b.exercises.filter(e => !e._deleted).length, 0),
    0,
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');
        body { background:#0d0d0f; margin:0; }
        .loader { display:flex; align-items:center; justify-content:center; min-height:100vh; gap:8px; }
        .loader-dot { width:8px; height:8px; border-radius:50%; background:#e8ff4a; animation:bounce 0.8s infinite alternate; }
        .loader-dot:nth-child(2){animation-delay:0.2s} .loader-dot:nth-child(3){animation-delay:0.4s}
        @keyframes bounce { to { transform:translateY(-12px); opacity:0.4; } }
      `}</style>
      <div className="loader">
        <div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .pg-root { font-family: 'Barlow', sans-serif; background: #0d0d0f; min-height: 100vh; color: #e8e8ec; }

        .pg-header {
          position: sticky; top: 0; z-index: 50;
          background: rgba(13,13,15,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid #1f1f26;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .pg-header-left { display: flex; align-items: center; gap: 16px; }
        .btn-back {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #6b6b7a; background: none; border: none; cursor: pointer;
          padding: 6px 10px; border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .btn-back:hover { color: #e8e8ec; background: #1a1a22; }
        .pg-breadcrumb {
          font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase; color: #3a3a4a;
        }
        .pg-stats { display: flex; gap: 20px; align-items: center; }
        .stat-pill {
          font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #4a4a5a;
          background: #16161e; border: 1px solid #1f1f2a; padding: 4px 10px; border-radius: 20px;
        }
        .stat-pill span { color: #a0a0c0; margin-left: 4px; }
        .btn-save {
          font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: #e8ff4a; color: #0d0d0f; border: none;
          padding: 8px 22px; border-radius: 8px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-save:hover { background: #f5ff80; transform: translateY(-1px); }
        .btn-save:disabled { background: #2a2a35; color: #4a4a5a; cursor: not-allowed; transform: none; }

        .pg-body { max-width: 860px; margin: 0 auto; padding: 36px 24px 80px; }

        .section-label {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: #4a4a5a; margin-bottom: 10px;
        }
        .title-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 800;
          letter-spacing: -0.01em; background: transparent; border: none;
          border-bottom: 2px solid #1f1f2a; color: #e8e8ec; width: 100%;
          padding: 4px 0 10px; outline: none; transition: border-color 0.2s; margin-bottom: 36px;
        }
        .title-input::placeholder { color: #2a2a38; }
        .title-input:focus { border-bottom-color: #e8ff4a; }

        .error-bar {
          display: flex; align-items: center; gap: 8px;
          background: #2a0f0f; border: 1px solid #5a1a1a; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 24px; font-size: 13px; color: #ff7070;
        }

        .days-container { display: flex; flex-direction: column; gap: 16px; }

        .day-card {
          background: #111116; border: 1px solid #1a1a24; border-radius: 12px; overflow: hidden;
          transition: border-color 0.2s;
        }
        .day-card:focus-within { border-color: #2a2a40; }
        .day-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; background: #14141a; border-bottom: 1px solid #1a1a24;
        }
        .day-index {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 800;
          letter-spacing: 0.15em; text-transform: uppercase; color: #e8ff4a;
          background: #1e2010; border: 1px solid #3a4010; padding: 3px 8px; border-radius: 4px; white-space: nowrap;
        }
        .day-name-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700;
          background: transparent; border: none; color: #e8e8ec; flex: 1; outline: none; min-width: 0;
        }
        .day-name-input::placeholder { color: #2a2a3a; }
        .day-header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        .btn-add-block {
          font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #6a6aaa;
          background: #16162a; border: 1px solid #22223a; padding: 5px 12px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .btn-add-block:hover { color: #aaaae8; background: #1e1e38; border-color: #2e2e50; }
        .btn-icon {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid transparent; border-radius: 6px;
          color: #3a3a4a; cursor: pointer; font-size: 16px; transition: all 0.15s;
        }
        .btn-icon:hover { color: #ff6060; border-color: #3a1a1a; background: #1a1010; }

        .day-body { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; }

        .block-card { background: #0d0d12; border: 1px solid #18182a; border-radius: 8px; overflow: hidden; }
        .block-header {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-bottom: 1px solid #18182a;
        }
        .block-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a4aaa; flex-shrink: 0; }
        .block-name-input {
          font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          background: transparent; border: none; color: #8888cc; flex: 1; outline: none;
        }
        .block-name-input::placeholder { color: #222230; }
        .btn-add-ex {
          font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #4a4a6a;
          background: none; border: none; cursor: pointer; padding: 3px 8px; border-radius: 4px;
          transition: color 0.15s;
        }
        .btn-add-ex:hover { color: #8888cc; }

        .block-exercises { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
        .ex-header-row {
          display: grid; grid-template-columns: 1fr 52px 52px 52px 52px 24px;
          gap: 6px; padding: 0 0 4px;
        }
        .ex-col-label {
          font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #2e2e3e; text-align: center;
        }
        .ex-col-label:first-child { text-align: left; }
        .exercise-row {
          display: grid; grid-template-columns: 1fr 52px 52px 52px 52px 24px;
          gap: 6px; align-items: center;
        }
        .ex-input {
          font-family: 'Barlow', sans-serif; font-size: 13px;
          background: #131320; border: 1px solid #1e1e2e; color: #c0c0d8;
          padding: 6px 8px; border-radius: 6px; outline: none; width: 100%;
          transition: border-color 0.15s;
        }
        .ex-input::placeholder { color: #2a2a3a; font-size: 12px; }
        .ex-input:focus { border-color: #3a3a5a; }
        .ex-input-sm { text-align: center; padding: 6px 4px; }
        .ex-remove {
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
          background: none; border: none; color: #2a2a3a; cursor: pointer; border-radius: 4px;
          font-size: 14px; transition: color 0.15s;
        }
        .ex-remove:hover { color: #ff6060; }

        .empty-day { font-size: 13px; color: #2a2a3a; font-style: italic; padding: 4px 0; }

        .add-day-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 14px; background: transparent;
          border: 1px dashed #1f1f2a; border-radius: 12px; color: #3a3a4a;
          font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;
          transition: all 0.2s; margin-top: 4px;
        }
        .add-day-btn:hover { border-color: #e8ff4a44; color: #e8ff4a; background: #12130a; }
      `}</style>

      <div className="pg-root">
        <header className="pg-header">
          <div className="pg-header-left">
            <button className="btn-back" onClick={() => router.back()}>← Back</button>
            <span className="pg-breadcrumb">/ Edit Program</span>
          </div>
          <div className="pg-stats">
            <div className="stat-pill">Days<span>{visibleDays.length}</span></div>
            <div className="stat-pill">Exercises<span>{totalExercises}</span></div>
            <button className="btn-save" onClick={saveProgram} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </header>

        <main className="pg-body">
          {error && <div className="error-bar"><span>⚠</span> {error}</div>}

          <div className="section-label">Program Title</div>
          <input
            className="title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled Program"
          />

          <div className="days-container">
            {visibleDays.map((day, di) => (
              <div key={day._tempId} className="day-card">
                <div className="day-header">
                  <span className="day-index">Day {di + 1}</span>
                  <input
                    className="day-name-input"
                    value={day.name}
                    onChange={e => setDays(prev =>
                      prev.map(d => d._tempId === day._tempId ? { ...d, name: e.target.value } : d)
                    )}
                    placeholder="Day name"
                  />
                  <div className="day-header-actions">
                    <button className="btn-add-block" onClick={() => addBlock(day._tempId)}>+ Block</button>
                    <button className="btn-icon" onClick={() => removeDay(day._tempId)}>×</button>
                  </div>
                </div>

                <div className="day-body">
                  {day.blocks.filter(b => !b._deleted).length === 0 && (
                    <div className="empty-day">No blocks yet — add one above</div>
                  )}
                  {day.blocks.filter(b => !b._deleted).map(block => (
                    <div key={block._tempId} className="block-card">
                      <div className="block-header">
                        <div className="block-dot" />
                        <input
                          className="block-name-input"
                          value={block.name}
                          onChange={e => setDays(prev => prev.map(d => {
                            if (d._tempId !== day._tempId) return d
                            return {
                              ...d,
                              blocks: d.blocks.map(b =>
                                b._tempId === block._tempId ? { ...b, name: e.target.value } : b
                              ),
                            }
                          }))}
                          placeholder="Block name"
                        />
                        <button className="btn-add-ex" onClick={() => addExercise(day._tempId, block._tempId)}>
                          + Exercise
                        </button>
                        <button
                          className="btn-icon"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => removeBlock(day._tempId, block._tempId)}
                        >×</button>
                      </div>

                      {block.exercises.filter(e => !e._deleted).length > 0 && (
                        <div className="block-exercises">
                          <div className="ex-header-row">
                            <div className="ex-col-label">Exercise</div>
                            <div className="ex-col-label">Sets</div>
                            <div className="ex-col-label">Reps</div>
                            <div className="ex-col-label">Kg</div>
                            <div className="ex-col-label">Rest</div>
                            <div />
                          </div>
                          {block.exercises.map((be, idx) =>
                            be._deleted ? null : (
                              <div key={idx} className="exercise-row">
                                <div>
                                  <input
                                    list="exList"
                                    className="ex-input"
                                    value={be.exerciseName || ''}
                                    placeholder="Search exercise…"
                                    onChange={e => updateExField(day._tempId, block._tempId, idx, 'exerciseName', e.target.value)}
                                  />
                                </div>
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.sets || ''}
                                  onChange={e => updateExField(day._tempId, block._tempId, idx, 'sets', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.reps || ''}
                                  onChange={e => updateExField(day._tempId, block._tempId, idx, 'reps', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.kg || ''}
                                  onChange={e => updateExField(day._tempId, block._tempId, idx, 'kg', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.rest_seconds || ''}
                                  onChange={e => updateExField(day._tempId, block._tempId, idx, 'rest_seconds', e.target.value)}
                                />
                                <button
                                  className="ex-remove"
                                  onClick={() => removeExercise(day._tempId, block._tempId, idx)}
                                >×</button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button className="add-day-btn" onClick={addDay}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              Add Day
            </button>
          </div>
        </main>
      </div>

      <datalist id="exList">
        {exerciseCatalogue.map((ex: Exercise) => (
          <option key={ex.id} value={ex.name} />
        ))}
      </datalist>
    </>
  )
}
