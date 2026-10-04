// app/apple-icon.tsx
// iPhone home-screen icon (apple-touch-icon, 180×180). iOS rounds the corners itself.

import { appIcon } from '@/lib/appIcon'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return appIcon(180, 0.72)
}
