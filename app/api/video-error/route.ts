// app/api/video-error/route.ts
// Public: the video player reports a failed load (components/programView.tsx → VideoModal) so device-specific
// playback bugs show up in the Vercel logs with evidence. Logs only the error and the browser — no user data.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const text = (await req.text()).slice(0, 1000)
  let report: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null) report = parsed   // public route: ignore anything else
  } catch {}
  console.log('video-error', JSON.stringify({
    code: report.code, message: report.message, network: report.network, host: report.host,
    standalone: report.standalone, attempt: report.attempt,
    ua: req.headers.get('user-agent')?.slice(0, 300) ?? 'unknown',
  }))
  return new NextResponse(null, { status: 204 })
}
