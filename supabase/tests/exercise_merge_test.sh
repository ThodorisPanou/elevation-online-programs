#!/usr/bin/env bash
# Tests the duplicate-exercise merge (section 1 of migration A) on crafted data in the DEV database.
# Everything runs in one transaction that is rolled back.
# Usage (from the repo root): bash supabase/tests/exercise_merge_test.sh
set -euo pipefail

set -a; . ./.env.db; set +a
PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe"
MIGRATION=supabase/migrations/20260928130000_coaches_a.sql

# Section 1 = from its header up to the section 2 header
MERGE_SQL=$(sed -n '/^-- ─── 1\. Merge duplicate exercise names/,/^-- ─── 2\. Coaches/p' "$MIGRATION" | sed '$d')

R2='https://pub-test.r2.dev'
LEGACY='https://hwfgafrckpdysmexaxdm.supabase.co/storage/v1/object/public/exercise-videos'

"$PSQL" "$DEV_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 <<SQL 2>&1 | grep -v '^$'
begin;

-- The unique index from migration A would block the duplicates we're about to create
drop index if exists exercises_coach_name_key;
set local client_min_messages = notice;

-- A block to hang block_exercises on
insert into program_days (id, program_id, name, order_index) values ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'T', 99);
insert into blocks (id, day_id, name, order_index) values ('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'T', 0);

insert into exercises (id, name, description, video_url, created_at) values
  -- A: old without video, new with R2 video → keep new
  ('f1000000-0000-0000-0000-00000000000a', 'Merge A',  null,      null,                   '2026-01-01'),
  ('f1000000-0000-0000-0000-00000000000b', 'merge a ', null,      '$R2/a.mp4',            '2026-06-01'),
  -- B: old legacy (dead) link, new R2 → keep R2
  ('f2000000-0000-0000-0000-00000000000a', 'Merge B',  null,      '$LEGACY/b.mov',        '2026-01-01'),
  ('f2000000-0000-0000-0000-00000000000b', 'MERGE B',  null,      '$R2/b.mp4',            '2026-06-01'),
  -- C: old legacy, new without → keep legacy (better than nothing)
  ('f3000000-0000-0000-0000-00000000000a', 'Merge C',  null,      '$LEGACY/c.mov',        '2026-01-01'),
  ('f3000000-0000-0000-0000-00000000000b', 'merge c',  null,      null,                   '2026-06-01'),
  -- D: empty-string video = no video → oldest kept, description copied from the other
  ('f4000000-0000-0000-0000-00000000000a', 'Merge D',  '',        '  ',                   '2026-01-01'),
  ('f4000000-0000-0000-0000-00000000000b', 'merge d',  'desc D',  null,                   '2026-06-01'),
  -- E: two working videos → oldest kept, the other URL reported
  ('f5000000-0000-0000-0000-00000000000a', 'Merge E',  'keep me', '$R2/e-old.mp4',        '2026-01-01'),
  ('f5000000-0000-0000-0000-00000000000b', 'merge e',  'other',   '$R2/e-new.mp4',        '2026-06-01'),
  -- F: three copies (none / legacy / R2), all used in programs → all uses point at the R2 one
  ('f6000000-0000-0000-0000-00000000000a', 'Merge F',  null,      null,                   '2026-01-01'),
  ('f6000000-0000-0000-0000-00000000000b', 'merge f',  null,      '$LEGACY/f.mov',        '2026-02-01'),
  ('f6000000-0000-0000-0000-00000000000c', 'MERGE F',  null,      '$R2/f.mp4',            '2026-06-01');

insert into block_exercises (block_id, exercise_id, order_index) values
  ('b1000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-00000000000a', 0),
  ('b1000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-00000000000b', 1),
  ('b1000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-00000000000c', 2),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-00000000000a', 3);

-- ─── Run the merge exactly as in the migration ───
$MERGE_SQL

-- ─── Checks ───
create temp table results (ok boolean, name text);
insert into results
select exists (select 1 from exercises where id = 'f1000000-0000-0000-0000-00000000000b')
   and not exists (select 1 from exercises where id = 'f1000000-0000-0000-0000-00000000000a'),
       'A: newer copy WITH video kept over older without'
union all
select exists (select 1 from exercises where id = 'f2000000-0000-0000-0000-00000000000b')
   and not exists (select 1 from exercises where id = 'f2000000-0000-0000-0000-00000000000a'),
       'B: working R2 video kept over dead legacy link'
union all
select exists (select 1 from exercises where id = 'f3000000-0000-0000-0000-00000000000a' and video_url like '%supabase.co%'),
       'C: legacy link kept over no video'
union all
select exists (select 1 from exercises where id = 'f4000000-0000-0000-0000-00000000000a' and description = 'desc D'),
       'D: blank video counts as none; oldest kept; missing description copied'
union all
select exists (select 1 from exercises where id = 'f5000000-0000-0000-0000-00000000000a' and video_url like '%e-old.mp4' and description = 'keep me'),
       'E: two videos → oldest kept, its own description untouched'
union all
select (select count(*) = 1 from exercises where lower(trim(name)) = 'merge f')
   and exists (select 1 from exercises where id = 'f6000000-0000-0000-0000-00000000000c'),
       'F: 3 copies → only the R2 one left'
union all
select (select count(*) = 3 from block_exercises
        where block_id = 'b1000000-0000-0000-0000-000000000001' and exercise_id = 'f6000000-0000-0000-0000-00000000000c'),
       'F: all 3 program uses point at the kept copy'
union all
select (select exercise_id = 'f1000000-0000-0000-0000-00000000000b' from block_exercises
        where block_id = 'b1000000-0000-0000-0000-000000000001' and order_index = 3),
       'A: program use moved to the kept copy'
union all
select (select count(*) = 0 from (select lower(trim(name)) from exercises group by 1 having count(*) > 1) d),
       'no duplicate names left';

select case when ok then 'PASS ' else 'FAIL ' end || name from results;
select count(*) filter (where ok) || '/' || count(*) || ' passed' from results;

rollback;
SQL
