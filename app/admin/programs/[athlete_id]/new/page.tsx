'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function NewProgramPage() {
  const router = useRouter()
  const params = useParams()
  const athleteId = params?.athlete_id as string

  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])

  type BlockExercise = {
    exerciseId?: string
    exerciseName?: string
    reps?: string
    kg?: string
    sets?: string
    rest_seconds?: string
    notes?: string
  }
  type Block = { id: string; name: string; exercises: BlockExercise[] }
  type Day = { id: string; name: string; blocks: Block[] }

  const [days, setDays] = useState<Day[]>([])

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')
      await loadExercises()
    }
    check()
  }, [])

  const loadExercises = async () => {
    const { data, error } = await supabase.from('exercises').select('id,name').order('name')
    if (error) return console.error('failed to load exercises', error)
    setExercises(data || [])
  }

  const createProgram = async () => {
    if (!title) return setError('Program title is required')
    setSaving(true)
    setError(null)
    try {
      const { data: program, error: progErr } = await supabase
        .from('programs')
        .insert([{ athlete_id: athleteId, title }])
        .select()
        .single()
      if (progErr) throw progErr

      for (let di = 0; di < days.length; di++) {
        const day = days[di]
        const { data: dayRow, error: dayErr } = await supabase
          .from('program_days')
          .insert([{ program_id: program.id, name: day.name, order_index: di }])
          .select()
          .single()
        if (dayErr) throw dayErr

        for (let bi = 0; bi < day.blocks.length; bi++) {
          const block = day.blocks[bi]
          const { data: blockRow, error: blockErr } = await supabase
            .from('blocks')
            .insert([{ day_id: dayRow.id, name: block.name, order_index: bi }])
            .select()
            .single()
          if (blockErr) throw blockErr

          for (let ei = 0; ei < block.exercises.length; ei++) {
            const ex = block.exercises[ei]
            if (!ex.exerciseId) continue
            const { error: exErr } = await supabase.from('block_exercises').insert([{
              block_id: blockRow.id,
              exercise_id: ex.exerciseId,
              sets: ex.sets ? parseInt(ex.sets) : null,
              reps: ex.reps || null,
              kg: ex.kg || null,
              rest_seconds: ex.rest_seconds ? parseInt(ex.rest_seconds) : null,
              notes: ex.notes || null,
              order_index: ei,
            }])
            if (exErr) throw exErr
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

  const addDay = () => {
    setDays([...days, { id: Date.now().toString(), name: `Day ${days.length + 1}`, blocks: [] }])
  }

  const removeDay = (dayId: string) => setDays(days.filter(d => d.id !== dayId))

  const addBlock = (dayId: string) => {
    setDays(days.map(d =>
      d.id === dayId
        ? { ...d, blocks: [...d.blocks, { id: Date.now().toString(), name: `Block ${d.blocks.length + 1}`, exercises: [] }] }
        : d
    ))
  }

  const removeBlock = (dayId: string, blockId: string) => {
    setDays(days.map(d =>
      d.id === dayId ? { ...d, blocks: d.blocks.filter(b => b.id !== blockId) } : d
    ))
  }

  const addBlockExercise = (dayId: string, blockId: string) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b.id !== blockId) return b
          return { ...b, exercises: [...b.exercises, { exerciseId: '', exerciseName: '', reps: '', kg: '', sets: '', rest_seconds: '', notes: '' }] }
        })
      }
    }))
  }

  const removeExercise = (dayId: string, blockId: string, idx: number) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b.id !== blockId) return b
          return { ...b, exercises: b.exercises.filter((_, i) => i !== idx) }
        })
      }
    }))
  }

  const updateExField = (dayId: string, blockId: string, idx: number, field: keyof BlockExercise, value: string) => {
    setDays(days.map(d => {
      if (d.id !== dayId) return d
      return {
        ...d,
        blocks: d.blocks.map(b => {
          if (b.id !== blockId) return b
          return {
            ...b,
            exercises: b.exercises.map((ex, i) => {
              if (i !== idx) return ex
              if (field === 'exerciseName') {
                const matched = exercises.find(e => e.name === value)
                return { ...ex, exerciseName: value, exerciseId: matched?.id }
              }
              return { ...ex, [field]: value }
            })
          }
        })
      }
    }))
  }

  const totalExercises = days.reduce((acc, d) => acc + d.blocks.reduce((a, b) => a + b.exercises.length, 0), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; }

        .pg-root {
          font-family: 'Barlow', sans-serif;
          background: #0d0d0f;
          min-height: 100vh;
          color: #e8e8ec;
        }

        .pg-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(13,13,15,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #1f1f26;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pg-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b6b7a;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .btn-back:hover { color: #e8e8ec; background: #1a1a22; }

        .pg-breadcrumb {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #3a3a4a;
        }

        .pg-stats {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .stat-pill {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4a4a5a;
          background: #16161e;
          border: 1px solid #1f1f2a;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .stat-pill span { color: #a0a0c0; margin-left: 4px; }

        .btn-create {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: #e8ff4a;
          color: #0d0d0f;
          border: none;
          padding: 8px 22px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-create:hover { background: #f5ff80; transform: translateY(-1px); }
        .btn-create:active { transform: translateY(0); }
        .btn-create:disabled { background: #2a2a35; color: #4a4a5a; cursor: not-allowed; transform: none; }

        .pg-body {
          max-width: 860px;
          margin: 0 auto;
          padding: 36px 24px 80px;
        }

        .pg-title-section {
          margin-bottom: 36px;
        }

        .section-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #4a4a5a;
          margin-bottom: 10px;
        }

        .title-input {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.01em;
          background: transparent;
          border: none;
          border-bottom: 2px solid #1f1f2a;
          color: #e8e8ec;
          width: 100%;
          padding: 4px 0 10px;
          outline: none;
          transition: border-color 0.2s;
        }
        .title-input::placeholder { color: #2a2a38; }
        .title-input:focus { border-bottom-color: #e8ff4a; }

        .error-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #2a0f0f;
          border: 1px solid #5a1a1a;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #ff7070;
        }

        .days-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .day-card {
          background: #111116;
          border: 1px solid #1a1a24;
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .day-card:focus-within { border-color: #2a2a40; }

        .day-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #14141a;
          border-bottom: 1px solid #1a1a24;
        }

        .day-index {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #e8ff4a;
          background: #1e2010;
          border: 1px solid #3a4010;
          padding: 3px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .day-name-input {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.02em;
          background: transparent;
          border: none;
          color: #e8e8ec;
          flex: 1;
          outline: none;
          min-width: 0;
        }
        .day-name-input::placeholder { color: #2a2a3a; }

        .day-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .btn-add-block {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6a6aaa;
          background: #16162a;
          border: 1px solid #22223a;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-add-block:hover { color: #aaaae8; background: #1e1e38; border-color: #2e2e50; }

        .btn-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #3a3a4a;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          transition: all 0.15s;
        }
        .btn-icon:hover { color: #ff6060; border-color: #3a1a1a; background: #1a1010; }

        .day-body {
          padding: 12px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .block-card {
          background: #0d0d12;
          border: 1px solid #18182a;
          border-radius: 8px;
          overflow: hidden;
        }

        .block-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #18182a;
        }

        .block-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4a4aaa;
          flex-shrink: 0;
        }

        .block-name-input {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: transparent;
          border: none;
          color: #8888cc;
          flex: 1;
          outline: none;
        }
        .block-name-input::placeholder { color: #222230; }

        .btn-add-ex {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4a4a6a;
          background: none;
          border: none;
          cursor: pointer;
          padding: 3px 8px;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .btn-add-ex:hover { color: #8888cc; }

        .block-exercises {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .exercise-row {
          display: grid;
          grid-template-columns: 1fr 52px 52px 52px 52px 24px;
          gap: 6px;
          align-items: center;
        }

        .ex-input {
          font-family: 'Barlow', sans-serif;
          font-size: 13px;
          font-weight: 400;
          background: #131320;
          border: 1px solid #1e1e2e;
          color: #c0c0d8;
          padding: 6px 8px;
          border-radius: 6px;
          outline: none;
          width: 100%;
          transition: border-color 0.15s;
        }
        .ex-input::placeholder { color: #2a2a3a; font-size: 12px; }
        .ex-input:focus { border-color: #3a3a5a; }

        .ex-input-sm {
          text-align: center;
          padding: 6px 4px;
        }

        .ex-remove {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: #2a2a3a;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
          transition: color 0.15s;
        }
        .ex-remove:hover { color: #ff6060; }

        .ex-header-row {
          display: grid;
          grid-template-columns: 1fr 52px 52px 52px 52px 24px;
          gap: 6px;
          padding: 0 12px 4px;
        }
        .ex-col-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #2e2e3e;
          text-align: center;
        }
        .ex-col-label:first-child { text-align: left; }

        .empty-day {
          font-size: 13px;
          color: #2a2a3a;
          font-style: italic;
          padding: 4px 0;
        }

        .add-day-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: transparent;
          border: 1px dashed #1f1f2a;
          border-radius: 12px;
          color: #3a3a4a;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
        }
        .add-day-btn:hover {
          border-color: #e8ff4a44;
          color: #e8ff4a;
          background: #12130a;
        }

        .block-remove-btn {
          margin-left: auto;
        }
      `}</style>

      <div className="pg-root">
        {/* Sticky Header */}
        <header className="pg-header">
          <div className="pg-header-left">
            <button className="btn-back" onClick={() => router.back()}>
              ← Back
            </button>
            <span className="pg-breadcrumb">/ New Program</span>
          </div>

          <div className="pg-stats">
            <div className="stat-pill">Days<span>{days.length}</span></div>
            <div className="stat-pill">Exercises<span>{totalExercises}</span></div>
            <button
              className="btn-create"
              onClick={createProgram}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Create Program'}
            </button>
          </div>
        </header>

        <main className="pg-body">
          {/* Title */}
          <div className="pg-title-section">
            <div className="section-label">Program Title</div>
            <input
              className="title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Untitled Program"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="error-bar">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Days */}
          <div className="days-container">
            {days.map((day, di) => (
              <div key={day.id} className="day-card">
                <div className="day-header">
                  <span className="day-index">Day {di + 1}</span>
                  <input
                    className="day-name-input"
                    value={day.name}
                    onChange={e => setDays(days.map(d => d.id === day.id ? { ...d, name: e.target.value } : d))}
                    placeholder="Day name"
                  />
                  <div className="day-header-actions">
                    <button className="btn-add-block" onClick={() => addBlock(day.id)}>+ Block</button>
                    <button className="btn-icon" onClick={() => removeDay(day.id)} title="Remove day">×</button>
                  </div>
                </div>

                <div className="day-body">
                  {day.blocks.length === 0 && (
                    <div className="empty-day">No blocks yet — add one above</div>
                  )}
                  {day.blocks.map((block) => (
                    <div key={block.id} className="block-card">
                      <div className="block-header">
                        <div className="block-dot" />
                        <input
                          className="block-name-input"
                          value={block.name}
                          onChange={e => setDays(days.map(d => {
                            if (d.id !== day.id) return d
                            return { ...d, blocks: d.blocks.map(b => b.id === block.id ? { ...b, name: e.target.value } : b) }
                          }))}
                          placeholder="Block name"
                        />
                        <button className="btn-add-ex" onClick={() => addBlockExercise(day.id, block.id)}>+ Exercise</button>
                        <button className="btn-icon block-remove-btn" onClick={() => removeBlock(day.id, block.id)} title="Remove block">×</button>
                      </div>

                      {block.exercises.length > 0 && (
                        <>
                          <div className="ex-header-row">
                            <div className="ex-col-label">Exercise</div>
                            <div className="ex-col-label">Sets</div>
                            <div className="ex-col-label">Reps</div>
                            <div className="ex-col-label">Kg</div>
                            <div className="ex-col-label">Rest</div>
                            <div />
                          </div>
                          <div className="block-exercises">
                            {block.exercises.map((be, idx) => (
                              <div key={idx} className="exercise-row">
                                <div>
                                  <input
                                    list="exList"
                                    className="ex-input"
                                    value={be.exerciseName || ''}
                                    placeholder="Search exercise…"
                                    onChange={e => updateExField(day.id, block.id, idx, 'exerciseName', e.target.value)}
                                  />
                                </div>
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.sets || ''}
                                  onChange={e => updateExField(day.id, block.id, idx, 'sets', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.reps || ''}
                                  onChange={e => updateExField(day.id, block.id, idx, 'reps', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.kg || ''}
                                  onChange={e => updateExField(day.id, block.id, idx, 'kg', e.target.value)}
                                />
                                <input
                                  className="ex-input ex-input-sm"
                                  placeholder="—"
                                  value={be.rest_seconds || ''}
                                  onChange={e => updateExField(day.id, block.id, idx, 'rest_seconds', e.target.value)}
                                />
                                <button className="ex-remove" onClick={() => removeExercise(day.id, block.id, idx)}>×</button>
                              </div>
                            ))}
                          </div>
                        </>
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
        {exercises.map(ex => <option key={ex.id} value={ex.name} />)}
      </datalist>
    </>
  )
}
