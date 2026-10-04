// lib/appIcon.tsx
// The home-screen app icon, drawn in code (rendered to PNG by next/og): the program view's mint thread with
// three beads, rising — "elevation" — on the athlete app's graphite. Replace with a real logo when there is one.

import { ImageResponse } from 'next/og'

export const ICON_BG     = '#111214'
export const ICON_ACCENT = '#8fd4b8'

/** `scale` < 1 leaves the padding Android's maskable icons need (content within the centre 80%). */
export function appIcon(size: number, scale = 1) {
  const beads = [[27, 73], [50, 50], [73, 27]]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ICON_BG }}>
        <svg width={size * scale} height={size * scale} viewBox="0 0 100 100">
          <path d="M27 73 L73 27" stroke={ICON_ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
          {beads.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 2 ? 9 : 7.5} fill={i === 2 ? ICON_ACCENT : ICON_BG}
                    stroke={ICON_ACCENT} strokeWidth="5" />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
