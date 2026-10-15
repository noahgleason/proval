-- Group-chat links. A request can tag people who aren't on Proval yet by name ("Jake").
-- The sender drops one link in the group chat; each person opens it, signs in, taps their
-- name, and the placeholder becomes their account: they're tagged for real and answer in
-- the app like anyone else. Until then the link page only shows blurred previews.
--
-- If the wrong person claims a name, the sender can reset it. The real person can tap
-- "That's not me" to flag it, and the sender picks who's right.
--
-- Safe to run on a live project: existing requests get a link, and nothing else changes for them.

-- ---------- Guests ----------

create table public.request_guests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.photo_requests on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  claimed_by uuid references public.profiles on delete set null,
  claimed_at timestamptz,
  -- Someone else who says they're the real one. The sender decides.
  disputed_by uuid references public.profiles on delete set null,
  -- The claim made the sender and the claimer friends, so a reset undoes that too.
  made_friends boolean not null default false
);
create unique index request_guests_name on public.request_guests (request_id, lower(name));
-- One name per person per request.
create unique index request_guests_claimer on public.request_guests (request_id, claimed_by);
alter table public.request_guests enable row level security;

create table public.photo_guests (
  photo_id uuid not null references public.photos on delete cascade,
  guest_id uuid not null references public.request_guests on delete cascade,
  primary key (photo_id, guest_id)
);
create index photo_guests_guest on public.photo_guests (guest_id);
alter table public.photo_guests enable row level security;

create policy "Anyone who sees the request sees its guests" on public.request_guests
  for select to authenticated using (public.can_see_request(request_id));
create policy "Anyone who sees the photo sees who's tagged by name" on public.photo_guests
  for select to authenticated using (public.can_see_photo(photo_id));

-- Tags that came from claiming a name, so a reset removes exactly those (their answers go too).
alter table public.photo_tags add column via_guest uuid references public.request_guests on delete cascade;

-- A tiny (about 24px) preview the link page shows blurred before anyone signs in.
alter table public.photos
  add column blur text check (blur ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' and char_length(blur) <= 6000);

-- ---------- The link ----------

-- 128 random bits; every request gets one, including existing ones.
alter table public.photo_requests
  add column share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  add column share_on boolean not null default true;

-- Tagged friends can read a request, but only the sender gets its link (through share_link()).
revoke select on public.photo_requests from anon, authenticated;
grant select (id, uploader_id, kind, caption, photo_count, created_at) on public.photo_requests to authenticated;

-- ---------- Claiming (internal) ----------

-- Turns a name into a real tag for `who`, and makes them friends with the sender.
create function public.guest_claim_for(g uuid, who uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  guest public.request_guests;
  sender uuid;
  existing public.friendships;
begin
  select * into guest from public.request_guests where id = g for update;
  select uploader_id into sender from public.photo_requests where id = guest.request_id;
  if who = sender then raise exception 'That''s your own request'; end if;
  if not exists (select 1 from public.profiles where id = who) then raise exception 'Finish setting up your account first'; end if;
  if public.is_blocked(sender, who) then raise exception 'You can''t answer this one'; end if;
  if exists (select 1 from public.request_guests where request_id = guest.request_id and claimed_by = who) then
    raise exception 'You already picked a name on this one';
  end if;

  select * into existing from public.friendships
  where least(from_id, to_id) = least(sender, who) and greatest(from_id, to_id) = greatest(sender, who);
  if existing is null then
    insert into public.friendships (from_id, to_id, status) values (sender, who, 'accepted');
  elsif existing.status = 'pending' then
    update public.friendships set status = 'accepted', at = now()
    where from_id = existing.from_id and to_id = existing.to_id;
  end if;

  update public.request_guests
  set claimed_by = who, claimed_at = now(), disputed_by = null, made_friends = (existing is null)
  where id = g;

  insert into public.photo_tags (photo_id, user_id, via_guest)
  select photo_id, who, g from public.photo_guests where guest_id = g
  on conflict do nothing;
end;
$$;

-- Frees a name again: removes the tags (and answers) the claim made, and the friendship if the claim made it.
create function public.guest_unclaim(g uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  guest public.request_guests;
  sender uuid;
begin
  select * into guest from public.request_guests where id = g for update;
  if guest.claimed_by is null then return; end if;
  select uploader_id into sender from public.photo_requests where id = guest.request_id;

  delete from public.photo_tags where via_guest = g;
  if guest.made_friends then
    delete from public.friendships
    where least(from_id, to_id) = least(sender, guest.claimed_by)
      and greatest(from_id, to_id) = greatest(sender, guest.claimed_by);
  end if;
  update public.request_guests set claimed_by = null, claimed_at = null, made_friends = false where id = g;
end;
$$;

-- ---------- The link page ----------

-- What the link page shows. Signed-out visitors get the sender's name, the photo count and
-- blurred previews; names to pick from only appear after signing in.
create function public.share_preview(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  r public.photo_requests;
  sender text;
begin
  select * into r from public.photo_requests where share_token = token;
  if r.id is null then return null; end if;
  select name into sender from public.profiles where id = r.uploader_id;
  if not r.share_on then return jsonb_build_object('off', true, 'sender', sender); end if;

  return jsonb_build_object(
    'off', false,
    'sender', sender,
    'kind', r.kind,
    'photo_count', r.photo_count,
    'closes_at', r.created_at + public.answer_window(),
    'blurs', (select coalesce(jsonb_agg(blur order by position), '[]'::jsonb) from public.photos where request_id = r.id),
    'viewer', case when me is null then null else jsonb_build_object(
      'is_sender', r.uploader_id = me,
      'tagged', exists (
        select 1 from public.photos p join public.photo_tags t on t.photo_id = p.id
        where p.request_id = r.id and t.user_id = me
      ),
      'guest', (select id from public.request_guests where request_id = r.id and claimed_by = me)
    ) end,
    'guests', case when me is null then null else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'claimed', g.claimed_by is not null,
        'flagged_by_me', g.disputed_by is not distinct from me
      ) order by lower(g.name)), '[]'::jsonb)
      from public.request_guests g where g.request_id = r.id
    ) end
  );
end;
$$;

-- Tap your name. Returns the request id.
create function public.claim_guest(token text, guest uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  r public.photo_requests;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into r from public.photo_requests where share_token = token;
  if r.id is null or not r.share_on then raise exception 'This link is turned off'; end if;
  if now() >= r.created_at + public.answer_window() then raise exception 'This link has closed'; end if;
  if not exists (select 1 from public.request_guests where id = guest and request_id = r.id) then
    raise exception 'That name isn''t on this request';
  end if;
  if exists (select 1 from public.request_guests where id = guest and claimed_by is not null) then
    raise exception 'Someone already picked that name';
  end if;
  perform public.guest_claim_for(guest, me);
  return r.id;
end;
$$;

-- "That's not me": flags a name someone else claimed, for the sender to sort out.
create function public.dispute_guest(token text, guest uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  r public.photo_requests;
  g public.request_guests;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into r from public.photo_requests where share_token = token;
  if r.id is null or not r.share_on then raise exception 'This link is turned off'; end if;
  if r.uploader_id = me then raise exception 'That''s your own request'; end if;
  select * into g from public.request_guests where id = guest and request_id = r.id;
  if g.id is null then raise exception 'That name isn''t on this request'; end if;
  if g.claimed_by is null then raise exception 'Nobody has that name yet, so you can just pick it'; end if;
  if g.claimed_by = me then raise exception 'That''s already you'; end if;
  if g.disputed_by is not null and g.disputed_by <> me then raise exception 'Someone already flagged that name'; end if;
  if exists (select 1 from public.request_guests where request_id = r.id and claimed_by = me) then
    raise exception 'You already picked a name on this one';
  end if;
  update public.request_guests set disputed_by = me where id = guest;
end;
$$;

-- ---------- Sender controls ----------

create function public.is_guest_sender(guest uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.request_guests g join public.photo_requests r on r.id = g.request_id
    where g.id = guest and r.uploader_id = auth.uid()
  );
$$;

-- Frees a name so the right person can pick it. Whatever the claimer answered is cleared.
create function public.reset_guest(guest uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_guest_sender(guest) then raise exception 'Only the sender can do that'; end if;
  perform public.guest_unclaim(guest);
  update public.request_guests set disputed_by = null where id = guest;
end;
$$;

-- Settles a "That's not me": keep whoever has the name, or give it to the person who flagged it.
create function public.resolve_guest(guest uuid, switch_to_flagger boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  flagger uuid;
begin
  if not public.is_guest_sender(guest) then raise exception 'Only the sender can do that'; end if;
  select disputed_by into flagger from public.request_guests where id = guest;
  if flagger is null then raise exception 'Nobody flagged that name'; end if;
  if switch_to_flagger then
    perform public.guest_unclaim(guest);
    perform public.guest_claim_for(guest, flagger);
  else
    update public.request_guests set disputed_by = null where id = guest;
  end if;
end;
$$;

create function public.share_link(request uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('token', share_token, 'on', share_on)
  from public.photo_requests where id = request and uploader_id = auth.uid();
$$;

create function public.set_share_on(request uuid, turned_on boolean) returns void
language sql security definer set search_path = '' as $$
  update public.photo_requests set share_on = turned_on where id = request and uploader_id = auth.uid();
$$;

-- ---------- Creating requests, now with names ----------

-- items: [{ "image_path": "<me>/<file>", "tagged": ["<friend id>", ...], "guests": ["Jake", ...],
--           "blur": "data:image/jpeg;base64,..." }, ...] in post order.
-- The same name on several photos is one person.
create or replace function public.create_request(kind text, caption text, items jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  n int := coalesce(jsonb_array_length(items), 0);
  rid uuid;
  pid uuid;
  gid uuid;
  item jsonb;
  path text;
  tagged uuid[];
  names text[];
  nm text;
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
    names := array(
      select distinct on (lower(y)) y from (
        select regexp_replace(trim(x), '\s+', ' ', 'g') y
        from jsonb_array_elements_text(coalesce(item -> 'guests', '[]'::jsonb)) x
      ) s where y <> ''
    );
    if coalesce(array_length(tagged, 1), 0) + coalesce(array_length(names, 1), 0) > 20 then
      raise exception 'Too many people tagged';
    end if;
    foreach t in array tagged loop
      if not public.are_friends(me, t) or public.is_blocked(me, t) then
        raise exception 'You can only tag friends';
      end if;
    end loop;

    insert into public.photos (uploader_id, caption, image_path, request_id, position, blur)
    values (me, '', path, rid, i, item ->> 'blur')
    returning id into pid;
    insert into public.photo_tags (photo_id, user_id) select pid, x from unnest(tagged) x;

    foreach nm in array names loop
      if char_length(nm) > 40 then raise exception 'Names can be up to 40 characters'; end if;
      select id into gid from public.request_guests where request_id = rid and lower(name) = lower(nm);
      if gid is null then
        insert into public.request_guests (request_id, name) values (rid, nm) returning id into gid;
      end if;
      insert into public.photo_guests (photo_id, guest_id) values (pid, gid);
      gid := null;
    end loop;

    total := total + coalesce(array_length(tagged, 1), 0) + coalesce(array_length(names, 1), 0);
    i := i + 1;
  end loop;

  if total = 0 then raise exception 'Tag at least one person'; end if;
  if (select count(*) from public.request_guests where request_id = rid) > 20 then
    raise exception 'Up to 20 people who aren''t on Proval per request';
  end if;
  return rid;
end;
$$;

-- ---------- Who can call what ----------

-- Internal: only reachable through the functions above.
revoke execute on function public.guest_claim_for(uuid, uuid), public.guest_unclaim(uuid)
  from public, anon, authenticated;

-- The link page works signed out.
revoke execute on function public.share_preview(text) from public;
grant execute on function public.share_preview(text) to anon, authenticated;

revoke execute on function
  public.claim_guest(text, uuid), public.dispute_guest(text, uuid), public.is_guest_sender(uuid),
  public.reset_guest(uuid), public.resolve_guest(uuid, boolean),
  public.share_link(uuid), public.set_share_on(uuid, boolean)
from public, anon;
grant execute on function
  public.claim_guest(text, uuid), public.dispute_guest(text, uuid),
  public.reset_guest(uuid), public.resolve_guest(uuid, boolean),
  public.share_link(uuid), public.set_share_on(uuid, boolean)
to authenticated;
