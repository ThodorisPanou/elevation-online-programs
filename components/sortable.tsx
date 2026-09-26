'use client'

// components/sortable.tsx
// Thin wrappers around @dnd-kit for vertical, handle-only reordering.
// Each list gets its own DndContext, so items only move within their parent
// (exercises stay in their block, blocks in their day).

import { ReactNode, useId } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export function SortableList({ ids, onMove, children }: {
  ids:      string[]
  onMove:   (activeId: string, overId: string) => void
  children: ReactNode
}) {
  const dndId   = useId()   // stable ids for dnd-kit's ARIA attributes (avoids SSR hydration mismatch)
  const sensors = useSensors(
    useSensor(MouseSensor,   { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// Renders `children(handle)`; place `handle` wherever the grip should appear.
export function SortableItem({ id, className, handleLabel, children }: {
  id:          string
  className:   string
  handleLabel: string
  children:    (handle: ReactNode) => ReactNode
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id })

  const style = {
    // Lock to the vertical axis
    transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
    transition,
    position:  'relative' as const,
    zIndex:    isDragging ? 20 : undefined,
  }

  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="drag-handle"
      aria-label={handleLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={16} aria-hidden />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style} className={`${className}${isDragging ? ' dragging' : ''}`}>
      {children(handle)}
    </div>
  )
}
