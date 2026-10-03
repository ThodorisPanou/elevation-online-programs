// app/api/login-link/redeem/route.ts
// Public (the athlete isn't signed in yet). Body: { token } from /l/<token> → { tokenHash }, which the browser
// exchanges for a session with supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// Every bad link gets the same 410 message; tokens are 256-bit, so guessing isn't practical.

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/server/coaches'
import { redeemLoginLink } from '@/lib/server/athletes'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json().catch(() => ({}))
    return NextResponse.json(await redeemLoginLink(token))
  } catch (err) {
    return errorResponse('POST /api/login-link/redeem', err)
  }
}
