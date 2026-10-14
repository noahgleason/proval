-- Story and post requests. A request is what someone wants to share: a story
-- (one photo) or a post (an Instagram-style carousel of up to 20, Instagram's limit). Each photo
-- keeps its own tags and answers, so "no" on one photo just marks that photo.
--
-- Safe to run on a live project: existing photos become one-photo story
-- requests, and create_photo keeps working for older copies of the app.

create table public.photo_requests (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles on delete cascade,
  kind text not null default 'story' check (kind in ('story', 'post')),
  caption text not null default '' check (char_length(caption) <= 500),
  photo_count smallint not null default 1 check (photo_count between 1 and 20),
  created_at timestamptz not null default now()
);
create index photo_requests_uploader on public.photo_requests (uploader_id, created_at desc);
alter table public.photo_requests enable row level security;

alter table public.photos
  add column request_id uuid references public.photo_requests on delete cascade,
  add column position smallint not null default 0 check (position between 0 and 19);

-- Every existing photo becomes its own story request, reusing the photo's id.
insert into public.photo_requests (id, uploader_id, kind, caption, photo_count, created_at)
select id, uploader_id, 'story', caption, 1, created_at from public.photos;
update public.photos set request_id = id;

alter table public.photos alter column request_id set not null;
create index photos_request on public.photos (request_id, position);

-- ---------- Who can see what ----------

-- You see a whole request if you sent it or you're tagged in any of its photos.
create function public.can_see_request(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photo_requests where id = r and uploader_id = auth.uid())
      or exists (
        select 1 from public.photos p join public.photo_tags t on t.photo_id = p.id
        where p.request_id = r and t.user_id = auth.uid()
      );
$$;

-- A photo is visible to anyone who can see its request ("View whole post").
-- Storage and photo_tags policies already go through this function.
create or replace function public.can_see_photo(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photos where id = p and public.can_see_request(request_id));
$$;

create policy "Sender and anyone tagged see the request" on public.photo_requests
  for select to authenticated using (public.can_see_request(id));
create policy "Sender can withdraw a request" on public.photo_requests
  for delete to authenticated using (uploader_id = auth.uid());

-- ---------- Creating requests ----------

-- items: [{ "image_path": "<me>/<file>", "tagged": ["<friend id>", ...] }, ...] in post order.
create function public.create_request(kind text, caption text, items jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  n int := coalesce(jsonb_array_length(items), 0);
  rid uuid;
  pid uuid;
  item jsonb;
  path text;
  tagged uuid[];
  t uuid;
  i int := 0;
  total int := 0;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if kind is null or kind not in ('story', 'post') then raise exception 'Unknown request type'; end if;
  if n = 0 then raise exception 'Add a photo'; end if;
  if kind = 'story' and n <> 1 then raise exception 'A story request has one photo'; end if;
  if n > 20 then raise exception 'A post can have up to 20 photos'; end if;

  insert into public.photo_requests (uploader_id, kind, caption, photo_count)
  values (me, kind, left(coalesce(caption, ''), 500), n)
  returning id into rid;

  for item in select value from jsonb_array_elements(items) loop
    path := item ->> 'image_path';
    if path is null or split_part(path, '/', 1) <> me::text then raise exception 'Bad image path'; end if;

    tagged := array(
      select distinct x::uuid from jsonb_array_elements_text(coalesce(item -> 'tagged', '[]'::jsonb)) x
      where x::uuid <> me
    );
    if coalesce(array_length(tagged, 1), 0) > 20 then raise exception 'Too many people tagged'; end if;
    foreach t in array tagged loop
      if not public.are_friends(me, t) or public.is_blocked(me, t) then
        raise exception 'You can only tag friends';
      end if;
    end loop;

    insert into public.photos (uploader_id, caption, image_path, request_id, position)
    values (me, '', path, rid, i)
    returning id into pid;
    insert into public.photo_tags (photo_id, user_id) select pid, x from unnest(tagged) x;

    total := total + coalesce(array_length(tagged, 1), 0);
    i := i + 1;
  end loop;

  if total = 0 then raise exception 'Tag at least one friend'; end if;
  return rid;
end;
$$;

-- Older copies of the app still call this: it now makes a one-photo story request.
create or replace function public.create_photo(caption text, image_path text, tagged uuid[]) returns uuid
language sql security definer set search_path = '' as $$
  select public.create_request(
    'story',
    caption,
    jsonb_build_array(jsonb_build_object('image_path', image_path, 'tagged', to_jsonb(coalesce(tagged, '{}'::uuid[]))))
  );
$$;

-- New functions are callable by signed-in users only.
revoke execute on function public.create_request(text, text, jsonb), public.can_see_request(uuid) from public, anon;
grant execute on function public.create_request(text, text, jsonb), public.can_see_request(uuid) to authenticated;
