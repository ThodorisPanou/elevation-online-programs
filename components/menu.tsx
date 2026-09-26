'use client'

// components/menu.tsx
// "⋯" overflow menu. Closes on outside click, Esc, or after an item is chosen.

import { ReactNode, useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'

export interface MenuItem {
  label:    string
  icon?:    ReactNode
  danger?:  boolean
  onSelect: () => void
}

export default function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn-icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Ellipsis size={18} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item${item.danger ? ' danger' : ''}`}
              // Refocus the trigger first so a dialog opened by the item returns focus there
              onClick={() => { setOpen(false); triggerRef.current?.focus(); item.onSelect() }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
