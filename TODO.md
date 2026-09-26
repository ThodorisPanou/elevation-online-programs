# TODO

## Videos

- [ ] **Fix 54 exercises with dead video links.** They still point to old Supabase storage
      (`hwfgafrckpdysmexaxdm.supabase.co/storage/v1/object/public/exercise-videos/...`) and return 404.
      Check whether the same files exist in R2 → update `exercises.video_url`; otherwise re-upload.
- [ ] **Move R2 off `r2.dev` to a custom domain** (e.g. `videos.<yourdomain>`). `r2.dev` is rate-limited,
      not cached, and not meant for production — likely cause of the 2026-09-26 "no video plays" outage.
      Steps: connect domain in R2 settings → update `CLOUDFLARE_R2_PUBLIC_URL` (local + Vercel) →
      rewrite existing `video_url` rows to the new host.
- [ ] **Make `delete-video` work across hosts.** `keyFromPublicUrl` in `lib/server/r2.ts` only accepts URLs on
      the current `CLOUDFLARE_R2_PUBLIC_URL` host. When moving to a custom domain, also accept the old `r2.dev` host.
- [ ] **Show an error in the video modal** when a video fails to load (`<video onError>`), instead of a
      silent black box — makes outages like the one above obvious to athletes and to you.
- [ ] Add `preload="metadata"` to the player so opening the modal doesn't start pulling the whole file.

## Security

- [ ] **Set `ADMIN_EMAILS`** (comma-separated) in `.env.local` and in Vercel env vars. Until then the video
      API routes refuse every request.
- [ ] **Disable public sign-up in Supabase** (Authentication → Sign In / Providers → "Allow new users to sign up").
      It's currently enabled: anyone can create an account with the public anon key.
- [ ] **Review RLS policies.** If writes are allowed for any `authenticated` user, open sign-up means anyone can
      edit programs/exercises. Restrict writes to admin accounts.
- [x] Require an admin on `/api/upload-video` and `/api/delete-video` (`lib/server/requireAdmin.ts`).
- [x] Restrict `upload-video` to video content types and max 300 MB (type + size are signed into the URL).

## Suggested improvements

- [x] Compress uploads in the browser to 720p H.264 MP4 + faststart (`lib/videoCompression.ts`, ffmpeg.wasm).
- [x] Broken-link checker: `npm run check-videos`.
- [ ] Re-compress the existing ~173 R2 videos (only new uploads are compressed).
