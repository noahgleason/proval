-- Invite links: getproval.app/i/<code>. Everyone has one code. Opening it shows who invited you
-- (works signed out); a new account made from it sends that person a friend request.
--
-- Safe to run on a live project: existing accounts get a code, nothing else changes.

alter table public.profiles
  add column invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

-- Only you need your own code (you read it through your own profile row, which is fine: the
-- code only lets people send you a friend request). The invite page needs just the inviter's
-- public bits, so it goes through this function rather than the table.
create function public.invite_preview(code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
  p public.profiles;
  f public.friendships;
  relation text;
begin
  select * into p from public.profiles where invite_code = code;
  if p.id is null then return null; end if;

  if me is null then
    relation := null;
  elsif me = p.id then
    relation := 'self';
  elsif public.is_blocked(me, p.id) then
    relation := 'blocked';
  else
    select * into f from public.friendships
    where least(from_id, to_id) = least(me, p.id) and greatest(from_id, to_id) = greatest(me, p.id);
    relation := case
      when f is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.from_id = me then 'requested'
      else 'they_asked'
    end;
  end if;

  return jsonb_build_object('id', p.id, 'name', p.name, 'username', p.username, 'color', p.color,
    'avatar_path', p.avatar_path, 'relation', relation);
end;
$$;

-- Sends the inviter a friend request (or accepts theirs, if they already asked you).
create function public.accept_invite(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  inviter uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Finish setting up your account first';
  end if;
  select id into inviter from public.profiles where invite_code = code;
  if inviter is null then raise exception 'That invite link doesn''t work'; end if;
  perform public.add_friend(inviter);
  return inviter;
end;
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
