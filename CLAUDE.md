# CLAUDE.md

Training-program app for coaches: coaches build programs (days → blocks → exercises with sets/reps/kg/rest,
exercise videos) for their athletes; athletes open a public share link to view their program, mostly on phones.
Roles: **admin** (row in `admins`) sees and edits everything and manages coach logins on `/admin/coaches`;
**coach** (active row in `coaches`, username login) sees only rows with their `coach_id` — enforced by RLS
(`can_manage()` etc., migration B). Anon has no table access; share links go through `get_shared_program()`.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4 + plain CSS files
- Supabase: Postgres + Auth (email/password), accessed from the browser with the anon key (`lib/supabaseClient.ts`)
- Cloudflare R2: exercise videos, public bucket served from `CLOUDFLARE_R2_PUBLIC_URL` (currently an `r2.dev` URL)
- Deployed on Vercel. Git: feature branches merged into `master`; GitHub remote `origin`

## Layout

- `app/program/[token]` — public athlete view (by `public_token`, falls back to program id)
- `app/admin/*` — athletes, programs (new/edit), exercise library, analytics. Pages guard with
  `supabase.auth.getSession()` client-side; `app/login` signs in
- `app/api/upload-video`, `app/api/delete-video` — R2 routes for coaches + admins (see Videos)
- `app/api/coaches`, `app/api/coaches/[id]` — admin-only coach accounts (create, rename, reset password,
  deactivate); `app/api/me/password` — change own password. Logic in `lib/server/coaches.ts`
- `lib/services/*` — all Supabase queries; `lib/viewModels/*` — map DB rows to UI shapes; `lib/hooks/*` — page state
- `lib/server/*` — server-only code (R2 SigV4 signing, `auth.ts` role guards, `supabaseAdmin.ts` service-role
  client). Never import from client components
- `lib/logins.ts` — username logins: a username is the auth email `<username>@login.invalid`; admins use real emails
- `supabase/migrations` — SQL applied with psql (no Docker); `supabase/seed.sql` fake dev data;
  `supabase/tests` SQL tests; `scripts/test-coach-api.mjs` API tests against `npm run dev` + dev project
- `components/*` — shared UI (`modal.tsx` accessible dialog, `programView.tsx`, `programEditor.tsx`, `exercisePicker.tsx`)
- `model/*` — DB row types. `styles/ui.css` — shared styles; components have sibling `.css` files
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
- Playback: `VideoModal` in `components/programView.tsx`, plain `<video controls playsInline>`.
- Existing files are H.264 `.mov`/`.mp4` with faststart. ~54 exercises still point to deleted Supabase Storage
  files (pre-R2 migration) and 404.
- 2026-09-26: all videos briefly failed to play with DB, bucket and code all healthy — most likely `r2.dev`
  rate limiting/outage. Recovered on its own.

## Open items

Personal checklist lives in `TODO.md` (gitignored, local only). Main open items:
- Multi-coach is live (2026-09-30, coach `glabro`). Next big item: athlete logins + PWA (plan in `TODO.md`)
- Supabase: disable public sign-up (if not done yet)
- Fix the legacy Supabase video links; move R2 to a custom domain (then update `keyFromPublicUrl` to accept the old host)
- Video modal: show an error on load failure, `preload="metadata"`
- Optionally re-compress existing R2 videos
