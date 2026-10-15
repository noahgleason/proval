import { sb } from '../lib/supabase';
import {
  AUTO_APPROVE_HOURS,
  friendStateFor,
  groupRequests,
  type Friendship,
  type LinkPreview,
  type Photo,
  type ReactionId,
  type RequestKind,
  type Review,
  type User,
} from '../types';
import { rememberUsers } from '../users';
import type { Api } from './index';

// A review belongs to a tag (photo + tagged person), not to the photo directly,
// so reviews are fetched through photo_tags. The request supplies kind, caption and deadline.
// People tagged by name come through photo_guests.
const PHOTO_FIELDS =
  'id, request_id, position, uploader_id, image_path, created_at, photo_requests(kind, caption, photo_count), photo_tags(user_id, reviews(reviewer_id, decision, reaction, comment, at)), photo_guests(request_guests(id, name, claimed_by, claimed_at, disputed_by))';
const SIGNED_URL_SECONDS = 60 * 60;

type ReviewRow = { reviewer_id: string; decision: Review['decision']; reaction: ReactionId | null; comment: string | null; at: string };
type PhotoRow = {
  id: string;
  request_id: string;
  position: number;
  uploader_id: string;
  image_path: string;
  created_at: string;
  photo_requests: { kind: RequestKind; caption: string; photo_count: number };
  // One review per tag at most; PostgREST returns it as an object or a one-item array depending on version.
  photo_tags: { user_id: string; reviews: ReviewRow | ReviewRow[] | null }[];
  photo_guests: { request_guests: GuestRow }[];
};
type GuestRow = { id: string; name: string; claimed_by: string | null; claimed_at: string | null; disputed_by: string | null };

const reviewsOf = (r: PhotoRow): ReviewRow[] => r.photo_tags.flatMap((t) => (t.reviews == null ? [] : ([] as ReviewRow[]).concat(t.reviews)));
type ProfileRow = { id: string; username: string; name: string; color: string; avatar_path: string | null };

export const PROFILE_FIELDS = 'id, username, name, color, avatar_path';

/** Profile photos live in a public bucket, so their links never expire and browsers can cache them. */
const avatarUrl = (path: string | null) => (path ? sb().storage.from('avatars').getPublicUrl(path).data.publicUrl : undefined);

export const toUser = (p: ProfileRow): User => ({
  id: p.id,
  username: p.username,
  name: p.name,
  color: p.color,
  avatarUrl: avatarUrl(p.avatar_path),
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Loads any profiles we haven't seen yet into the cache. */
async function loadProfiles(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = check(await sb().from('profiles').select(PROFILE_FIELDS).in('id', unique)) as ProfileRow[];
  rememberUsers(rows.map(toUser));
}

/** Rows → Photos with signed image URLs (the bucket is private). */
async function toPhotos(rows: PhotoRow[]): Promise<Photo[]> {
  if (rows.length === 0) return [];
  await loadProfiles(
    rows.flatMap((r) => [
      r.uploader_id,
      ...r.photo_tags.map((t) => t.user_id),
      ...r.photo_guests.flatMap((g) => [g.request_guests.claimed_by, g.request_guests.disputed_by].filter((x): x is string => !!x)),
    ]),
  );
  const signed = check(await sb().storage.from('photos').createSignedUrls(rows.map((r) => r.image_path), SIGNED_URL_SECONDS));
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    kind: r.photo_requests.kind,
    position: r.position,
    photoCount: r.photo_requests.photo_count,
    uploaderId: r.uploader_id,
    caption: r.photo_requests.caption,
    taggedIds: r.photo_tags.map((t) => t.user_id),
    guests: r.photo_guests.map(({ request_guests: g }) => ({
      id: g.id,
      name: g.name,
      claimedBy: g.claimed_by ?? undefined,
      claimedAt: g.claimed_at ?? undefined,
      disputedBy: g.disputed_by ?? undefined,
    })),
    createdAt: r.created_at,
    imageUrl: urlFor.get(r.image_path) ?? '',
    reviews: Object.fromEntries(
      reviewsOf(r).map((v) => [
        v.reviewer_id,
        { decision: v.decision, reaction: v.reaction ?? undefined, comment: v.comment ?? undefined, at: v.at },
      ]),
    ),
  }));
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

export const supabaseApi: Api = {
  async queue(userId) {
    const since = new Date(Date.now() - AUTO_APPROVE_HOURS * 3_600_000).toISOString();
    const [rows, blocked] = await Promise.all([
      // RLS returns whole requests you sent or are tagged in, so keep only the photos you're in.
      sb()
        .from('photos')
        .select(PHOTO_FIELDS)
        .neq('uploader_id', userId)
        .gt('created_at', since)
        .order('created_at')
        .order('position'),
      supabaseApi.blocked(userId),
    ]);
    const waiting = (check(rows) as unknown as PhotoRow[]).filter(
      (r) =>
        r.photo_tags.some((t) => t.user_id === userId) &&
        !reviewsOf(r).some((v) => v.reviewer_id === userId) &&
        !blocked.includes(r.uploader_id),
    );
    return toPhotos(waiting);
  },

  async myPosts(userId) {
    const rows = check(
      await sb()
        .from('photos')
        .select(PHOTO_FIELDS)
        .eq('uploader_id', userId)
        .order('created_at', { ascending: false })
        .order('position'),
    ) as unknown as PhotoRow[];
    return groupRequests(await toPhotos(rows));
  },

  async request(_userId, requestId) {
    const rows = check(await sb().from('photos').select(PHOTO_FIELDS).eq('request_id', requestId).order('position')) as unknown as PhotoRow[];
    const [request] = groupRequests(await toPhotos(rows));
    if (!request) throw new Error('That request is gone');
    return request;
  },

  async submit(input) {
    const bucket = sb().storage.from('photos');
    const paths: string[] = [];
    try {
      for (const photo of input.photos) {
        const path = `${input.uploaderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${EXT[photo.mimeType] ?? 'jpg'}`;
        check(await bucket.upload(path, decodeBase64(photo.imageBase64), { contentType: photo.mimeType }));
        paths.push(path);
      }
      const items = input.photos.map((p, i) => ({ image_path: paths[i], tagged: p.taggedIds, guests: p.guestNames, blur: p.blur ?? null }));
      return check(await sb().rpc('create_request', { kind: input.kind, caption: input.caption, items })) as string;
    } catch (e) {
      if (paths.length) await bucket.remove(paths);
      throw e;
    }
  },

  async review({ photoId, decision, reaction, comment }) {
    check(await sb().rpc('review_photo', { photo: photoId, decision, reaction: reaction ?? null, comment: comment ?? null }));
  },

  async deleteRequest(userId, requestId) {
    const rows = check(
      await sb().from('photos').select('image_path').eq('request_id', requestId).eq('uploader_id', userId),
    ) as { image_path: string }[];
    check(await sb().from('photo_requests').delete().eq('id', requestId));
    if (rows.length) await sb().storage.from('photos').remove(rows.map((r) => r.image_path));
  },

  async shareLink(_userId, requestId) {
    const link = check(await sb().rpc('share_link', { request: requestId })) as { token: string; on: boolean } | null;
    if (!link) throw new Error('That request is gone');
    return link;
  },

  async setShareOn(_userId, requestId, on) {
    check(await sb().rpc('set_share_on', { request: requestId, turned_on: on }));
  },

  async linkPreview(_userId, token) {
    type Row = {
      off: boolean;
      sender: string;
      kind: RequestKind;
      photo_count: number;
      closes_at: string;
      blurs: (string | null)[];
      viewer: null | { is_sender: boolean; tagged: boolean; guest: string | null };
      guests: null | { id: string; name: string; claimed: boolean; flagged_by_me: boolean }[];
    };
    const r = check(await sb().rpc('share_preview', { token })) as Row | null;
    if (!r) return null;
    if (r.off) return { off: true, sender: r.sender };
    return {
      off: false,
      sender: r.sender,
      kind: r.kind,
      photoCount: r.photo_count,
      closesAt: r.closes_at,
      blurs: r.blurs,
      viewer: r.viewer && { isSender: r.viewer.is_sender, tagged: r.viewer.tagged, guestId: r.viewer.guest },
      guests: r.guests && r.guests.map((g) => ({ id: g.id, name: g.name, claimed: g.claimed, flaggedByMe: g.flagged_by_me })),
    } satisfies LinkPreview;
  },

  async claimGuest(_userId, token, guestId) {
    return check(await sb().rpc('claim_guest', { token, guest: guestId })) as string;
  },

  async disputeGuest(_userId, token, guestId) {
    check(await sb().rpc('dispute_guest', { token, guest: guestId }));
  },

  async resetGuest(_userId, guestId) {
    check(await sb().rpc('reset_guest', { guest: guestId }));
  },

  async resolveGuest(_userId, guestId, switchToFlagger) {
    check(await sb().rpc('resolve_guest', { guest: guestId, switch_to_flagger: switchToFlagger }));
  },

  async badges() {
    return check(await sb().rpc('badge_counts')) as { review: number; dashboard: number };
  },

  async markDashboardSeen() {
    check(await sb().rpc('mark_dashboard_seen'));
  },

  async friends(userId) {
    const rows = check(await sb().from('friendships').select('from_id, to_id, status, at')) as {
      from_id: string;
      to_id: string;
      status: Friendship['status'];
      at: string;
    }[];
    const all: Friendship[] = rows.map((r) => ({ from: r.from_id, to: r.to_id, status: r.status, at: r.at }));
    await loadProfiles(all.flatMap((f) => [f.from, f.to]));
    return friendStateFor(userId, all);
  },

  async addFriend(userId, otherId) {
    check(await sb().rpc('add_friend', { other: otherId }));
    return supabaseApi.friends(userId);
  },

  async removeFriend(userId, otherId) {
    check(await sb().rpc('remove_friend', { other: otherId }));
    return supabaseApi.friends(userId);
  },

  async searchUsers(userId, query) {
    // Strip characters that mean something in PostgREST filter syntax.
    const q = query.trim().toLowerCase().replace(/^@/, '').replace(/[%,()*\\]/g, '');
    if (q.length < 2) return [];
    const [rows, blocked] = await Promise.all([
      sb()
        .from('profiles')
        .select(PROFILE_FIELDS)
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .neq('id', userId)
        .limit(20),
      supabaseApi.blocked(userId),
    ]);
    const users = (check(rows) as ProfileRow[]).map(toUser).filter((u) => !blocked.includes(u.id));
    rememberUsers(users);
    return users;
  },

  async blocked() {
    const rows = check(await sb().from('blocks').select('blocked_id')) as { blocked_id: string }[];
    const ids = rows.map((r) => r.blocked_id);
    await loadProfiles(ids);
    return ids;
  },

  async block(_userId, otherId) {
    check(await sb().rpc('block_user', { other: otherId }));
  },

  async unblock(userId, otherId) {
    check(await sb().from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId));
  },

  async report({ reporterId, reason, photoId, userId }) {
    check(await sb().from('reports').insert({ reporter_id: reporterId, reason, photo_id: photoId ?? null, user_id: userId ?? null }));
  },

  async setAvatar(userId, photo) {
    const bucket = sb().storage.from('avatars');
    const before = check(await sb().from('profiles').select('avatar_path').eq('id', userId).single()) as { avatar_path: string | null };
    let path: string | null = null;
    if (photo) {
      // A new name each time, so nobody keeps seeing a cached old photo.
      path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await bucket.upload(path, decodeBase64(photo.base64), { contentType: photo.mimeType, cacheControl: '31536000' }));
    }
    try {
      const row = check(
        await sb().from('profiles').update({ avatar_path: path }).eq('id', userId).select(PROFILE_FIELDS).single(),
      ) as ProfileRow;
      if (before.avatar_path && before.avatar_path !== path) await bucket.remove([before.avatar_path]);
      const user = toUser(row);
      rememberUsers([user]);
      return user;
    } catch (e) {
      if (path) await bucket.remove([path]);
      throw e;
    }
  },

  async savePushToken(userId, token, platform) {
    check(
      await sb().from('push_tokens').upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }),
    );
  },

  async removePushToken(token) {
    await sb().from('push_tokens').delete().eq('token', token);
  },

  async deleteAccount(userId) {
    // Storage files can't be deleted from SQL, so clear your folders first.
    for (const name of ['photos', 'avatars']) {
      const bucket = sb().storage.from(name);
      for (;;) {
        const files = check(await bucket.list(userId, { limit: 100 })) ?? [];
        if (files.length === 0) break;
        check(await bucket.remove(files.map((f) => `${userId}/${f.name}`)));
      }
    }
    check(await sb().rpc('delete_account'));
    await sb().auth.signOut();
  },
};
