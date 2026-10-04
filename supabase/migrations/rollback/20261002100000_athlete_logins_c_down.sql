-- Rollback for migration C (athlete logins). Restores the schema to right after migration B.
-- LOSES DATA: athlete usernames, their links to auth users and all login links. The athletes' auth users
-- (`<username>@login.invalid`) stay in auth.users — delete them separately if wanted.
-- Deploy the app WITHOUT athlete logins first: the new app reads the columns dropped here.

-- Athlete app reads
drop function if exists public.get_my_program(uuid);
drop function if exists public.get_my_programs();
drop function if exists public.get_my_athlete();

-- Share links: back to migration A's self-contained version (same output), then drop the shared builder
create or replace function public.get_shared_program(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description,
    'public_token', p.public_token, 'created_at', p.created_at,
    'athletes', (
      select jsonb_build_object('id', a.id, 'name', a.name, 'surname', a.surname, 'avatar_url', a.avatar_url)
      from public.athletes a where a.id = p.athlete_id
    ),
    'program_days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'order_index', d.order_index,
        'blocks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id, 'name', b.name, 'order_index', b.order_index,
            'block_exercises', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', be.id, 'sets', be.sets, 'reps', be.reps, 'kg', be.kg,
                'rest_seconds', be.rest_seconds, 'notes', be.notes, 'order_index', be.order_index,
                'exercises', (
                  select jsonb_build_object('id', e.id, 'name', e.name, 'video_url', e.video_url)
                  from public.exercises e where e.id = be.exercise_id
                )
              ) order by be.order_index)
              from public.block_exercises be where be.block_id = b.id
            ), '[]'::jsonb)
          ) order by b.order_index)
          from public.blocks b where b.day_id = d.id
        ), '[]'::jsonb)
      ) order by d.order_index)
      from public.program_days d where d.program_id = p.id
    ), '[]'::jsonb)
  )
  from public.programs p
  where p.public_token = p_token and p.is_public
$$;
drop function if exists public.program_json(uuid);

drop function if exists public.my_athlete_id();
drop table if exists public.athlete_login_links;

drop trigger if exists athletes_guard_login on public.athletes;
drop function if exists public.athletes_guard_login();
drop trigger if exists athletes_check_username_free on public.athletes;
drop trigger if exists coaches_check_username_free on public.coaches;
drop function if exists public.check_username_free();

alter table public.athletes
  drop column if exists login_disabled,
  drop column if exists username,
  drop column if exists user_id;
