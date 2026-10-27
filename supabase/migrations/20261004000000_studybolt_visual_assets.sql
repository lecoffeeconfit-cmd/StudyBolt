-- Private visual assets extracted from a user's own PowerPoint. Existing visual
-- metadata remains valid because image_path is nullable.

alter table public.studybolt_visuals
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studybolt-visuals',
  'studybolt-visuals',
  false,
  5000000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "StudyBolt visual owners can read" on storage.objects;
create policy "StudyBolt visual owners can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'studybolt-visuals'
  and (storage.foldername(name))[1] = auth.uid()::text
);

