-- Fake data for the glabro-dev project. No real people. Safe to commit.
-- Run on DEV only: psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/seed.sql
-- Expects the admin auth user (created in the dashboard) to exist; re-running wipes and re-seeds.

-- ─── Wipe ─────────────────────────────────────────────────────────────────

delete from athletes;            -- cascades to programs → days → blocks → block_exercises
delete from exercises;
delete from admins;

-- ─── Admin ────────────────────────────────────────────────────────────────

insert into admins (user_id)
select id from auth.users where email = 'panoutheo37@gmail.com';

-- ─── Exercises ────────────────────────────────────────────────────────────
-- 'Hip Thrust' / 'hip thrust' is a deliberate duplicate (production has 5 such pairs) to test the merge
-- in migration A. No video URLs: the R2 bucket in .env.local is still production's.

insert into exercises (id, name, description) values
  ('e0000000-0000-0000-0000-000000000001', 'Back Squat',          'Barbell on upper back, squat to depth'),
  ('e0000000-0000-0000-0000-000000000002', 'Romanian Deadlift',   null),
  ('e0000000-0000-0000-0000-000000000003', 'Hip Thrust',          'Shoulders on bench, drive hips up'),
  ('e0000000-0000-0000-0000-000000000004', 'hip thrust',          null),
  ('e0000000-0000-0000-0000-000000000005', 'Bench Press',         null),
  ('e0000000-0000-0000-0000-000000000006', 'Pull Up',             null),
  ('e0000000-0000-0000-0000-000000000007', 'Copenhagen Plank',    null),
  ('e0000000-0000-0000-0000-000000000008', 'Box Jump',            null),
  ('e0000000-0000-0000-0000-000000000009', 'Split Squat',         null),
  ('e0000000-0000-0000-0000-00000000000a', 'Plank',               null);

-- ─── Athletes ─────────────────────────────────────────────────────────────

insert into athletes (id, name, surname, notes) values
  ('a0000000-0000-0000-0000-000000000001', 'Test',  'Runner',   'Fake athlete — sprinter'),
  ('a0000000-0000-0000-0000-000000000002', 'Demo',  'Lifter',   'Fake athlete — strength focus'),
  ('a0000000-0000-0000-0000-000000000003', 'Sample','Jumper',   null),
  ('a0000000-0000-0000-0000-000000000004', 'Fake',  'Swimmer',  'Fake athlete — no programs yet');

-- ─── Programs → days → blocks → exercises ─────────────────────────────────

insert into programs (id, athlete_id, title, description, public_token) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Pre-season Week 1', 'Strength + power', 'devtoken0001'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Pre-season Week 2', null,               'devtoken0002'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Hypertrophy Block', null,               'devtoken0003'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'Jump Program',      'Plyometrics',      'devtoken0004');

-- Every program: 2 days × 2 blocks × 3 exercises, picked round-robin from the library.
-- Program 1 ends up using both 'Hip Thrust' copies (library slots 3 and 4).
do $$
declare
  p        record;
  v_day    uuid;
  v_block  uuid;
  v_ex     uuid[];
  i        int := 0;
begin
  select array_agg(id order by id) into v_ex from exercises;

  for p in select id from programs order by id loop
    for d in 1..2 loop
      insert into program_days (program_id, name, order_index)
      values (p.id, 'Day ' || d, d - 1)
      returning id into v_day;

      for b in 1..2 loop
        insert into blocks (day_id, name, order_index)
        values (v_day, case b when 1 then 'Warm-up' else 'Main' end, b - 1)
        returning id into v_block;

        for e in 1..3 loop
          insert into block_exercises (block_id, exercise_id, sets, reps, kg, rest_seconds, order_index)
          values (v_block, v_ex[(i % array_length(v_ex, 1)) + 1], 3, '8-10', case when b = 2 then '40' end, 90, e - 1);
          i := i + 1;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;
