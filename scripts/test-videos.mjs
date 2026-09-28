// scripts/test-videos.mjs
// Video upload/delete rules against a running dev server + the DEV Supabase project + the DEV R2 bucket.
// Creates a temporary admin and two coaches (B, C) with one exercise each, uploads tiny test files,
// checks folders and permissions, then deletes everything it created.
// Usage: npm run dev (other terminal), then: node --env-file=.env.local scripts/test-videos.mjs [baseUrl]

import { createClient } from '@supabase/supabase-js'

const BASE   = process.argv[2] ?? 'http://localhost:3000'
const url    = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const R2_PUB = process.env.CLOUDFLARE_R2_PUBLIC_URL
if (!url.includes('gvilabpujmgkulysdkiw') || process.env.CLOUDFLARE_R2_BUCKET !== 'online-videos-dev') {
  console.error('Refusing: .env.local must point at the glabro-dev project AND the online-videos-dev bucket')
  process.exit(1)
}

const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const check   = (ok, name, extra = '') => results.push({ ok: !!ok, name, extra })
const stamp   = Date.now() % 1000000
const created = { users: [], urls: [] }
const sleep   = ms => new Promise(r => setTimeout(r, ms))

async function makeUser(email, { admin = false, coach = null } = {}) {
  const password = `Pw-${crypto.randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.users.push(data.user.id)
  if (admin) await service.from('admins').insert({ user_id: data.user.id })
  let coachId = null, exerciseId = null
  if (coach) {
    const { data: c } = await service.from('coaches')
      .insert({ user_id: data.user.id, username: coach, name: coach, must_change_password: false }).select().single()
    coachId = c.id
    const { data: e } = await service.from('exercises').insert({ name: `Video test ${coach}`, coach_id: coachId }).select().single()
    exerciseId = e.id
  }
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: s, error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw se
  return { client, token: s.session.access_token, coachId, exerciseId }
}

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

// Presign + PUT a tiny file, like the browser does
async function upload(user, exerciseId) {
  const bytes = new Uint8Array(256).fill(1)
  const r = await api('POST', '/api/upload-video', user.token, { contentType: 'video/mp4', size: bytes.length, exerciseId })
  if (r.status !== 200) return { ...r }
  const put = await fetch(r.json.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: bytes })
  created.urls.push(r.json.publicUrl)
  return { status: r.status, put: put.status, url: r.json.publicUrl, key: r.json.key }
}

const exists = async u => { await sleep(800); return (await fetch(`${u}?t=${Date.now()}`)).status === 200 }
const del    = (user, videoUrl) => api('DELETE', '/api/delete-video', user.token, { videoId: videoUrl })

try {
  const admin = await makeUser(`vid-admin-${stamp}@example.com`, { admin: true })
  const B     = await makeUser(`vid.b${stamp}@login.invalid`, { coach: `vid.b${stamp}` })
  const C     = await makeUser(`vid.c${stamp}@login.invalid`, { coach: `vid.c${stamp}` })

  // ─── Upload: folder = the exercise's coach ───────────────────────────────
  const b1 = await upload(B, B.exerciseId)
  check(b1.status === 200 && b1.put === 200 && b1.key?.startsWith(`${B.coachId}/`), 'coach B uploads for own exercise → B\'s folder', JSON.stringify(b1))
  check(await exists(b1.url), 'uploaded file is publicly readable')
  const save = await B.client.from('exercises').update({ video_url: b1.url }).eq('id', B.exerciseId).select()
  check(!save.error && save.data.length === 1, 'coach B saves the URL on the exercise')

  check((await upload(B, C.exerciseId)).status === 403, 'coach B cannot upload for coach C\'s exercise → 403')
  check((await upload(B, '00000000-0000-0000-0000-000000000000')).status === 404, 'unknown exercise → 404')
  check((await api('POST', '/api/upload-video', B.token, { contentType: 'video/mp4', size: 10 })).status === 400, 'missing exerciseId → 400')

  const a1 = await upload(admin, C.exerciseId)
  check(a1.status === 200 && a1.key?.startsWith(`${C.coachId}/`), 'admin uploads for coach C\'s exercise → C\'s folder', JSON.stringify(a1))

  // ─── Delete while in use: never ──────────────────────────────────────────
  let r = await del(C, b1.url)
  check(r.status === 200 && r.json.skipped === 'in-use', 'coach C deleting B\'s in-use video → skipped', JSON.stringify(r))
  r = await del(admin, b1.url)
  check(r.json.skipped === 'in-use', 'even admin cannot delete a video an exercise still uses')
  r = await del(B, b1.url)
  check(r.json.skipped === 'in-use', 'coach B cannot delete own video while it\'s still linked')
  check(await exists(b1.url), '… file still there')

  // ─── Replace (the app's flow: upload new, save, delete old) ──────────────
  const b2 = await upload(B, B.exerciseId)
  await B.client.from('exercises').update({ video_url: b2.url }).eq('id', B.exerciseId)
  r = await del(C, b1.url)
  check(r.status === 403, 'coach C cannot delete B\'s unlinked old video → 403', JSON.stringify(r))
  check(await exists(b1.url), '… file still there')
  r = await del(B, b1.url)
  check(r.status === 200 && !r.json.skipped, 'coach B deletes own old video after replacing it', JSON.stringify(r))
  check(!(await exists(b1.url)), '… file gone from R2')
  check(await exists(b2.url), 'new video still there')

  // ─── Remove (the app's flow: unlink, then delete) ────────────────────────
  await B.client.from('exercises').update({ video_url: null }).eq('id', B.exerciseId)
  r = await del(admin, b2.url)
  check(r.status === 200 && !r.json.skipped, 'admin deletes coach B\'s unlinked video')
  check(!(await exists(b2.url)), '… file gone from R2')

  r = await del(admin, a1.url)
  check(r.status === 200 && !r.json.skipped, 'admin deletes the unlinked file in C\'s folder')

  // ─── Older files without a folder / foreign URLs ─────────────────────────
  const legacy = `${R2_PUB}/${crypto.randomUUID()}.mp4`
  await service.from('exercises').update({ video_url: legacy }).eq('id', C.exerciseId)
  r = await del(B, legacy)
  check(r.json.skipped === 'in-use', 'older folder-less video still used by an exercise → skipped')
  await service.from('exercises').update({ video_url: null }).eq('id', C.exerciseId)
  r = await del(B, legacy)
  check(r.status === 200 && !r.json.skipped, 'unused older folder-less file → any coach may clean it up')

  r = await del(B, 'https://hwfgafrckpdysmexaxdm.supabase.co/storage/v1/object/public/exercise-videos/x.mov')
  check(r.json.skipped === 'not-r2', 'legacy Supabase link → nothing to delete in R2')
  r = await del(B, `https://other-host.example.com/${crypto.randomUUID()}.mp4`)
  check(r.json.skipped === 'not-r2', 'same-looking key on another host → not ours, nothing deleted')
  r = await del(B, `${R2_PUB}/${crypto.randomUUID()}.mp4.exe`)
  check(r.json.skipped === 'not-r2', 'key that is not <uuid>.<video ext> → not ours')

  // ─── Must be signed in ───────────────────────────────────────────────────
  const noAuth = await fetch(`${BASE}/api/delete-video`, { method: 'DELETE', body: JSON.stringify({ videoId: legacy }) })
  check(noAuth.status === 401, 'no token → 401')
} catch (err) {
  check(false, 'unexpected error', err.message ?? String(err))
} finally {
  // ─── Cleanup ─────────────────────────────────────────────────────────────
  const { data: cs } = await service.from('coaches').select('id').in('user_id', created.users)
  const coachIds = (cs ?? []).map(c => c.id)
  if (coachIds.length) {
    await service.from('exercises').delete().in('coach_id', coachIds)
    await service.from('coaches').delete().in('id', coachIds)
  }
  await service.from('admins').delete().in('user_id', created.users)
  for (const id of created.users) await service.auth.admin.deleteUser(id)
  const left = []
  for (const u of created.urls) if ((await fetch(`${u}?t=${Date.now()}`)).status === 200) left.push(u)
  if (left.length) console.log('NOTE: test files still in the dev bucket:', left)
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.extra && !r.ok ? ` — ${r.extra}` : ''}`)
const passed = results.filter(r => r.ok).length
console.log(`${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
