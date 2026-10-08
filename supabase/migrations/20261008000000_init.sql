-- Proval schema. Every table has row level security on; anything that needs
-- cross-row rules (friends only, 24h window, blocks) goes through a
-- security-definer function so the client can't skip the checks.

-- ---------- Profiles ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#3A2BF5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Signed-in users can see profiles" on public.profiles
  for select to authenticated using (true);
create policy "You create your own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "You edit your own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Blocks ----------

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create policy "You see who you blocked" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "You unblock people" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------- Friendships ----------

create table public.friendships (
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
-- One row per pair, whoever asked first.
create unique index friendships_pair on public.friendships (least(from_id, to_id), greatest(from_id, to_id));
alter table public.friendships enable row level security;

create policy "You see your own friendships and requests" on public.friendships
  for select to authenticated using (auth.uid() in (from_id, to_id));

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(from_id, to_id) = least(a, b)
      and greatest(from_id, to_id) = greatest(a, b)
  );
$$;

-- Sends a request, or accepts theirs if they already asked you.
create function public.add_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other = me then raise exception 'That''s you'; end if;
  if public.is_blocked(me, other) then raise exception 'You can''t add this person'; end if;

  select * into existing from public.friendships
  where least(from_id, to_id) = least(me, other) and greatest(from_id, to_id) = greatest(me, other);

  if existing is null then
    insert into public.friendships (from_id, to_id) values (me, other);
  elsif existing.status = 'pending' and existing.to_id = me then
    update public.friendships set status = 'accepted', at = now()
    where from_id = existing.from_id and to_id = existing.to_id;
  end if;
end;
$$;

-- Declines, cancels, or unfriends.
create function public.remove_friend(other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships
  where least(from_id, to_id) = least(auth.uid(), other)
    and greatest(from_id, to_id) = greatest(auth.uid(), other);
$$;

create function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or other = auth.uid() then raise exception 'Can''t block that user'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), other) on conflict do nothing;
  perform public.remove_friend(other);
end;
$$;

-- ---------- Photos ----------

-- Keep in sync with AUTO_APPROVE_HOURS in src/types.ts.
create function public.answer_window() returns interval
language sql immutable as $$ select interval '24 hours' $$;

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles on delete cascade,
  caption text not null default '' check (char_length(caption) <= 150),
  -- Storage object path inside the "photos" bucket: <uploader_id>/<file>
  image_path text not null unique,
  created_at timestamptz not null default now()
);
create index photos_uploader on public.photos (uploader_id, created_at desc);
alter table public.photos enable row level security;

create table public.photo_tags (
  photo_id uuid not null references public.photos on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (photo_id, user_id)
);
create index photo_tags_user on public.photo_tags (user_id);
alter table public.photo_tags enable row level security;

create table public.reviews (
  photo_id uuid not null,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approve', 'deny')),
  reaction text check (reaction in ('obsessed', 'last_resort', 'better_one', 'edit_first', 'crop_me', 'delete_it')),
  comment text check (char_length(comment) <= 200),
  at timestamptz not null default now(),
  primary key (photo_id, reviewer_id),
  foreign key (photo_id, reviewer_id) references public.photo_tags on delete cascade
);
alter table public.reviews enable row level security;

create function public.can_see_photo(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photos where id = p and uploader_id = auth.uid())
      or exists (select 1 from public.photo_tags where photo_id = p and user_id = auth.uid());
$$;

create policy "Uploader and tagged friends see the photo" on public.photos
  for select to authenticated using (public.can_see_photo(id));
create policy "Uploader can withdraw a photo" on public.photos
  for delete to authenticated using (uploader_id = auth.uid());

create policy "Anyone who sees the photo sees who's tagged" on public.photo_tags
  for select to authenticated using (public.can_see_photo(photo_id));

-- Answers are between you and the sender.
create policy "Uploader and the reviewer see a review" on public.reviews
  for select to authenticated using (
    reviewer_id = auth.uid()
    or exists (select 1 from public.photos where id = photo_id and uploader_id = auth.uid())
  );

-- Creates the photo and its tags in one go. Only accepted, unblocked friends can be tagged.
create function public.create_photo(caption text, image_path text, tagged uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  pid uuid;
  t uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if split_part(image_path, '/', 1) <> me::text then raise exception 'Bad image path'; end if;
  tagged := array(select distinct x from unnest(tagged) x where x <> me);
  if coalesce(array_length(tagged, 1), 0) = 0 then raise exception 'Tag at least one friend'; end if;
  if array_length(tagged, 1) > 20 then raise exception 'Too many people tagged'; end if;

  foreach t in array tagged loop
    if not public.are_friends(me, t) or public.is_blocked(me, t) then
      raise exception 'You can only tag friends';
    end if;
  end loop;

  insert into public.photos (uploader_id, caption, image_path)
  values (me, left(coalesce(caption, ''), 150), image_path)
  returning id into pid;

  insert into public.photo_tags (photo_id, user_id) select pid, x from unnest(tagged) x;
  return pid;
end;
$$;

-- One answer per person, only inside the window. Silence after that counts as yes.
create function public.review_photo(photo uuid, decision text, reaction text default null, comment text default null)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  created timestamptz;
begin
  if not exists (select 1 from public.photo_tags where photo_id = photo and user_id = auth.uid()) then
    raise exception 'You are not tagged in this photo';
  end if;
  select created_at into created from public.photos where id = photo;
  if now() >= created + public.answer_window() then
    raise exception 'Too late, this one already auto-approved';
  end if;

  insert into public.reviews (photo_id, reviewer_id, decision, reaction, comment)
  values (photo, auth.uid(), decision, reaction, nullif(left(trim(coalesce(comment, '')), 200), ''));
exception when unique_violation then
  raise exception 'You already answered this one';
end;
$$;

-- ---------- Reports ----------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  photo_id uuid references public.photos on delete set null,
  user_id uuid references public.profiles on delete set null,
  reason text not null check (char_length(reason) <= 60),
  details text check (char_length(details) <= 500),
  at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed'))
);
alter table public.reports enable row level security;
-- Reports are write-only from the app; review them in the Supabase dashboard.
create policy "You can file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------- Push tokens ----------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

create policy "You manage your own push tokens" on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Account deletion ----------

-- Removes the auth user; everything else cascades. The app deletes the
-- user's image files from Storage first (Storage files can't be removed from SQL).
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

-- Functions are callable by signed-in users only.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.add_friend(uuid), public.remove_friend(uuid), public.block_user(uuid),
  public.create_photo(text, text, uuid[]), public.review_photo(uuid, text, text, text),
  public.delete_account(),
  -- Used inside RLS policies, which run as the caller.
  public.can_see_photo(uuid)
to authenticated;

-- ---------- Storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "Upload into your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Delete from your own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "See images of photos you can see" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.photos p where p.image_path = name and public.can_see_photo(p.id))
    )
  );
