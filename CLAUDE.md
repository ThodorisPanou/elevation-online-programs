# CLAUDE.md

Training-program app for coaches: coaches build programs (days → blocks → exercises with sets/reps/kg/rest,
exercise videos) for their athletes. Athletes use it on phones (mostly iPhone): they sign in once through a
one-time login link from their coach, install it as a home-screen app (PWA), see all their programs on `/me` and log
their best set (reps × kg) on exercises the coach marks "Track". Public share links (`/program/[token]`) still work,
read-only.
Roles: **admin** (row in `admins`) sees and edits everything and manages coach logins on `/admin/coaches`;
**coach** (active row in `coaches`, username login) sees only rows with their `coach_id` — enforced by RLS
(`can_manage()` etc., migration B); **athlete** (`athletes.user_id`, username login) has NO direct table access —
only the security-definer `get_my_*()`, `log_exercise()` … functions (migrations C, D), because their own
`athletes` row holds the coach's notes. Anon has no table access; share links go through `get_shared_program()`.
Migrations A–E are all live on production (see TODO.md → Reference). The app's name lives in `lib/brand.ts`
("Elevation Performance Online Programs", short "Elevation"); a coach's name shows only as "Coached by …".

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4 + plain CSS files
- Supabase: Postgres + Auth, accessed from the browser with the anon key (`lib/supabaseClient.ts`; the session is
  kept in localStorage + a cookie copy, because iOS only hands cookies to a newly installed home-screen app)
- Cloudflare R2: exercise videos, public bucket served from `CLOUDFLARE_R2_PUBLIC_URL` (currently an `r2.dev` URL)
- Deployed on Vercel. Git: feature branches merged into `master`; GitHub remote `origin`

## Layout

- `app/program/[token]` — share-link view (by `public_token`, falls back to program id). Read-only; the athlete's
  own coach / the admin also sees their records there (`useCoachRecords`)
- `app/l/[token]` — one-time login link → "Sign in" button (never on page load: chat apps' link scanners would use it
  up) → `/me`. In Instagram/Facebook in-app browsers it explains how to open Safari instead
- `app/me/*` — the athlete app: programs + "Your progress" (`/me`), one program with the Log sheet
  (`/me/program/[id]`), optional password (`/me/password`). `app/manifest.ts` + `lib/appIcon.tsx` make it installable
- `app/admin/*` — athletes, programs (new/edit), exercise library, analytics, coaches. `app/admin/layout.tsx` +
  `useMe()` guard every page (no session → `/login`; athlete → `/me`; temp password → `/admin/password`);
  `app/login` signs in (username or admin email; also "sign in with a login link")
- `app/api/upload-video`, `app/api/delete-video` — R2 routes for coaches + admins (see Videos);
  `app/api/video-error` — public, logs failed video loads (no user data) to the Vercel logs
- `app/api/coaches`, `app/api/coaches/[id]` — admin-only coach accounts (create, rename, reset password,
  deactivate); `app/api/me/password` — change own password. Logic in `lib/server/coaches.ts`
- `app/api/athletes/[id]/login`, `.../login-link`, `app/api/athletes/[id]` (DELETE), `app/api/login-link/redeem`,
  `app/api/me` — athlete logins. Logic in `lib/server/athletes.ts`; tests `scripts/test-athlete-api.mjs`
- Exercise records (migration D): `block_exercises.track` (coach's toggle in the editor), `exercise_logs` (athlete
  writes only via `log_exercise` / `update_my_exercise_log` / `delete_my_exercise_log`; coaches read their athletes'
  rows via RLS). UI: `components/exerciseRecords.tsx` (athlete Log sheet, history, progress; read-only line for the
  coach's view), `components/athleteRecords.tsx` (coach's "Records" on the athlete page)
- `lib/services/*` — all Supabase queries; `lib/viewModels/*` — map DB rows to UI shapes; `lib/hooks/*` — page state
- `lib/server/*` — server-only code (R2 SigV4 signing, `auth.ts` role guards, `supabaseAdmin.ts` service-role
  client). Never import from client components
- `lib/logins.ts` — username logins: a username is the auth email `<username>@login.invalid`; admins use real emails
- `supabase/migrations` — SQL applied with psql (no Docker), each with a rollback in `migrations/rollback/`;
  `supabase/seed.sql` fake dev data; `supabase/tests` SQL tests (each applies its migration in a transaction and
  rolls back); `scripts/test-*.mjs` API tests against `npm run dev` + dev project
- `components/*` — shared UI (`modal.tsx` accessible dialog, `programView.tsx`, `programEditor.tsx`, `exercisePicker.tsx`)
- `model/*` — old global row types, not imported anywhere (TODO: delete). `styles/ui.css` — admin styles;
  components have sibling `.css` files. Athlete-facing pages use the dark "log" look (`components/programView.css`
  tokens under `.log`, `app/me/me.css`) — calm type, hierarchy by size/colour, not football-themed
- Style: 2-space, no semicolons, aligned assignments, `// ─── Section ───` dividers, short "why" comments

## Commands

- `npm run dev` / `npm run build` / `npm run lint` (lint has pre-existing `no-explicit-any` errors in `catch (err: any)`)
- `npx tsc --noEmit -p .` — typecheck
- `npm run check-videos` — checks every `exercises.video_url` loads; exits 1 if any are broken

## Env (`.env.local`, gitignored — also set in Vercel)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_PUBLIC_URL`,
`SUPABASE_SERVICE_ROLE_KEY` (server only).
`.env.local` points at the DEV Supabase project (`glabro-dev`) and the DEV R2 bucket `online-videos-dev` (own token,
limited to that bucket); production values live in `.env.prod` / Vercel (bucket `program-videos`), DB URLs for psql
in `.env.db` (`PROD_DB_URL`, `DEV_DB_URL`). Never print these files' values.

## Videos

- Upload flow (`lib/services/exerciseService.ts` → `uploadExerciseVideo`):
  1. compress in the browser with ffmpeg.wasm (`lib/videoCompression.ts`: 720p H.264 MP4, faststart; core loaded
     from jsDelivr on first use; falls back to the original file on failure or no size gain)
  2. `POST /api/upload-video` with the Supabase access token + `exerciseId` → presigned R2 PUT URL for
     `<coach_id>/<uuid>.<ext>` (the exercise's coach; a coach may only upload for own exercises). Content-Type and
     Content-Length are signed, so the browser must PUT exactly that type/size (video types only, max 300 MB)
  3. browser PUTs directly to R2, then saves the public URL to `exercises.video_url`
  4. old video deleted only after the new URL is saved
- `requireCoach` (`lib/server/auth.ts`) verifies the Bearer token and checks roles in the DB: admin = row in
  `admins`, coach = active row in `coaches` that has changed its temporary password.
- Delete (`/api/delete-video`) only accepts `[<coach_id>/]<uuid>.<ext>` keys on the current R2 public host
  (`keyFromPublicUrl`); other URLs are a no-op. The app unlinks `exercises.video_url` first; a file still used by any
  exercise is never deleted. Coach folder → that coach or admin; older folder-less files (unused) → any coach.
- Tests (dev server + dev project + `online-videos-dev` bucket): `scripts/test-videos.mjs`, `scripts/test-rls.mjs`,
  `scripts/test-coach-api.mjs`.
- Playback: `VideoModal` in `components/programView.tsx`, `<video controls playsInline>` with `?v=<VIDEO_CACHE_KEY>`
  (bump it to give every device fresh addresses), an error state with "Try again" (new `?r=` address each time),
  and reports to `/api/video-error` (max 3 per opened video). Search the Vercel logs for `video-error`.
- Existing files are H.264 `.mov`/`.mp4` with faststart. ~54 exercises still point to deleted Supabase Storage
  files (pre-R2 migration) and 404.
- 2026-09-26: all videos briefly failed to play with DB, bucket and code all healthy — most likely `r2.dev`
  rate limiting/outage. Recovered on its own.
- 2026-10-06: some iPhones (Safari + installed app) couldn't play any video while incognito on the same phone could
  — likely a kept failed load. Fixed with the cache key + retry above; the custom domain is still the deeper fix.

## Releasing

Feature branch → dev first (migration on DEV + its SQL test + `scripts/test-*.mjs` + browser walkthroughs) → backup
prod (`pg_dump -n public -Fc` into `backups/`, verify row counts) → drift check → rehearse the migration on prod with
its SQL test (rolled back) → apply the migration (additive, so the live app keeps working) → THEN fast-forward
`master` and push (Vercel deploys `master`; the new app needs the new schema) → live checks.

## Open items

Personal checklist lives in `TODO.md` (gitignored, local only; finished plans in `TODO-archive.md`). Main open items:
- Follow-ups: glabro's first login + ticking "Track"; a real-iPhone test of login link → home-screen app → Log sheet
- To analyze: videos on a custom domain
  (`r2.dev` is rate-limited; then `keyFromPublicUrl` must accept the old host), GDPR basics (privacy page, retention),
  program availability (expiry date)
- ~54 legacy Supabase video links 404 (the player now shows its error state for them)
