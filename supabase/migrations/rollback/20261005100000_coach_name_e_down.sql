-- Rollback for migration E (coach name in the program JSON): back to migration D's program_json(). No data is lost.
-- Deploy the app without the "Coached by" line first only if it can't cope with a missing coach_name (it can: the
-- line is simply hidden).

create or replace function public.program_json(p_program_id uuid) returns jsonb
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
                'track', be.track,
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
  where p.id = p_program_id
$$;
