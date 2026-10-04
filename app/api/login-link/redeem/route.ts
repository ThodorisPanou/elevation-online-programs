// app/api/login-link/redeem/route.ts
// Public (the athlete isn't signed in yet). Body: { token } from /l/<token> → { tokenHash }, which the browser
// exchanges for a session with supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// Every bad link gets the same 410 message; tokens are 256-bit, so guessing isn't practical.

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/server/coaches'
import { redeemLoginLink } from '@/lib/server/athletes'

export async function POST(req: NextRequest) {
  // Which browser used a link (Vercel logs) — to spot link scanners or in-app browsers using links up.
  // Never logs the token.
  const ua = req.headers.get('user-agent') ?? 'unknown'
  try {
    const { token } = await req.json().catch(() => ({}))
    const result = await redeemLoginLink(token)
    console.log('login-link redeemed by:', ua)
    return NextResponse.json(result)
  } catch (err) {
    console.log('login-link refused for:', ua)
    return errorResponse('POST /api/login-link/redeem', err)
  }
}
