// scripts/test-coach-api.mjs
// End-to-end test of the coach account API against a running dev server + the DEV Supabase project.
// Creates a temporary admin and a test coach, exercises every route, and deletes both at the end.
// Usage: npm run dev (in another terminal), then: node --env-file=.env.local scripts/test-coach-api.mjs [baseUrl]

import { createClient } from '@supabase/supabase-js'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url.includes('gvilabpujmgkulysdkiw')) {
  console.error('Refusing to run: .env.local does not point at the glabro-dev project')
  process.exit(1)
}

const admin   = createClient(url, svc, { auth: { persistSession: false } })
const results = []
const check   = (ok, name, extra = '') => results.push({ ok: !!ok, name, extra })

async function signIn(email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  return { client: c, token: data?.session?.access_token, error }
}

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

const adminEmail = `tmp-admin-${Date.now()}@example.com`
const adminPass  = `Tmp-${crypto.randomUUID()}`
const username   = `test.coach${Date.now() % 100000}`
let adminUserId, coachId, coachUserId

try {
  // ─── Temp admin ──────────────────────────────────────────────────────────
  const { data: au, error: ae } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPass, email_confirm: true })
  if (ae) throw ae
  adminUserId = au.user.id
  await admin.from('admins').insert({ user_id: adminUserId })
  const { token: adminToken } = await signIn(adminEmail, adminPass)

  // ─── Auth checks ─────────────────────────────────────────────────────────
  check((await api('GET', '/api/coaches')).status === 401, 'GET /api/coaches without token → 401')
  check((await api('GET', '/api/me')).status === 401, 'GET /api/me without token → 401')

  let me = await api('GET', '/api/me', adminToken)
  check(me.status === 200 && me.json.isAdmin === true && me.json.coach === null, '/api/me: admin, no coach profile')

  // ─── Create ──────────────────────────────────────────────────────────────
  let r = await api('POST', '/api/coaches', adminToken, { username: 'Bad Name!', name: 'X' })
  check(r.status === 400, 'invalid username → 400', r.json.error)

  r = await api('POST', '/api/coaches', adminToken, { username: username.toUpperCase(), name: '  Test Coach ', email: 'coach@example.com' })
  check(r.status === 201 && r.json.coach?.username === username && r.json.coach?.name === 'Test Coach',
    'create coach (username lowercased, name trimmed)', r.json.error ?? '')
  check(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(r.json.tempPassword ?? ''), 'temp password format')
  coachId     = r.json.coach?.id
  coachUserId = r.json.coach?.user_id
  let tempPassword = r.json.tempPassword

  r = await api('POST', '/api/coaches', adminToken, { username, name: 'Dup' })
  check(r.status === 409, 'duplicate username → 409', r.json.error)

  // ─── Coach logs in with username; blocked until password change ──────────
  let coach = await signIn(`${username}@login.invalid`, tempPassword)
  check(!coach.error && coach.token, 'coach signs in with username + temp password', coach.error?.message ?? '')

  me = await api('GET', '/api/me', coach.token)
  check(me.status === 200 && !me.json.isAdmin && me.json.coach?.username === username && me.json.coach?.must_change_password === true,
    '/api/me: coach with must_change_password')

  r = await api('GET', '/api/coaches', coach.token)
  check(r.status === 403, 'coach cannot list coaches → 403')
  r = await api('POST', '/api/upload-video', coach.token, { contentType: 'video/mp4', size: 10 })
  check(r.status === 403 && /temporary password/.test(r.json.error), 'coach with temp password blocked from video routes', r.json.error)

  r = await api('POST', '/api/me/password', coach.token, { password: 'short' })
  check(r.status === 400, 'too-short new password → 400', r.json.error)
  r = await api('POST', '/api/me/password', coach.token, { password: tempPassword })
  check(r.status === 400 && /different/.test(r.json.error), 'same-as-temp password → 400', r.json.error)

  const newPassword = `New-${crypto.randomUUID().slice(0, 8)}`
  r = await api('POST', '/api/me/password', coach.token, { password: newPassword })
  check(r.status === 200, 'coach changes password', r.json.error ?? '')

  const { data: afterChange } = await admin.from('coaches').select('must_change_password').eq('id', coachId).single()
  check(afterChange?.must_change_password === false, 'must_change_password cleared')
  check((await signIn(`${username}@login.invalid`, tempPassword)).error, 'old temp password no longer works')
  coach = await signIn(`${username}@login.invalid`, newPassword)
  check(!coach.error, 'new password works')
  me = await api('GET', '/api/me', coach.token)
  check(me.json.coach?.must_change_password === false, '/api/me: must_change_password false after change')

  r = await api('POST', '/api/upload-video', coach.token, { contentType: 'video/mp4', size: 10 })
  check(r.status !== 401 && r.status !== 403, 'coach passes the video route guard after changing password', `status ${r.status}: ${r.json.error ?? ''}`)

  // ─── Update ──────────────────────────────────────────────────────────────
  const renamed = `${username}.x`
  r = await api('PATCH', `/api/coaches/${coachId}`, adminToken, { action: 'update', username: renamed, name: 'Renamed Coach', email: '' })
  check(r.status === 200 && r.json.coach?.username === renamed && r.json.coach?.email === null, 'rename coach + clear email', r.json.error ?? '')
  check(!(await signIn(`${renamed}@login.invalid`, newPassword)).error, 'coach logs in with the new username')
  check((await signIn(`${username}@login.invalid`, newPassword)).error, 'old username no longer works')

  r = await api('PATCH', `/api/coaches/${coachId}`, coach.token, { action: 'deactivate' })
  check(r.status === 403, 'coach cannot PATCH coaches → 403')
  r = await api('PATCH', `/api/coaches/${coachId}`, adminToken, { action: 'nope' })
  check(r.status === 400, 'unknown action → 400')
  r = await api('PATCH', `/api/coaches/00000000-0000-0000-0000-000000000000`, adminToken, { action: 'reset-password' })
  check(r.status === 404, 'unknown coach → 404')

  // ─── Reset password ──────────────────────────────────────────────────────
  r = await api('PATCH', `/api/coaches/${coachId}`, adminToken, { action: 'reset-password' })
  tempPassword = r.json.tempPassword
  check(r.status === 200 && tempPassword, 'reset password returns a new temp password')
  const { data: afterReset } = await admin.from('coaches').select('must_change_password').eq('id', coachId).single()
  check(afterReset?.must_change_password === true, 'reset sets must_change_password again')
  check(!(await signIn(`${renamed}@login.invalid`, tempPassword)).error, 'new temp password works')

  // ─── Deactivate / activate ───────────────────────────────────────────────
  r = await api('PATCH', `/api/coaches/${coachId}`, adminToken, { action: 'deactivate' })
  check(r.status === 200 && r.json.coach?.active === false, 'deactivate')
  check((await signIn(`${renamed}@login.invalid`, tempPassword)).error, 'deactivated coach cannot sign in')
  r = await api('GET', '/api/me', coach.token)
  check(r.status === 401, 'deactivated coach: existing session rejected by /api/me', `status ${r.status}`)

  r = await api('PATCH', `/api/coaches/${coachId}`, adminToken, { action: 'activate' })
  check(r.status === 200 && r.json.coach?.active === true, 'activate')
  check(!(await signIn(`${renamed}@login.invalid`, tempPassword)).error, 'reactivated coach can sign in again')

  // ─── List ────────────────────────────────────────────────────────────────
  r = await api('GET', '/api/coaches', adminToken)
  const listed = r.json.coaches?.find(c => c.id === coachId)
  check(r.status === 200 && listed && listed.athletes === 0, 'admin lists coaches with counts')
} catch (err) {
  check(false, 'unexpected error', err.message ?? String(err))
} finally {
  // ─── Cleanup ─────────────────────────────────────────────────────────────
  if (coachId)     await admin.from('coaches').delete().eq('id', coachId)
  if (coachUserId) await admin.auth.admin.deleteUser(coachUserId)
  if (adminUserId) {
    await admin.from('admins').delete().eq('user_id', adminUserId)
    await admin.auth.admin.deleteUser(adminUserId)
  }
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.extra && !r.ok ? ` — ${r.extra}` : ''}`)
const passed = results.filter(r => r.ok).length
console.log(`${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
