-- The numbers on the Review and Dashboard tabs, worked out in one call with the server's clock.
-- "When you last opened the Dashboard" lives here (not on the device), so opening it on your
-- laptop clears the number on your phone too.
--
-- Safe to run on a live project: it only adds a table and two functions.

create table public.dashboard_seen (
  user_id uuid primary key references public.profiles on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.dashboard_seen enable row level security;

create policy "You see when you last opened your dashboard" on public.dashboard_seen
  for select to authenticated using (user_id = auth.uid());
-- Writes only go through mark_dashboard_seen(), which always uses the server's time.

create function public.mark_dashboard_seen() returns void
language sql security definer set search_path = '' as $$
  insert into public.dashboard_seen (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = now();
$$;

-- review: photos waiting on your answer (tagged, unanswered, inside the window, sender not blocked).
-- dashboard: since you last opened it, new answers to your photos and names claimed on your
-- links, plus every "That's not me" flag you haven't settled.
create function public.badge_counts() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  seen timestamptz;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    return jsonb_build_object('review', 0, 'dashboard', 0);
  end if;

  select seen_at into seen from public.dashboard_seen where user_id = me;
  if seen is null then
    -- First check ever: start counting from now rather than showing every answer so far.
    seen := now();
    insert into public.dashboard_seen (user_id, seen_at) values (me, seen) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'review', (
      select count(*)
      from public.photo_tags t join public.photos p on p.id = t.photo_id
      where t.user_id = me
        and now() < p.created_at + public.answer_window()
        and not exists (select 1 from public.reviews r where r.photo_id = t.photo_id and r.reviewer_id = me)
        and not public.is_blocked(me, p.uploader_id)
    ),
    'dashboard', (
      select count(*)
      from public.reviews r join public.photos p on p.id = r.photo_id
      where p.uploader_id = me and r.reviewer_id <> me and r.at > seen
    ) + (
      select count(*)
      from public.request_guests g join public.photo_requests q on q.id = g.request_id
      where q.uploader_id = me and (g.claimed_at > seen or g.disputed_by is not null)
    )
  );
end;
$$;

revoke execute on function public.mark_dashboard_seen(), public.badge_counts() from public, anon;
grant execute on function public.mark_dashboard_seen(), public.badge_counts() to authenticated;
