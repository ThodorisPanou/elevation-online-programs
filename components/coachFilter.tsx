'use client'

// components/coachFilter.tsx
// Admin-only "Coach: All / <name>" select above a list. value '' = all coaches.

import type { Coach } from '@/lib/services/coachService'

export default function CoachFilter({ coaches, value, onChange }: {
  coaches:  Coach[]
  value:    string
  onChange: (coachId: string) => void
}) {
  if (coaches.length === 0) return null
  return (
    <label className="coach-filter">
      <span className="coach-filter-label">Coach</span>
      <select className="field-input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All coaches</option>
        {coaches.map(c => (
          <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (deactivated)'}</option>
        ))}
      </select>
    </label>
  )
}
