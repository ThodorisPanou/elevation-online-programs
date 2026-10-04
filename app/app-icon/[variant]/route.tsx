// app/app-icon/[variant]/route.tsx
// PNG icons for the web app manifest: /app-icon/192, /app-icon/512, /app-icon/maskable (512, padded).

import { appIcon } from '@/lib/appIcon'

const VARIANTS: Record<string, { size: number; scale: number }> = {
  '192':      { size: 192, scale: 0.72 },
  '512':      { size: 512, scale: 0.72 },
  'maskable': { size: 512, scale: 0.56 },
}

export function generateStaticParams() {
  return Object.keys(VARIANTS).map(variant => ({ variant }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const v = VARIANTS[(await params).variant]
  if (!v) return new Response('Not found', { status: 404 })
  return appIcon(v.size, v.scale)
}
