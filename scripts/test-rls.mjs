// scripts/test-rls.mjs
// Data isolation test (migration B) against the DEV Supabase project, through the same API the browser uses.
// Creates a temporary admin + two temporary coaches (B, C), checks what each can read/write — including
// the existing coach who owns the seed data (A) — then deletes everything it created.
// Usage: node --env-file=.env.local scripts/test-rls.mjs

import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url.includes('gvilabpujmgkulysdkiw')) { console.error('Refusing: .env.local is not the glabro-dev project'); process.exit(1) }

const service = createClient(url, svc, { auth: { persistSession: false } })
const results = []
const check   = (ok, name, extra = '') => results.push({ ok: !!ok, name, extra })
const denied  = r => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null

const stamp   = Date.now() % 1000000
const created = { users: [], files: [] }

async function makeUser(email, { admin = false, coach = null } = {}) {
  const password = `Pw-${crypto.randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.users.push(data.user.id)
  if (admin) await service.from('admins').insert({ user_id: data.user.id })
  let coachId = null
  if (coach) {
    const { data: c, error: ce } = await service.from('coaches')
      .insert({ user_id: data.user.id, username: coach, name: coach, must_change_password: false }).select().single()
    if (ce) throw ce
    coachId = c.id
  }
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw se
  return { client, userId: data.user.id, coachId }
}

try {
  // ─── Setup ───────────────────────────────────────────────────────────────
  const { data: coachA } = await service.from('coaches').select('id, username').eq('username', 'ferris').single()
  const { data: aAthlete } = await service.from('athletes').select('id').eq('coach_id', coachA.id).limit(1).single()
  const { data: aProgram } = await service.from('programs').select('id, public_token').eq('coach_id', coachA.id).limit(1).single()
  const { data: aExercise } = await service.from('exercises').select('id, name').eq('coach_id', coachA.id).limit(1).single()
  const { data: aDay } = await service.from('program_days').select('id').eq('program_id', aProgram.id).limit(1).single()

  const admin = await makeUser(`rls-admin-${stamp}@example.com`, { admin: true })
  const B     = await makeUser(`rls.b${stamp}@login.invalid`, { coach: `rls.b${stamp}` })
  const C     = await makeUser(`rls.c${stamp}@login.invalid`, { coach: `rls.c${stamp}` })
  const pub   = createClient(url, anon, { auth: { persistSession: false } })

  // ─── Anonymous (share-link visitors) ─────────────────────────────────────
  for (const t of ['athletes', 'programs', 'exercises', 'program_days', 'blocks', 'block_exercises', 'coaches', 'admins']) {
    check(denied(await pub.from(t).select('*').limit(1)), `anon cannot read ${t}`)
  }
  check(denied(await pub.from('athletes').insert({ name: 'x', surname: 'y', coach_id: coachA.id }).select()), 'anon cannot insert athletes')
  const shared = await pub.rpc('get_shared_program', { p_token: aProgram.public_token })
  check(!shared.error && shared.data?.id === aProgram.id && shared.data.program_days.length > 0, 'anon opens a share link (get_shared_program)')
  check(denied(await pub.rpc('delete_athlete', { p_athlete_id: aAthlete.id })), 'anon cannot call delete_athlete')

  // ─── Coach B: own data only ──────────────────────────────────────────────
  let r = await B.client.from('athletes').select('id')
  check(!r.error && r.data.length === 0, 'coach B sees none of coach A\'s athletes', JSON.stringify(r.error ?? r.data.length))
  check(denied(await B.client.from('programs').select('id').eq('id', aProgram.id)), 'coach B cannot read A\'s program by id')
  check(denied(await B.client.from('exercises').select('id').eq('id', aExercise.id)), 'coach B cannot read A\'s exercise')
  check(denied(await B.client.from('program_days').select('id').eq('program_id', aProgram.id)), 'coach B cannot read A\'s program days')

  r = await B.client.from('athletes').insert({ name: 'Bee', surname: 'Athlete' }).select().single()
  check(!r.error && r.data.coach_id === B.coachId, 'coach B creates an athlete → owned by B (coach_id filled in)', r.error?.message)
  const bAthlete = r.data?.id

  check(denied(await B.client.from('athletes').insert({ name: 'x', surname: 'y', coach_id: coachA.id }).select()),
    'coach B cannot create an athlete for coach A')
  check(denied(await B.client.from('athletes').update({ notes: 'hacked' }).eq('id', aAthlete.id).select()), 'coach B cannot update A\'s athlete')
  check(denied(await B.client.from('athletes').update({ coach_id: coachA.id }).eq('id', bAthlete).select()), 'coach B cannot hand an athlete to coach A')
  check(denied(await B.client.from('athletes').delete().eq('id', aAthlete.id).select()), 'coach B cannot delete A\'s athlete')
  check((await B.client.rpc('delete_athlete', { p_athlete_id: aAthlete.id })).error, 'coach B cannot delete_athlete(A\'s athlete)')

  r = await B.client.from('programs').insert({ athlete_id: bAthlete, title: 'B program' }).select().single()
  check(!r.error && r.data.coach_id === B.coachId, 'coach B creates a program for own athlete', r.error?.message)
  const bProgram = r.data?.id
  check(denied(await B.client.from('programs').insert({ athlete_id: aAthlete.id, title: 'sneaky' }).select()), 'coach B cannot create a program for A\'s athlete')
  check(denied(await B.client.from('program_days').insert({ program_id: aProgram.id, name: 'x', order_index: 9 }).select()), 'coach B cannot add a day to A\'s program')
  check(denied(await B.client.from('blocks').insert({ day_id: aDay.id, name: 'x', order_index: 9 }).select()), 'coach B cannot add a block to A\'s program')

  r = await B.client.from('exercises').insert({ name: aExercise.name }).select().single()
  check(!r.error && r.data.coach_id === B.coachId, 'coach B creates an exercise with the same name as one of A\'s', r.error?.message)
  const bExercise = r.data?.id

  const day   = (await B.client.from('program_days').insert({ program_id: bProgram, name: 'Day 1', order_index: 0 }).select().single()).data
  const block = (await B.client.from('blocks').insert({ day_id: day?.id, name: 'Main', order_index: 0 }).select().single()).data
  r = await B.client.from('block_exercises').insert({ block_id: block?.id, exercise_id: bExercise, order_index: 0 }).select()
  check(!r.error, 'coach B builds a full program (day → block → own exercise)', r.error?.message)
  check((await B.client.from('block_exercises').insert({ block_id: block?.id, exercise_id: aExercise.id, order_index: 1 })).error,
    'coach B cannot use A\'s exercise in own program')

  check((await B.client.from('coaches').select('id')).data?.length === 1, 'coach B sees only own coaches row')
  check((await B.client.from('admins').select('id')).data?.length === 0, 'coach B sees no admins rows')
  check((await B.client.from('coaches').update({ active: false }).eq('id', C.coachId)).error, 'coach B cannot write coaches')

  // ─── Storage: athlete photos ─────────────────────────────────────────────
  const img = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })
  const own = `${B.coachId}/rls-${stamp}.png`
  r = await B.client.storage.from('AtheletesImages').upload(own, img, { contentType: 'image/png' })
  check(!r.error, 'coach B uploads a photo into own folder', r.error?.message)
  if (!r.error) created.files.push(own)
  r = await B.client.storage.from('AtheletesImages').upload(`${coachA.id}/rls-${stamp}.png`, img, { contentType: 'image/png' })
  check(r.error, 'coach B cannot upload into A\'s folder')
  if (!r.error) created.files.push(`${coachA.id}/rls-${stamp}.png`)
  r = await B.client.storage.from('AtheletesImages').upload(`rls-root-${stamp}.png`, img, { contentType: 'image/png' })
  check(r.error, 'coach B cannot upload outside a coach folder')
  if (!r.error) created.files.push(`rls-root-${stamp}.png`)

  // ─── Coach C sees nothing of B ───────────────────────────────────────────
  check((await C.client.from('athletes').select('id')).data?.length === 0, 'coach C sees none of B\'s (or A\'s) athletes')
  check(denied(await C.client.from('programs').select('id').eq('id', bProgram)), 'coach C cannot read B\'s program')

  // ─── Admin: everything ───────────────────────────────────────────────────
  r = await admin.client.from('athletes').select('id, coach_id')
  const coachesSeen = new Set((r.data ?? []).map(a => a.coach_id))
  check(!r.error && coachesSeen.has(coachA.id) && coachesSeen.has(B.coachId), 'admin sees athletes of every coach')
  r = await admin.client.from('athletes').update({ notes: 'admin edit' }).eq('id', bAthlete).select()
  check(!r.error && r.data.length === 1, 'admin edits another coach\'s athlete')
  check((await admin.client.from('athletes').insert({ name: 'No', surname: 'Coach' })).error, 'admin must choose a coach (coach_id required)')
  r = await admin.client.from('athletes').insert({ name: 'Admin', surname: 'Made', coach_id: C.coachId }).select().single()
  check(!r.error && r.data.coach_id === C.coachId, 'admin creates an athlete for coach C', r.error?.message)
  check((await admin.client.from('admins').select('user_id')).data?.length === 1, 'admin reads only own admins row')
  check((await admin.client.rpc('delete_athlete', { p_athlete_id: bAthlete })).error === null, 'admin deletes coach B\'s athlete')
  check(denied(await service.from('programs').select('id').eq('id', bProgram)), '… and its program is gone')

  // ─── Deactivated coach: existing session loses access ────────────────────
  await service.from('athletes').insert({ name: 'Still', surname: 'There', coach_id: C.coachId })
  await service.from('coaches').update({ active: false }).eq('id', C.coachId)
  check((await C.client.from('athletes').select('id')).data?.length === 0, 'deactivated coach C (still-valid token) sees no data')
} catch (err) {
  check(false, 'unexpected error', err.message ?? String(err))
} finally {
  // ─── Cleanup ─────────────────────────────────────────────────────────────
  if (created.files.length) await service.storage.from('AtheletesImages').remove(created.files)
  const { data: cs } = await service.from('coaches').select('id').in('user_id', created.users)
  const coachIds = (cs ?? []).map(c => c.id)
  if (coachIds.length) {
    await service.from('programs').delete().in('coach_id', coachIds)
    await service.from('athletes').delete().in('coach_id', coachIds)
    await service.from('exercises').delete().in('coach_id', coachIds)
    await service.from('coaches').delete().in('id', coachIds)
  }
  await service.from('admins').delete().in('user_id', created.users)
  for (const id of created.users) await service.auth.admin.deleteUser(id)
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.extra && !r.ok ? ` — ${r.extra}` : ''}`)
const passed = results.filter(r => r.ok).length
console.log(`${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
