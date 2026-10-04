# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Athletes** (primary audience of the shared program page): mainly pro and semi-pro footballers (adult club
  players doing individual strength & conditioning work with the coach; confirmed 2026-09-30). They open a public share link on their phone, mostly
  mid-session in the gym — phone in hand between sets, glancing at the next exercise, its numbers, and its video.
- **Coaches** (username login) and the **admin**: build programs for their athletes and manage the exercise
  library, athletes, and coach accounts in the `/admin` area, mostly on desktop.

## Product Purpose

Glabro Online Programs (Glabro — Elevation Performance) lets a coach write a structured training program for an
athlete and hand it over as a single link. Success: the athlete always knows what to do next in the session
without messaging the coach, and can see how an exercise is performed from the coach's own video.

## Positioning

Programs are written by the athlete's own coach, for that athlete by name, with the coach's own demonstration
videos for each exercise — not a generic workout library.

## Operating Context

- Program structure: program → days → blocks → exercises. Each exercise row may carry sets, reps (free text,
  e.g. "8-10" or "AMRAP"), kg (free text), rest in seconds, a coach note, and a demonstration video.
- Athletes need no account: the share link (`/program/<token>`) is public and read-only.
- Gym use: one-handed, glance-based reading, variable lighting, possibly poor connectivity; videos stream from R2.
- Coaches also preview the same program view inside the admin area (`/admin/program/<id>`).

## Capabilities and Constraints

- The athlete page is read-only by decision (2026-09-30): no set tracking, timers, or other new interactions.
- Columns with no values across a block are hidden; any exercise field may be empty.
- Some exercise videos are known-broken legacy links (404).
- Undecided: athlete logins + PWA are planned but not built.

## Brand Commitments

Product name "Glabro Online Programs", tagline "Glabro - Elevation Performance". No binding logo, colors, or
typography (confirmed 2026-09-30). Athlete page (user-pinned 2026-09-30): dark theme; flowing, flexible layout (not a rigid ruled/tabular form);
calm typography where exercises are easy to read (no heavy bold on every piece of information); adult, never
childish or cartoonish; NOT football-themed (the footballer audience only sets the tone). Rejected rounds: a
hand-drawn whiteboard (childish) and a matchday team sheet (too structured, too bold, too football).

## Evidence on Hand

Real programs, athletes, and exercise videos in the database. No testimonials, metrics, or marketing assets —
do not fabricate any.

## Product Principles

1. The next thing to do is always obvious at a glance.
2. The athlete's name and the coach's own material make it personal; nothing generic.
3. Read-only and calm: the page never asks the athlete to manage anything.
4. Works one-handed on a phone first; desktop is secondary for athletes.

## Accessibility & Inclusion

Must stay legible in bright or dim gym lighting at arm's length; large tap targets for sweaty hands.
