'use client'

// components/avatarPicker.tsx
// Round photo preview with upload / change / remove actions. Holds no state —
// the parent keeps the picked file and decides when to save it.

import { useRef } from 'react'
import './avatarPicker.css'

export default function AvatarPicker({ inputId, previewUrl, initials, onPick, onRemove }: {
  inputId:    string
  previewUrl: string | null
  initials:   string           // shown when there's no photo
  onPick:     (file: File) => void
  onRemove?:  () => void       // shows a Remove action while there's a photo
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="avatar-upload">
      <label className="avatar avatar-upload-preview" htmlFor={inputId} aria-hidden>
        {previewUrl ? <img src={previewUrl} alt="" /> : initials}
      </label>
      <div className="avatar-upload-info">
        <div className="avatar-upload-actions">
          <button type="button" className="avatar-upload-label" onClick={() => inputRef.current?.click()}>
            {previewUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {previewUrl && onRemove && (
            <button type="button" className="avatar-upload-label avatar-remove" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        <div className="avatar-upload-sub">JPG, PNG or WEBP</div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
