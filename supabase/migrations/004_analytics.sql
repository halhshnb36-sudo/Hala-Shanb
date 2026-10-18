-- 004_analytics.sql — tracking function (public) and statistics functions (admin only)

-- ---------------------------------------------------------------------------
-- track_view: the ONLY way events get written.
-- Anti-abuse: content must exist and be published, event/content combination must be valid,
-- per-session de-duplication window, per-session hourly cap, and a per-content burst cap.
-- No IP address, user agent or other personal data is stored; session_id is a random value generated
-- by the browser for the current tab session.
-- ---------------------------------------------------------------------------
create or replace function public.track_view(
  p_content_type text,
  p_content_id   uuid,
  p_event_type   text,
  p_session      text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok     boolean := false;
  v_window interval;
begin
  if p_session is null or char_length(p_session) not between 16 and 64 then
    return false;
  end if;

  if (p_content_type, p_event_type) not in (
    ('biography', 'page_view'), ('article', 'page_view'), ('image', 'image_view'), ('video', 'video_play')
  ) then
    return false;
  end if;

  -- the content must exist and be publicly visible
  if p_content_type in ('biography', 'article') then
    select exists (
      select 1 from public.articles a
      where a.id = p_content_id
        and a.kind = p_content_type
        and a.status = 'published'
        and a.published_at <= now()
    ) into v_ok;
  else
    select exists (
      select 1 from public.media m
      where m.id = p_content_id and m.type = p_content_type and m.is_published
    ) into v_ok;
  end if;
  if not v_ok then
    return false;
  end if;

  -- de-duplication: the same session counts once per window for the same content + event
  v_window := case p_event_type
                when 'page_view'  then interval '30 minutes'
                when 'image_view' then interval '10 minutes'
                else interval '5 minutes'
              end;
  if exists (
    select 1 from public.content_views v
    where v.session_id = p_session and v.content_id = p_content_id
      and v.event_type = p_event_type and v.created_at > now() - v_window
  ) then
    return false;
  end if;

  -- per-session hourly cap
  if (select count(*) from public.content_views v
      where v.session_id = p_session and v.created_at > now() - interval '1 hour') >= 120 then
    return false;
  end if;

  -- per-content burst cap (limits floods that rotate session ids)
  if (select count(*) from public.content_views v
      where v.content_id = p_content_id and v.created_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;

  insert into public.content_views (content_type, content_id, event_type, session_id)
  values (p_content_type, p_content_id, p_event_type, p_session);
  return true;
end;
$$;
revoke all on function public.track_view(text, uuid, text, text) from public;
grant execute on function public.track_view(text, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Date range helper. Days are counted in the Africa/Cairo time zone.
-- ---------------------------------------------------------------------------
create or replace function public.range_start(p_range text)
returns timestamptz
language sql
stable
as $$
  select case p_range
    when 'today' then date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'
    when '7d'    then now() - interval '7 days'
    when '30d'   then now() - interval '30 days'
    else '-infinity'::timestamptz
  end;
$$;

-- ---------------------------------------------------------------------------
-- admin_stats: dashboard numbers for a range ('today' | '7d' | '30d' | 'all')
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats(p_range text default '30d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          timestamptz;
  chart_from timestamptz;
  result     jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  s := public.range_start(p_range);
  chart_from := greatest(s, now() - interval '180 days');

  select jsonb_build_object(
    'range', p_range,
    'article_views',   (select count(*) from public.content_views where created_at >= s and content_type = 'article'),
    'biography_views', (select count(*) from public.content_views where created_at >= s and content_type = 'biography'),
    'image_views',     (select count(*) from public.content_views where created_at >= s and content_type = 'image'),
    'video_plays',     (select count(*) from public.content_views where created_at >= s and content_type = 'video'),
    'total_events',    (select count(*) from public.content_views where created_at >= s),
    'published_articles', (select count(*) from public.articles where kind = 'article' and status = 'published'),
    'photos', (select count(*) from public.media where type = 'image'),
    'videos', (select count(*) from public.media where type = 'video'),
    'daily', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb)
      from (
        select to_char(date_trunc('day', created_at at time zone 'Africa/Cairo'), 'YYYY-MM-DD') as day,
               count(*) filter (where event_type = 'page_view')  as page_views,
               count(*) filter (where event_type = 'image_view') as image_views,
               count(*) filter (where event_type = 'video_play') as video_plays
        from public.content_views
        where created_at >= chart_from
        group by 1
      ) d
    ),
    'top_articles', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb)
      from (
        select a.id, a.title, a.kind, count(*) as views
        from public.content_views v
        join public.articles a on a.id = v.content_id
        where v.created_at >= s and v.content_type in ('article', 'biography')
        group by a.id, a.title, a.kind
        order by views desc
        limit 5
      ) t
    ),
    'top_images', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb)
      from (
        select m.id, coalesce(nullif(m.title, ''), 'صورة بدون عنوان') as title, m.storage_path, count(*) as views
        from public.content_views v
        join public.media m on m.id = v.content_id
        where v.created_at >= s and v.content_type = 'image'
        group by m.id, m.title, m.storage_path
        order by views desc
        limit 5
      ) t
    ),
    'top_videos', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb)
      from (
        select m.id, coalesce(nullif(m.title, ''), 'فيديو بدون عنوان') as title, count(*) as views
        from public.content_views v
        join public.media m on m.id = v.content_id
        where v.created_at >= s and v.content_type = 'video'
        group by m.id, m.title
        order by views desc
        limit 5
      ) t
    ),
    'recent', (
      select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
      from (
        select v.created_at, v.content_type, v.event_type,
               coalesce(nullif(a.title, ''), nullif(m.title, ''), 'بدون عنوان') as title
        from public.content_views v
        left join public.articles a on a.id = v.content_id
        left join public.media m on m.id = v.content_id
        where v.created_at >= s
        order by v.created_at desc
        limit 15
      ) r
    )
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_stats(text) from public;
grant execute on function public.admin_stats(text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_view_counts: views per content item (used by the admin lists)
-- ---------------------------------------------------------------------------
create or replace function public.admin_view_counts(p_range text default 'all')
returns table (content_id uuid, views bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select v.content_id, count(*)::bigint
    from public.content_views v
    where v.created_at >= public.range_start(p_range)
    group by v.content_id;
end;
$$;
revoke all on function public.admin_view_counts(text) from public;
grant execute on function public.admin_view_counts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_move_media: move a photo/video one step earlier (-1) or later (+1) in display order.
-- Re-numbers the whole type atomically so duplicate sort_order values cannot cause ambiguity.
-- ---------------------------------------------------------------------------
create or replace function public.admin_move_media(p_id uuid, p_dir integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_ids  uuid[];
  v_idx  integer;
  v_j    integer;
  v_tmp  uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select type into v_type from public.media where id = p_id;
  if v_type is null then
    return;
  end if;

  select array_agg(id order by sort_order, created_at, id) into v_ids
  from public.media where type = v_type;

  v_idx := array_position(v_ids, p_id);
  v_j := v_idx + case when p_dir < 0 then -1 else 1 end;
  if v_j < 1 or v_j > array_length(v_ids, 1) then
    return;
  end if;

  v_tmp := v_ids[v_idx];
  v_ids[v_idx] := v_ids[v_j];
  v_ids[v_j] := v_tmp;

  update public.media m
  set sort_order = x.rn
  from (select t.id, t.rn from unnest(v_ids) with ordinality as t(id, rn)) x
  where m.id = x.id;
end;
$$;
revoke all on function public.admin_move_media(uuid, integer) from public;
grant execute on function public.admin_move_media(uuid, integer) to authenticated;
