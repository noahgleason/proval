import { sb } from '../lib/supabase';
import { AUTO_APPROVE_HOURS, friendStateFor, type Friendship, type Photo, type ReactionId, type Review, type User } from '../types';
import { rememberUsers } from '../users';
import type { Api } from './index';

// A review belongs to a tag (photo + tagged person), not to the photo directly,
// so reviews are fetched through photo_tags.
const PHOTO_FIELDS =
  'id, uploader_id, caption, image_path, created_at, photo_tags(user_id, reviews(reviewer_id, decision, reaction, comment, at))';
const SIGNED_URL_SECONDS = 60 * 60;

type ReviewRow = { reviewer_id: string; decision: Review['decision']; reaction: ReactionId | null; comment: string | null; at: string };
type PhotoRow = {
  id: string;
  uploader_id: string;
  caption: string;
  image_path: string;
  created_at: string;
  // One review per tag at most; PostgREST returns it as an object or a one-item array depending on version.
  photo_tags: { user_id: string; reviews: ReviewRow | ReviewRow[] | null }[];
};

const reviewsOf = (r: PhotoRow): ReviewRow[] => r.photo_tags.flatMap((t) => (t.reviews == null ? [] : ([] as ReviewRow[]).concat(t.reviews)));
type ProfileRow = { id: string; username: string; name: string; color: string };

const toUser = (p: ProfileRow): User => ({ id: p.id, username: p.username, name: p.name, color: p.color });

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Loads any profiles we haven't seen yet into the cache. */
async function loadProfiles(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = check(await sb().from('profiles').select('id, username, name, color').in('id', unique)) as ProfileRow[];
  rememberUsers(rows.map(toUser));
}

/** Rows → Photos with signed image URLs (the bucket is private). */
async function toPhotos(rows: PhotoRow[]): Promise<Photo[]> {
  if (rows.length === 0) return [];
  await loadProfiles(rows.flatMap((r) => [r.uploader_id, ...r.photo_tags.map((t) => t.user_id)]));
  const signed = check(await sb().storage.from('photos').createSignedUrls(rows.map((r) => r.image_path), SIGNED_URL_SECONDS));
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    uploaderId: r.uploader_id,
    caption: r.caption,
    taggedIds: r.photo_tags.map((t) => t.user_id),
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
      // RLS only returns photos you sent or are tagged in, so "not mine" means "tagged in".
      sb().from('photos').select(PHOTO_FIELDS).neq('uploader_id', userId).gt('created_at', since).order('created_at'),
      supabaseApi.blocked(userId),
    ]);
    const waiting = (check(rows) as PhotoRow[]).filter(
      (r) => !reviewsOf(r).some((v) => v.reviewer_id === userId) && !blocked.includes(r.uploader_id),
    );
    return toPhotos(waiting);
  },

  async myPosts(userId) {
    const rows = check(
      await sb().from('photos').select(PHOTO_FIELDS).eq('uploader_id', userId).order('created_at', { ascending: false }),
    ) as PhotoRow[];
    return toPhotos(rows);
  },

  async submit(input) {
    const path = `${input.uploaderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${EXT[input.mimeType] ?? 'jpg'}`;
    const bucket = sb().storage.from('photos');
    check(await bucket.upload(path, decodeBase64(input.imageBase64), { contentType: input.mimeType }));
    const res = await sb().rpc('create_photo', { caption: input.caption, image_path: path, tagged: input.taggedIds });
    if (res.error) {
      await bucket.remove([path]);
      throw new Error(res.error.message);
    }
  },

  async review({ photoId, decision, reaction, comment }) {
    check(await sb().rpc('review_photo', { photo: photoId, decision, reaction: reaction ?? null, comment: comment ?? null }));
  },

  async deletePhoto(userId, photoId) {
    const row = check(await sb().from('photos').select('image_path').eq('id', photoId).eq('uploader_id', userId).single()) as {
      image_path: string;
    };
    check(await sb().from('photos').delete().eq('id', photoId));
    await sb().storage.from('photos').remove([row.image_path]);
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
        .select('id, username, name, color')
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

  async savePushToken(userId, token, platform) {
    check(
      await sb().from('push_tokens').upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }),
    );
  },

  async removePushToken(token) {
    await sb().from('push_tokens').delete().eq('token', token);
  },

  async deleteAccount(userId) {
    // Storage files can't be deleted from SQL, so clear your folder first.
    const bucket = sb().storage.from('photos');
    for (;;) {
      const files = check(await bucket.list(userId, { limit: 100 })) ?? [];
      if (files.length === 0) break;
      check(await bucket.remove(files.map((f) => `${userId}/${f.name}`)));
    }
    check(await sb().rpc('delete_account'));
    await sb().auth.signOut();
  },
};
