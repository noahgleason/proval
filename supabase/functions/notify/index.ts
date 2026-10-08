// Sends Expo push notifications. Two callers:
//  - Database webhooks (INSERT/UPDATE rows) for photo_tags, reviews, friendships
//  - An hourly cron ({ "type": "cron" }) for deadline reminders and auto-approvals
// Both must send the header `x-notify-secret: <NOTIFY_SECRET>`.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANSWER_WINDOW_HOURS = 24; // keep in sync with answer_window() in the migration
const REMIND_HOURS_LEFT = 3;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Push = { userId: string; title: string; body: string; url: string };
type Row = Record<string, unknown>;
type Webhook = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; record: Row; old_record: Row | null };

Deno.serve(async (req) => {
  if (req.headers.get('x-notify-secret') !== Deno.env.get('NOTIFY_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }
  const payload = await req.json();
  const pushes = payload.type === 'cron' ? await cronPushes() : await webhookPushes(payload as Webhook);
  const sent = await send(pushes);
  return Response.json({ sent });
});

async function webhookPushes(e: Webhook): Promise<Push[]> {
  const r = e.record;

  if (e.table === 'photo_tags' && e.type === 'INSERT') {
    const photo = await photoById(r.photo_id as string);
    if (!photo) return [];
    const from = await nameOf(photo.uploader_id);
    return [{ userId: r.user_id as string, title: from, body: 'wants to post a photo you’re in', url: '/review' }];
  }

  if (e.table === 'reviews' && e.type === 'INSERT') {
    const photo = await photoById(r.photo_id as string);
    if (!photo) return [];
    const who = await nameOf(r.reviewer_id as string);
    const approved = r.decision === 'approve';
    const pushes: Push[] = [
      {
        userId: photo.uploader_id,
        title: approved ? `${who} approved` : `${who} said don’t post`,
        body: [label(photo.caption), r.comment ? `“${r.comment}”` : ''].filter(Boolean).join(' · '),
        url: '/',
      },
    ];
    if (approved && (await everyoneApproved(photo.id))) {
      pushes.push({ userId: photo.uploader_id, title: 'Cleared to post', body: `Everyone approved ${label(photo.caption)}`, url: '/' });
    }
    return pushes;
  }

  if (e.table === 'friendships' && e.type === 'INSERT' && r.status === 'pending') {
    return [{ userId: r.to_id as string, title: await nameOf(r.from_id as string), body: 'wants to be friends on Proval', url: '/profile' }];
  }

  if (e.table === 'friendships' && e.type === 'UPDATE' && r.status === 'accepted' && e.old_record?.status === 'pending') {
    return [{ userId: r.from_id as string, title: await nameOf(r.to_id as string), body: 'accepted your friend request', url: '/profile' }];
  }

  return [];
}

/** Runs hourly: nudge people who haven't answered, and tell senders when silence cleared a photo. */
async function cronPushes(): Promise<Push[]> {
  const hour = 3_600_000;
  const now = Date.now();
  const pushes: Push[] = [];

  // Photos whose deadline is ~REMIND_HOURS_LEFT away (created in a one-hour slice).
  const remindFrom = new Date(now - (ANSWER_WINDOW_HOURS - REMIND_HOURS_LEFT + 1) * hour).toISOString();
  const remindTo = new Date(now - (ANSWER_WINDOW_HOURS - REMIND_HOURS_LEFT) * hour).toISOString();
  const { data: soon } = await db
    .from('photos')
    .select('id, uploader_id, caption, photo_tags(user_id), reviews(reviewer_id)')
    .gte('created_at', remindFrom)
    .lt('created_at', remindTo);
  for (const p of soon ?? []) {
    const answered = new Set((p.reviews ?? []).map((x: Row) => x.reviewer_id));
    const from = await nameOf(p.uploader_id);
    for (const t of p.photo_tags ?? []) {
      if (answered.has(t.user_id)) continue;
      pushes.push({
        userId: t.user_id,
        title: `${REMIND_HOURS_LEFT}h left`,
        body: `${from}’s photo auto-approves if you don’t answer`,
        url: '/review',
      });
    }
  }

  // Photos whose window closed in the last hour with no deny: cleared by silence.
  const closedFrom = new Date(now - (ANSWER_WINDOW_HOURS + 1) * hour).toISOString();
  const closedTo = new Date(now - ANSWER_WINDOW_HOURS * hour).toISOString();
  const { data: closed } = await db
    .from('photos')
    .select('id, uploader_id, caption, photo_tags(user_id), reviews(decision)')
    .gte('created_at', closedFrom)
    .lt('created_at', closedTo);
  for (const p of closed ?? []) {
    const reviews = p.reviews ?? [];
    if (reviews.some((x: Row) => x.decision === 'deny')) continue;
    if (reviews.length === (p.photo_tags ?? []).length) continue; // already cleared by votes
    pushes.push({ userId: p.uploader_id, title: 'Cleared to post', body: `Time’s up and nobody said no to ${label(p.caption)}`, url: '/' });
  }

  return pushes;
}

async function send(pushes: Push[]): Promise<number> {
  if (pushes.length === 0) return 0;
  const userIds = [...new Set(pushes.map((p) => p.userId))];
  const { data: tokens } = await db.from('push_tokens').select('token, user_id').in('user_id', userIds);
  const messages = pushes.flatMap((p) =>
    (tokens ?? [])
      .filter((t) => t.user_id === p.userId)
      .map((t) => ({ to: t.token, title: p.title, body: p.body, sound: 'default', data: { url: p.url } })),
  );

  let sent = 0;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => null);
    const tickets: { status: string; details?: { error?: string } }[] = json?.data ?? [];
    const dead = batch.filter((_, j) => tickets[j]?.details?.error === 'DeviceNotRegistered').map((m) => m.to);
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
    sent += tickets.filter((t) => t.status === 'ok').length;
  }
  return sent;
}

async function photoById(id: string) {
  const { data } = await db.from('photos').select('id, uploader_id, caption').eq('id', id).maybeSingle();
  return data as { id: string; uploader_id: string; caption: string } | null;
}

async function nameOf(userId: string): Promise<string> {
  const { data } = await db.from('profiles').select('name').eq('id', userId).maybeSingle();
  return data?.name ?? 'Someone';
}

async function everyoneApproved(photoId: string): Promise<boolean> {
  const [{ count: tagged }, { count: approved }] = await Promise.all([
    db.from('photo_tags').select('*', { count: 'exact', head: true }).eq('photo_id', photoId),
    db.from('reviews').select('*', { count: 'exact', head: true }).eq('photo_id', photoId).eq('decision', 'approve'),
  ]);
  return !!tagged && tagged === approved;
}

const label = (caption: string) => (caption ? `“${caption}”` : 'your photo');
