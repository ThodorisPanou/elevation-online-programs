// scripts/test-athlete-api.mjs
// End-to-end test of athlete logins against a running dev server + the DEV Supabase project (migration C).
// Creates a temporary admin, two coaches with one athlete each, exercises every route and the get_my_*()
// functions with a real athlete session, and deletes everything at the end.
// Usage: npm run dev (in another terminal), then: node --env-file=.env.local scripts/test-athlete-api.mjs [baseUrl]

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

// Like the browser on /l/<token>: redeem, then turn the token hash into a session
async function redeem(token) {
  const r = await api('POST', '/api/login-link/redeem', null, { token })
  if (r.status !== 200) return { ...r }
  const c = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await c.auth.verifyOtp({ token_hash: r.json.tokenHash, type: 'magiclink' })
  return { ...r, client: c, token: data?.session?.access_token, error }
}

const linkToken = u => u?.split('/l/')[1]
const stamp     = Date.now() % 100000
const password  = `Tmp-${crypto.randomUUID()}`
const created   = { users: [], coaches: [], athletes: [] }

async function tempUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.users.push(data.user.id)
  return data.user.id
}

async function tempCoach(username) {
  const userId = await tempUser(`${username}@login.invalid`)
  const { data, error } = await admin.from('coaches')
    .insert({ user_id: userId, username, name: `Coach ${username}`, must_change_password: false }).select().single()
  if (error) throw error
  created.coaches.push(data.id)
  const { token } = await signIn(`${username}@login.invalid`, password)
  return { id: data.id, username, token }
}

async function tempAthlete(coachId, name) {
  const { data, error } = await admin.from('athletes').insert({ name, surname: 'Test', coach_id: coachId }).select().single()
  if (error) throw error
  created.athletes.push(data.id)
  const { data: program, error: pErr } = await admin.from('programs')
    .insert({ athlete_id: data.id, title: `${name}'s program` }).select().single()
  if (pErr) throw pErr
  return { id: data.id, programId: program.id }
}

try {
  // ─── Fixtures ────────────────────────────────────────────────────────────
  const adminUserId = await tempUser(`tmp-admin-${stamp}@example.com`)
  await admin.from('admins').insert({ user_id: adminUserId })
  const { token: adminToken } = await signIn(`tmp-admin-${stamp}@example.com`, password)

  const coachA = await tempCoach(`t.coach.a${stamp}`)
  const coachB = await tempCoach(`t.coach.b${stamp}`)
  const x = await tempAthlete(coachA.id, 'Xenia')
  const y = await tempAthlete(coachB.id, 'Yannis')
  const xLogin = `/api/athletes/${x.id}/login`
  const username = `t.athlete${stamp}`

  // ─── Who may manage the login ────────────────────────────────────────────
  check((await api('GET', xLogin)).status === 401, 'login status without token → 401')
  check((await api('GET', xLogin, coachB.token)).status === 404, "other coach can't see the login → 404")
  check((await api('GET', `/api/athletes/not-a-uuid/login`, coachA.token)).status === 404, 'bad athlete id → 404')

  let r = await api('GET', xLogin, coachA.token)
  check(r.status === 200 && r.json.login?.username === null && !r.json.login.hasAccount && !r.json.login.link,
    'coach sees "no login yet"', JSON.stringify(r.json))
  check((await api('GET', xLogin, adminToken)).status === 200, 'admin sees any athlete login')

  // ─── Username ────────────────────────────────────────────────────────────
  r = await api('POST', `/api/athletes/${x.id}/login-link`, coachA.token)
  check(r.status === 400 && /username/i.test(r.json.error), 'link before a username → 400', r.json.error)

  r = await api('PUT', xLogin, coachA.token, { username: 'Bad Name!' })
  check(r.status === 400, 'invalid username → 400', r.json.error)
  r = await api('PUT', xLogin, coachA.token, { username: coachB.username })
  check(r.status === 409, "a coach's username → 409", r.json.error)
  r = await api('PUT', xLogin, coachB.token, { username })
  check(r.status === 404, "other coach can't set the username → 404")
  r = await api('PUT', xLogin, coachA.token, { username: `  ${username.toUpperCase()} ` })
  check(r.status === 200 && r.json.login?.username === username, 'coach sets username (normalized)', r.json.error)
  r = await api('PUT', `/api/athletes/${y.id}/login`, coachB.token, { username })
  check(r.status === 409, 'same username for another athlete → 409', r.json.error)

  // ─── Login links ─────────────────────────────────────────────────────────
  check((await api('POST', `/api/athletes/${x.id}/login-link`, coachB.token)).status === 404,
    "other coach can't create a link → 404")

  r = await api('POST', `/api/athletes/${x.id}/login-link`, coachA.token)
  const firstLink = linkToken(r.json.url)
  check(r.status === 201 && /^[A-Za-z0-9_-]{43}$/.test(firstLink ?? '') && new Date(r.json.expiresAt) > new Date(Date.now() + 6.9 * 864e5),
    'link: /l/<token>, valid ~7 days', JSON.stringify(r.json))
  const { data: xRow } = await admin.from('athletes').select('user_id').eq('id', x.id).single()
  check(!!xRow?.user_id, 'first link creates the athlete login')
  const xUserId = xRow?.user_id

  r = await api('POST', `/api/athletes/${x.id}/login-link`, coachA.token)
  const secondLink = linkToken(r.json.url)
  check(r.status === 201 && secondLink !== firstLink, 'second link')

  r = await api('GET', xLogin, coachA.token)
  check(r.json.login?.hasAccount && r.json.login.link?.expiresAt, 'status shows the account and the open link')

  check((await redeem(firstLink)).status === 410, 'a newer link revokes the older one → 410')
  check((await redeem('not-a-token')).status === 410, 'garbage token → 410')
  check((await redeem('A'.repeat(43))).status === 410, 'unknown token → 410')

  const athlete = await redeem(secondLink)
  check(athlete.status === 200 && athlete.token && !athlete.error, 'redeem → session', athlete.error?.message ?? JSON.stringify(athlete.json))
  check((await redeem(secondLink)).status === 410, 'a link works only once → 410')

  r = await api('GET', xLogin, coachA.token)
  check(!r.json.login?.link && r.json.login?.lastSignInAt, 'after redeem: no open link, last sign-in set')

  // Expired link
  const expired = 'B'.repeat(43)
  await admin.from('athlete_login_links').insert({
    athlete_id: x.id, expires_at: new Date(Date.now() - 1000).toISOString(),
    token_hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expired))))
      .map(b => b.toString(16).padStart(2, '0')).join(''),
  })
  check((await redeem(expired)).status === 410, 'expired link → 410')

  // ─── The athlete's session ───────────────────────────────────────────────
  r = await api('GET', '/api/me', athlete.token)
  check(r.status === 200 && r.json.athlete?.id === x.id && !r.json.isAdmin && r.json.coach === null,
    '/api/me: athlete', JSON.stringify(r.json))

  const mine = await athlete.client.rpc('get_my_programs')
  check(!mine.error && mine.data?.length === 1 && mine.data[0].id === x.programId, 'get_my_programs → own program')
  const own = await athlete.client.rpc('get_my_program', { p_program_id: x.programId })
  check(own.data?.id === x.programId, 'get_my_program opens it')
  const other = await athlete.client.rpc('get_my_program', { p_program_id: y.programId })
  check(!other.error && other.data === null, "get_my_program refuses someone else's program")
  const me = await athlete.client.rpc('get_my_athlete')
  check(me.data?.username === username && !('notes' in (me.data ?? {})), 'get_my_athlete without notes')
  const direct = await athlete.client.from('athletes').select('id')
  check(!direct.error && direct.data.length === 0, 'no direct table reads')

  check((await api('GET', '/api/coaches', athlete.token)).status === 403, 'athlete → /api/coaches 403')
  check((await api('GET', xLogin, athlete.token)).status === 403, 'athlete → login management 403')
  check((await api('POST', '/api/upload-video', athlete.token, { contentType: 'video/mp4', size: 10 })).status === 403,
    'athlete → video routes 403')
  check((await api('DELETE', `/api/athletes/${x.id}`, athlete.token)).status === 403, "athlete can't delete")

  // Optional password, then password login
  r = await api('POST', '/api/me/password', athlete.token, { password })
  check(r.status === 200, 'athlete sets a password', r.json.error)
  check(!(await signIn(`${username}@login.invalid`, password)).error, 'athlete signs in with username + password')

  // ─── Rename: the login follows ───────────────────────────────────────────
  const renamed = `${username}.r`
  r = await api('PUT', xLogin, coachA.token, { username: renamed })
  check(r.status === 200 && r.json.login?.username === renamed, 'rename username')
  check(!(await signIn(`${renamed}@login.invalid`, password)).error, 'new username signs in')
  check((await signIn(`${username}@login.invalid`, password)).error, 'old username no longer signs in')

  // ─── Disable / enable ────────────────────────────────────────────────────
  r = await api('POST', `/api/athletes/${x.id}/login-link`, coachA.token)
  const pendingLink = linkToken(r.json.url)
  r = await api('PATCH', xLogin, coachA.token, { action: 'disable' })
  check(r.status === 200 && r.json.login?.disabled && !r.json.login.link, 'disable (open link revoked)')
  check((await redeem(pendingLink)).status === 410, "disabled athlete's link → 410")
  check((await signIn(`${renamed}@login.invalid`, password)).error, 'disabled athlete cannot sign in')
  const afterDisable = await athlete.client.rpc('get_my_programs')
  check(!afterDisable.data?.length, 'disabled athlete: existing session sees no programs')
  r = await api('POST', `/api/athletes/${x.id}/login-link`, coachA.token)
  check(r.status === 409, 'no new link while disabled → 409', r.json.error)

  r = await api('PATCH', xLogin, coachA.token, { action: 'enable' })
  check(r.status === 200 && !r.json.login?.disabled, 'enable')
  check(!(await signIn(`${renamed}@login.invalid`, password)).error, 're-enabled athlete signs in again')
  check((await api('PATCH', xLogin, coachA.token, { action: 'nope' })).status === 400, 'unknown action → 400')

  // ─── Delete ──────────────────────────────────────────────────────────────
  check((await api('DELETE', `/api/athletes/${x.id}`, coachB.token)).status === 404, "other coach can't delete → 404")
  r = await api('DELETE', `/api/athletes/${x.id}`, coachA.token)
  check(r.status === 200, 'coach deletes the athlete', r.json.error)
  const { data: gone } = await admin.from('athletes').select('id').eq('id', x.id)
  const { data: goneProgram } = await admin.from('programs').select('id').eq('id', x.programId)
  check(!gone?.length && !goneProgram?.length, '… with their programs')
  const { error: userGone } = await admin.auth.admin.getUserById(xUserId)
  check(!!userGone, '… and their login')
  if (!userGone) created.users.push(xUserId)

  r = await api('DELETE', `/api/athletes/${y.id}`, adminToken)
  check(r.status === 200, 'admin deletes any athlete (no login yet)', r.json.error)
} catch (err) {
  check(false, 'unexpected error', err.message ?? String(err))
} finally {
  // ─── Cleanup (rows the test didn't delete itself) ────────────────────────
  if (created.athletes.length) await admin.from('athletes').delete().in('id', created.athletes)
  if (created.coaches.length)  await admin.from('coaches').delete().in('id', created.coaches)
  await admin.from('admins').delete().in('user_id', created.users)
  for (const id of created.users) await admin.auth.admin.deleteUser(id)
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.extra && !r.ok ? ` — ${r.extra}` : ''}`)
const passed = results.filter(r => r.ok).length
console.log(`${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
