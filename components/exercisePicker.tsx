'use client'

// components/exercisePicker.tsx
// Searchable exercise combobox for the program editor. Shows which catalogue
// exercises have a video and lets you preview one before picking it.
// Free text is still allowed: an unknown name becomes a new exercise on save.
//
// The dropdown is portalled to <body> with fixed positioning, because the
// editor's day/block cards clip overflow.

import { Fragment, KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExerciseCatalogueItem } from '@/lib/viewModels/ExerciseViewModel'
import { VideoModal } from '@/components/programView'
import { Check, Play, Plus, Video } from 'lucide-react'
import './exercisePicker.css'

const MAX_RESULTS = 100
const LIST_MAX_HEIGHT = 320

interface Props {
  value:       string
  selectedId?: string                   // exercise currently linked to the row
  catalogue:   ExerciseCatalogueItem[]
  onChange:    (name: string) => void   // every keystroke
  onSelect:    (item: ExerciseCatalogueItem) => void   // picked from the list (exact entry)
  onCommit:    (name: string) => void   // blur — resolve free text to an exercise
  autoFocus?: boolean
  ariaLabel?: string
}

// Alphabetical, ignoring case; when names are identical the one with a video
// comes first, so the highlighted default is the better duplicate
const byName = (a: ExerciseCatalogueItem, b: ExerciseCatalogueItem) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  || Number(!!b.video_url) - Number(!!a.video_url)

// Rank: name starts with the query > a word starts with it > it appears anywhere
function rank(items: ExerciseCatalogueItem[], query: string, videoOnly: boolean) {
  const q = query.trim().toLowerCase()
  const pool = videoOnly ? items.filter(i => i.video_url) : items
  if (!q) return [...pool].sort(byName)
  const tiers: ExerciseCatalogueItem[][] = [[], [], []]
  for (const item of pool) {
    const name = item.name.toLowerCase()
    const at = name.indexOf(q)
    if (at < 0) continue
    if (at === 0) tiers[0].push(item)
    else if (/[\s.(\-/]/.test(name[at - 1])) tiers[1].push(item)
    else tiers[2].push(item)
  }
  return tiers.flatMap(tier => tier.sort(byName))
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <Fragment>
      {text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}
    </Fragment>
  )
}

export default function ExercisePicker({ value, selectedId, catalogue, onChange, onSelect, onCommit, autoFocus, ariaLabel }: Props) {
  const listId   = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const [open,      setOpen]      = useState(false)
  const [active,    setActive]    = useState(0)
  const [videoOnly, setVideoOnly] = useState(false)
  const [preview,   setPreview]   = useState<ExerciseCatalogueItem | null>(null)
  const [pos,       setPos]       = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  // Read inside blur/outside-click handlers. Set synchronously: the preview
  // dialog grabs focus (blurring the input) before any effect here would run.
  const previewRef = useRef(false)
  const openPreview  = (ex: ExerciseCatalogueItem) => { previewRef.current = true;  setPreview(ex) }
  const closePreview = () => { previewRef.current = false; setPreview(null) }

  const results = useMemo(() => rank(catalogue, value, videoOnly), [catalogue, value, videoOnly])
  const shown   = results.slice(0, MAX_RESULTS)
  const known   = catalogue.some(c => c.name.toLowerCase() === value.trim().toLowerCase())

  // Keep the highlighted option scrolled into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Position the portalled list under (or above) the input, following scroll/resize
  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom
      const width = Math.min(Math.max(r.width, 420), window.innerWidth - 16)
      const left  = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      setPos(below < LIST_MAX_HEIGHT + 16 && r.top > below
        ? { left, width, bottom: window.innerHeight - r.top + 4 }
        : { left, width, top: r.bottom + 4 })
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place) }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [open])

  // Close on clicks outside the input and the list (but not while previewing)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (previewRef.current) return
      const t = e.target as Node
      if (inputRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const select = (item: ExerciseCatalogueItem) => {
    onSelect(item)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive(i => Math.max(0, Math.min(shown.length - 1, i + step)))
    } else if (e.key === 'Enter' && open && shown[active]) {
      e.preventDefault()
      if (e.shiftKey) { if (shown[active].video_url) openPreview(shown[active]) }
      else select(shown[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const list = open && pos && (
    <div
      ref={listRef}
      className="picker-list"
      style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: LIST_MAX_HEIGHT }}
      // Keep focus in the input while clicking inside the list
      onMouseDown={e => e.preventDefault()}
    >
      <div className="picker-toolbar">
        <span className="picker-count">
          {results.length} exercise{results.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className={`picker-toggle${videoOnly ? ' on' : ''}`}
          aria-pressed={videoOnly}
          onClick={() => { setVideoOnly(v => !v); setActive(0) }}
        >
          <Video size={13} aria-hidden /> With video
        </button>
      </div>

      <div role="listbox" id={listId} aria-label="Exercises" className="picker-options">
        {shown.map((ex, i) => (
          <div
            key={ex.id}
            id={`${listId}-${i}`}
            data-index={i}
            role="option"
            aria-selected={i === active}
            className={`picker-option${i === active ? ' active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => select(ex)}
          >
            <span className="picker-option-name"><Highlight text={ex.name} query={value} /></span>
            {selectedId === ex.id && <Check size={14} className="picker-selected" aria-label="Selected" />}
            {ex.video_url ? (
              <button
                type="button"
                tabIndex={-1}
                className="picker-play"
                aria-label={`Preview video: ${ex.name}`}
                onClick={e => { e.stopPropagation(); openPreview(ex) }}
              >
                <Play size={12} aria-hidden /> Video
              </button>
            ) : (
              <span className="picker-novideo">No video</span>
            )}
          </div>
        ))}

        {results.length > MAX_RESULTS && (
          <div className="picker-more">Showing {MAX_RESULTS} of {results.length} — keep typing to narrow down</div>
        )}

        {value.trim() && !known && (
          <div className="picker-new">
            <Plus size={13} aria-hidden />
            {shown.length === 0 ? 'No match — ' : ''}
            &ldquo;{value.trim()}&rdquo; will be added as a new exercise when you save
          </div>
        )}
      </div>

      <div className="picker-hint" aria-hidden>
        ↑↓ navigate · Enter select · Shift+Enter preview · Esc close
      </div>
    </div>
  )

  return (
    <>
      <input
        ref={inputRef}
        className="ex-input ex-name-input"
        role="combobox"
        aria-label={ariaLabel ?? 'Exercise'}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="Search exercise…"
        autoFocus={autoFocus}
        // Select the current name so typing replaces it (quick swap to another exercise)
        onFocus={e => { e.target.select(); setOpen(true) }}
        onClick={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setActive(0); setOpen(true) }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (previewRef.current) return
          setOpen(false)
          onCommit(value)
        }}
      />
      {list && createPortal(list, document.body)}
      {preview?.video_url && createPortal(
        <VideoModal video={{ url: preview.video_url, name: preview.name }} onClose={closePreview} />,
        document.body,
      )}
    </>
  )
}
