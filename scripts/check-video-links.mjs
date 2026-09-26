// scripts/check-video-links.mjs
// Checks every exercises.video_url and reports the ones that don't load.
// Usage: npm run check-videos            (exits 1 if any link is broken)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CONCURRENCY  = 8
const TIMEOUT_MS   = 20_000

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (run via `npm run check-videos`)')
  process.exit(2)
}

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/exercises?select=id,name,video_url&video_url=not.is.null&order=name`,
  { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
)
if (!res.ok) {
  console.error('Failed to load exercises:', res.status, await res.text())
  process.exit(2)
}
const exercises = await res.json()

// A 1-byte range GET — the same kind of request a <video> element makes, without downloading the file
async function check(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    await r.body?.cancel()
    const type = r.headers.get('content-type') ?? ''
    if (!r.ok)                      return `HTTP ${r.status}`
    if (!type.startsWith('video/')) return `not a video (${type || 'no content-type'})`
    return null
  } catch (err) {
    return err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? err.message)
  }
}

const broken = []
let next = 0, done = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < exercises.length) {
    const ex = exercises[next++]
    const problem = await check(ex.video_url)
    if (problem) broken.push({ ...ex, problem })
    process.stdout.write(`\rChecked ${++done}/${exercises.length}`)
  }
}))
process.stdout.write('\n')

if (broken.length === 0) {
  console.log(`All ${exercises.length} video links OK.`)
  process.exit(0)
}

broken.sort((a, b) => a.name.localeCompare(b.name))
console.log(`\n${broken.length} of ${exercises.length} video links are broken:\n`)
for (const b of broken) {
  console.log(`  ${b.name}  [${b.problem}]\n    exercise ${b.id}\n    ${b.video_url}`)
}
const byHost = {}
for (const b of broken) { const h = new URL(b.video_url).host; byHost[h] = (byHost[h] ?? 0) + 1 }
console.log('\nBy host: ' + Object.entries(byHost).map(([h, n]) => `${h} (${n})`).join(', '))
process.exit(1)
