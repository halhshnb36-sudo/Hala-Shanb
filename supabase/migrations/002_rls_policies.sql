-- 002_rls_policies.sql — Row Level Security
-- Public (anon) visitors: read published content + site settings only.
-- Administrators (rows in public.profiles): full control.
-- content_views: no direct writes from the browser at all (writes go through track_view()).

alter table public.profiles      enable row level security;
alter table public.site_settings enable row level security;
alter table public.articles      enable row level security;
alter table public.media         enable row level security;
alter table public.content_views enable row level security;

-- profiles: a signed-in user may read ONLY their own row (used by the admin guard). No client writes.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;

-- site_settings
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists settings_admin_insert on public.site_settings;
create policy settings_admin_insert on public.site_settings
  for insert to authenticated with check (public.is_admin());
drop policy if exists settings_admin_update on public.site_settings;
create policy settings_admin_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke delete on public.site_settings from anon, authenticated;

-- articles
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles
  for select to anon, authenticated
  using (status = 'published' and published_at <= now());
drop policy if exists articles_admin_all on public.articles;
create policy articles_admin_all on public.articles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.articles from anon;

-- media
drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media
  for select to anon, authenticated using (is_published);
drop policy if exists media_admin_all on public.media;
create policy media_admin_all on public.media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.media from anon;

-- content_views: admins may read; nobody may write directly.
drop policy if exists views_admin_read on public.content_views;
create policy views_admin_read on public.content_views
  for select to authenticated using (public.is_admin());
revoke all on public.content_views from anon, authenticated;
grant select on public.content_views to authenticated;
