-- Profile photos. Each is a small square JPEG (the app shrinks it to 256px, about 25 KB) in the
-- "avatars" bucket at <user id>/<file>. The bucket is public so photos load fast and stay cached
-- (no signed links that change every hour); file names are random, so they can't be guessed.
--
-- Safe to run on a live project: everyone starts with no photo and keeps their letter.

alter table public.profiles
  add column avatar_path text check (
    avatar_path is null
    or (split_part(avatar_path, '/', 1) = id::text and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Upload your own profile photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Replace your own profile photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Delete your own profile photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Listing (used when deleting your account) is limited to your own folder; viewing goes through public links.
create policy "List your own profile photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
