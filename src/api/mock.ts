import {
  friendStateFor,
  groupRequests,
  isExpired,
  MAX_POST_PHOTOS,
  pairKey,
  type Friendship,
  type Photo,
  type RequestKind,
  type Review,
  type User,
} from '../types';
import { rememberUsers } from '../users';
import type { Api } from './index';

/** Demo accounts. Ava, Marcus, Jordan, Priya and Leo are friends; Sam has asked Ava; Noor knows nobody. */
export const DEMO_USERS: User[] = [
  { id: 'ava', username: 'ava', name: 'Ava', color: '#3A2BF5' },
  { id: 'marcus', username: 'marcus', name: 'Marcus', color: '#C2410C' },
  { id: 'jordan', username: 'jordan', name: 'Jordan', color: '#0F766E' },
  { id: 'priya', username: 'priya', name: 'Priya', color: '#7C3AED' },
  { id: 'leo', username: 'leo', name: 'Leo', color: '#334155' },
  { id: 'sam', username: 'sam', name: 'Sam', color: '#B45309' },
  { id: 'noor', username: 'noor', name: 'Noor', color: '#0E7490' },
];
rememberUsers(DEMO_USERS);

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const now = () => new Date().toISOString();
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const img = (seed: string) => `https://picsum.photos/seed/proval-${seed}/800/1000`;

type DemoPhoto = { seed: string; tagged: string[]; reviews?: Record<string, Review> };

/** Builds one request's photos. A single photo is a story request; more make a post. */
function demoRequest(id: string, uploaderId: string, caption: string, createdAt: string, shots: DemoPhoto[], kind?: RequestKind): Photo[] {
  return shots.map((s, i) => ({
    id: `${id}-${i}`,
    requestId: id,
    kind: kind ?? (shots.length > 1 ? 'post' : 'story'),
    position: i,
    photoCount: shots.length,
    uploaderId,
    caption,
    taggedIds: s.tagged,
    createdAt,
    reviews: s.reviews ?? {},
    imageUrl: img(s.seed),
  }));
}

let photos: Photo[] = [
  // Marcus's beach post: Ava is in photos 1 and 3, so she reviews those two.
  ...demoRequest('r1', 'marcus', 'beach day', hoursAgo(2), [
    { seed: 'beach', tagged: ['ava', 'jordan'], reviews: { jordan: { decision: 'approve', reaction: 'obsessed', at: hoursAgo(1) } } },
    { seed: 'beach-2', tagged: ['jordan'] },
    { seed: 'beach-3', tagged: ['ava'] },
  ]),
  ...demoRequest('r2', 'jordan', 'birthday dinner!!', hoursAgo(9), [{ seed: 'dinner', tagged: ['ava', 'marcus', 'priya'] }]),
  ...demoRequest('r3', 'priya', 'concert pics', hoursAgo(19), [{ seed: 'concert', tagged: ['ava'] }]),
  // Ava's formal post: one photo got a no, which marks it without blocking the others.
  ...demoRequest('r4', 'ava', 'formal', hoursAgo(30), [
    {
      seed: 'formal',
      tagged: ['marcus', 'priya'],
      reviews: {
        marcus: { decision: 'approve', at: hoursAgo(28) },
        priya: { decision: 'deny', reaction: 'better_one', comment: 'use the one where im not blinking lol', at: hoursAgo(26) },
      },
    },
    { seed: 'formal-2', tagged: ['priya'], reviews: { priya: { decision: 'approve', reaction: 'obsessed', at: hoursAgo(26) } } },
    { seed: 'formal-3', tagged: ['marcus'], reviews: { marcus: { decision: 'approve', at: hoursAgo(28) } } },
  ]),
  // Leo never answered, so the window closing counted as a yes.
  ...demoRequest('r5', 'ava', 'road trip dump', hoursAgo(50), [
    { seed: 'roadtrip', tagged: ['jordan', 'leo'], reviews: { jordan: { decision: 'approve', reaction: 'obsessed', at: hoursAgo(48) } } },
    { seed: 'roadtrip-2', tagged: [] },
    { seed: 'roadtrip-3', tagged: ['leo'] },
    { seed: 'roadtrip-4', tagged: ['jordan'], reviews: { jordan: { decision: 'approve', at: hoursAgo(48) } } },
  ]),
  ...demoRequest('r6', 'ava', 'gym mirror', hoursAgo(5), [{ seed: 'gym', tagged: ['leo'] }]),
  ...demoRequest('r7', 'ava', '', hoursAgo(72), [
    {
      seed: 'lake',
      tagged: ['marcus', 'jordan', 'priya'],
      reviews: {
        marcus: { decision: 'approve', at: hoursAgo(70) },
        jordan: { decision: 'approve', reaction: 'edit_first', comment: 'warm it up a bit', at: hoursAgo(69) },
        priya: { decision: 'approve', at: hoursAgo(60) },
      },
    },
  ]),
];

const CORE = ['ava', 'marcus', 'jordan', 'priya', 'leo'];
const friendships = new Map<string, Friendship>(
  CORE.flatMap((a, i) =>
    CORE.slice(i + 1).map((b): [string, Friendship] => [pairKey(a, b), { from: a, to: b, status: 'accepted', at: hoursAgo(500) }]),
  ),
);
friendships.set(pairKey('sam', 'ava'), { from: 'sam', to: 'ava', status: 'pending', at: hoursAgo(3) });

/** blocker → people they blocked */
const blocks = new Map<string, Set<string>>();
const isBlocked = (a: string, b: string) => !!blocks.get(a)?.has(b) || !!blocks.get(b)?.has(a);
const friendState = (userId: string) =>
  friendStateFor(
    userId,
    [...friendships.values()].filter((f) => !isBlocked(f.from, f.to)),
  );

export const mockApi: Api = {
  async queue(userId) {
    await wait();
    return photos
      .filter((p) => p.taggedIds.includes(userId) && !p.reviews[userId] && !isExpired(p) && !isBlocked(userId, p.uploaderId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.position - b.position);
  },
  async myPosts(userId) {
    await wait();
    return groupRequests(
      photos.filter((p) => p.uploaderId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },
  async request(userId, requestId) {
    await wait(120);
    const [request] = groupRequests(photos.filter((p) => p.requestId === requestId));
    if (!request || (request.uploaderId !== userId && !request.photos.some((p) => p.taggedIds.includes(userId)))) {
      throw new Error('That request is gone');
    }
    return request;
  },
  async submit({ uploaderId, kind, caption, photos: shots }) {
    await wait();
    const { friends } = friendState(uploaderId);
    if (shots.length === 0) throw new Error('Add a photo');
    if (kind === 'story' && shots.length !== 1) throw new Error('A story request has one photo');
    if (shots.length > MAX_POST_PHOTOS) throw new Error(`A post can have up to ${MAX_POST_PHOTOS} photos`);
    if (!shots.every((s) => s.taggedIds.every((id) => friends.includes(id)))) throw new Error('You can only tag friends');
    if (!shots.some((s) => s.taggedIds.length > 0)) throw new Error('Tag at least one friend');
    const id = `r${Date.now()}`;
    const createdAt = now();
    photos = [
      ...shots.map((s, i) => ({
        id: `${id}-${i}`,
        requestId: id,
        kind,
        position: i,
        photoCount: shots.length,
        uploaderId,
        caption,
        taggedIds: s.taggedIds,
        createdAt,
        reviews: {},
        imageUrl: s.localUri,
      })),
      ...photos,
    ];
  },
  async review({ photoId, reviewerId, decision, reaction, comment }) {
    await wait(100);
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) throw new Error('Photo not found');
    if (!photo.taggedIds.includes(reviewerId)) throw new Error('You are not tagged in this photo');
    if (isExpired(photo)) throw new Error('Too late, this one already auto-approved');
    const review: Review = { decision, reaction, comment: comment?.trim() || undefined, at: now() };
    photo.reviews = { ...photo.reviews, [reviewerId]: review };
  },
  async deleteRequest(userId, requestId) {
    await wait(100);
    photos = photos.filter((p) => !(p.requestId === requestId && p.uploaderId === userId));
  },

  async friends(userId) {
    await wait(120);
    return friendState(userId);
  },
  async addFriend(userId, otherId) {
    await wait(120);
    if (userId === otherId) throw new Error('That’s you');
    if (isBlocked(userId, otherId)) throw new Error('You can’t add this person');
    const key = pairKey(userId, otherId);
    const existing = friendships.get(key);
    if (existing?.status === 'pending' && existing.to === userId) {
      friendships.set(key, { ...existing, status: 'accepted', at: now() });
    } else if (!existing) {
      friendships.set(key, { from: userId, to: otherId, status: 'pending', at: now() });
    }
    return friendState(userId);
  },
  async removeFriend(userId, otherId) {
    await wait(120);
    friendships.delete(pairKey(userId, otherId));
    return friendState(userId);
  },
  async searchUsers(userId, query) {
    await wait(120);
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return DEMO_USERS.filter(
      (u) => u.id !== userId && !isBlocked(userId, u.id) && (u.username.includes(q) || u.name.toLowerCase().includes(q)),
    );
  },

  async blocked(userId) {
    await wait(100);
    return [...(blocks.get(userId) ?? [])];
  },
  async block(userId, otherId) {
    await wait(100);
    if (!blocks.has(userId)) blocks.set(userId, new Set());
    blocks.get(userId)!.add(otherId);
    friendships.delete(pairKey(userId, otherId));
  },
  async unblock(userId, otherId) {
    await wait(100);
    blocks.get(userId)?.delete(otherId);
  },
  async report() {
    await wait(100);
  },

  async savePushToken() {},
  async removePushToken() {},
  async deleteAccount() {
    await wait(300);
  },
};
