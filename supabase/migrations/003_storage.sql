-- 003_storage.sql — Storage buckets and access policies
--
-- branding : logo / hero image            PUBLIC read,  admin write
-- articles : article covers + images      PUBLIC read,  admin write
-- gallery  : photographs + video posters  PUBLIC read,  admin write
-- videos   : uploaded video files         PRIVATE; public visitors get short-lived signed URLs,
--            and the policy below only allows that for videos that are published.
--
-- NOTE: Supabase's free plan caps a single upload at 50 MB project-wide. Raise "Upload file size limit"
-- in Dashboard > Storage > Settings (paid plans) to use the 500 MB bucket limit configured below.
-- SVG is intentionally not allowed (it can carry scripts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('branding', 'branding', true,    5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('articles', 'articles', true,   10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('gallery',  'gallery',  true,   15728640, array['image/png', 'image/jpeg', 'image/webp']),
  ('videos',   'videos',   false, 524288000, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hs_admin_insert" on storage.objects;
create policy "hs_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('branding', 'articles', 'gallery', 'videos') and public.is_admin());

drop policy if exists "hs_admin_update" on storage.objects;
create policy "hs_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('branding', 'articles', 'gallery', 'videos') and public.is_admin())
  with check (bucket_id in ('branding', 'articles', 'gallery', 'videos') and public.is_admin());

drop policy if exists "hs_admin_delete" on storage.objects;
create policy "hs_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('branding', 'articles', 'gallery', 'videos') and public.is_admin());

drop policy if exists "hs_admin_select" on storage.objects;
create policy "hs_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id in ('branding', 'articles', 'gallery', 'videos') and public.is_admin());

-- Visitors may obtain a signed URL for a video only if it belongs to PUBLISHED content.
drop policy if exists "hs_public_published_videos" on storage.objects;
create policy "hs_public_published_videos" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'videos'
    and (
      exists (
        select 1 from public.media m
        where m.storage_path = storage.objects.name and m.type = 'video' and m.is_published
      )
      or exists (
        select 1 from public.articles a
        where a.video_path = storage.objects.name and a.status = 'published' and a.published_at <= now()
      )
    )
  );
