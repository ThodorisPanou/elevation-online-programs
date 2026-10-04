// app/manifest.ts
// Web app manifest: athletes install the app to their home screen ("Add to Home Screen") and it opens on
// their programs, full screen, without the browser bar.

import type { MetadataRoute } from 'next'
import { ICON_BG } from '@/lib/appIcon'
import { APP_NAME, APP_SHORT_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             APP_NAME,
    short_name:       APP_SHORT_NAME,
    description:      'Your training programs from your coach',
    start_url:        '/me',
    scope:            '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: ICON_BG,
    theme_color:      ICON_BG,
    icons: [
      { src: '/app-icon/192',      sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512',      sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
