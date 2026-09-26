'use client'

// components/modal.tsx
// Accessible dialog shell: closes on Esc / backdrop click, keeps Tab focus
// inside the dialog, and hands focus back to the opener when it closes.

import { ReactNode, useEffect, useRef, useState } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([hidden]), select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({
  onClose, title, className = 'modal', overlayClassName = 'modal-overlay', children,
}: {
  onClose:           () => void
  title:             string          // accessible name of the dialog
  className?:        string
  overlayClassName?: string
  children:          ReactNode
}) {
  const dialogRef  = useRef<HTMLDivElement>(null)
  // Captured during the first render, before the dialog moves focus
  const [opener]   = useState(() => document.activeElement as HTMLElement | null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current!

    // Focus the element marked data-autofocus, else the first focusable, else the dialog itself
    const initial = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>(FOCUSABLE)
    ;(initial ?? dialog).focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [opener])

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
