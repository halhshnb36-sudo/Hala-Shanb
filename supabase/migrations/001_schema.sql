-- 001_schema.sql — core tables, helper functions and triggers
-- Hala Shanb Hair Care | هالة شنب للعناية بالشعر

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Administrator authorization
-- An account is an administrator ONLY if it has a row here with role = 'admin'.
-- Rows are created manually in the SQL editor (see README: "إنشاء أول مدير").
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Site settings (one JSON document under key = 'site')
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key check (char_length(key) between 1 and 60),
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Articles (the biography is the single row with kind = 'biography')
-- body format: paragraphs separated by a blank line; "## " heading, "### " sub-heading, "> " quote.
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'article' check (kind in ('article', 'biography')),
  slug            text not null unique
                  check (char_length(slug) between 1 and 120 and slug ~ '^[^\s/?#%]+$'),
  title           text not null check (char_length(title) between 1 and 300),
  subtitle        text check (subtitle is null or char_length(subtitle) <= 500),
  body            text not null default '' check (char_length(body) <= 200000),
  cover_path      text,                                  -- bucket: articles
  images          text[] not null default '{}',          -- bucket: articles
  video_url       text check (video_url is null or video_url ~* '^https://'),
  video_path      text,                                  -- bucket: videos (private)
  status          text not null default 'draft' check (status in ('draft', 'published')),
  featured        boolean not null default false,
  published_at    timestamptz,
  seo_title       text check (seo_title is null or char_length(seo_title) <= 120),
  seo_description text check (seo_description is null or char_length(seo_description) <= 300),
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists articles_single_biography on public.articles (kind) where kind = 'biography';
create index if not exists articles_public_idx on public.articles (status, published_at desc);
create index if not exists articles_featured_idx on public.articles (featured) where featured;

create or replace function public.articles_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists articles_before_write_trg on public.articles;
create trigger articles_before_write_trg before insert or update on public.articles
  for each row execute function public.articles_before_write();
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch before update on public.articles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Media (photographs and videos)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('image', 'video')),
  title        text check (title is null or char_length(title) <= 200),
  description  text check (description is null or char_length(description) <= 2000),
  storage_path text,                                      -- bucket: gallery (image) / videos (video)
  external_url text check (external_url is null or external_url ~* '^https://'),
  thumb_path   text,                                      -- bucket: gallery (video poster)
  mime_type    text,
  size_bytes   bigint check (size_bytes is null or size_bytes >= 0),
  is_published boolean not null default false,
  featured     boolean not null default false,
  sort_order   integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (storage_path is not null or (external_url is not null and type = 'video'))
);
create index if not exists media_public_idx on public.media (type, is_published, sort_order, created_at desc);

drop trigger if exists media_touch on public.media;
create trigger media_touch before update on public.media
  for each row execute function public.touch_updated_at();

-- Only one featured media item at a time (the homepage "featured" photo/video).
create or replace function public.media_single_featured()
returns trigger
language plpgsql
as $$
begin
  if new.featured then
    update public.media set featured = false where featured and id <> new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists media_single_featured_trg on public.media;
create trigger media_single_featured_trg before insert or update of featured on public.media
  for each row when (new.featured) execute function public.media_single_featured();

-- ---------------------------------------------------------------------------
-- View events (written ONLY through public.track_view(), see 004_analytics.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.content_views (
  id           uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('biography', 'article', 'image', 'video')),
  content_id   uuid not null,
  event_type   text not null check (event_type in ('page_view', 'image_view', 'video_play')),
  session_id   text not null check (char_length(session_id) between 16 and 64),
  created_at   timestamptz not null default now(),
  check (
    (content_type in ('biography', 'article') and event_type = 'page_view')
    or (content_type = 'image' and event_type = 'image_view')
    or (content_type = 'video' and event_type = 'video_play')
  )
);
create index if not exists content_views_created_idx on public.content_views (created_at desc);
create index if not exists content_views_content_idx on public.content_views (content_id, event_type, created_at desc);
create index if not exists content_views_session_idx on public.content_views (session_id, created_at desc);

-- Remove a deleted item's events so statistics never point to missing content.
create or replace function public.cleanup_views()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.content_views where content_id = old.id;
  return old;
end;
$$;
drop trigger if exists articles_cleanup_views on public.articles;
create trigger articles_cleanup_views after delete on public.articles
  for each row execute function public.cleanup_views();
drop trigger if exists media_cleanup_views on public.media;
create trigger media_cleanup_views after delete on public.media
  for each row execute function public.cleanup_views();
