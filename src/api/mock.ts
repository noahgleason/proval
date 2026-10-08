import { friendStateFor, isExpired, pairKey, type Friendship, type Photo, type Review, type User } from '../types';
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

let photos: Photo[] = [
  {
    id: 'm1',
    uploaderId: 'marcus',
    caption: 'beach day',
    taggedIds: ['ava', 'jordan'],
    createdAt: hoursAgo(2),
    reviews: { jordan: { decision: 'approve', reaction: 'obsessed', at: hoursAgo(1) } },
    imageUrl: 'https://picsum.photos/seed/proval-beach/800/1000',
  },
  {
    id: 'm2',
    uploaderId: 'jordan',
    caption: 'birthday dinner!!',
    taggedIds: ['ava', 'marcus', 'priya'],
    createdAt: hoursAgo(9),
    reviews: {},
    imageUrl: 'https://picsum.photos/seed/proval-dinner/800/1000',
  },
  {
    id: 'm3',
    uploaderId: 'priya',
    caption: 'concert pics',
    taggedIds: ['ava'],
    createdAt: hoursAgo(19),
    reviews: {},
    imageUrl: 'https://picsum.photos/seed/proval-concert/800/1000',
  },
  {
    id: 'm4',
    uploaderId: 'ava',
    caption: 'formal',
    taggedIds: ['marcus', 'priya'],
    createdAt: hoursAgo(30),
    reviews: {
      marcus: { decision: 'approve', at: hoursAgo(28) },
      priya: { decision: 'deny', reaction: 'better_one', comment: 'use the one where im not blinking lol', at: hoursAgo(26) },
    },
    imageUrl: 'https://picsum.photos/seed/proval-formal/800/1000',
  },
  {
    id: 'm5',
    uploaderId: 'ava',
    caption: 'road trip dump',
    taggedIds: ['jordan', 'leo'],
    createdAt: hoursAgo(50),
    // Leo never answered, so the window closing counted as a yes.
    reviews: { jordan: { decision: 'approve', reaction: 'obsessed', at: hoursAgo(48) } },
    imageUrl: 'https://picsum.photos/seed/proval-roadtrip/800/1000',
  },
  {
    id: 'm6',
    uploaderId: 'ava',
    caption: 'gym mirror',
    taggedIds: ['leo'],
    createdAt: hoursAgo(5),
    reviews: {},
    imageUrl: 'https://picsum.photos/seed/proval-gym/800/1000',
  },
  {
    id: 'm7',
    uploaderId: 'ava',
    caption: '',
    taggedIds: ['marcus', 'jordan', 'priya'],
    createdAt: hoursAgo(72),
    reviews: {
      marcus: { decision: 'approve', at: hoursAgo(70) },
      jordan: { decision: 'approve', reaction: 'edit_first', comment: 'warm it up a bit', at: hoursAgo(69) },
      priya: { decision: 'approve', at: hoursAgo(60) },
    },
    imageUrl: 'https://picsum.photos/seed/proval-lake/800/1000',
  },
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
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async myPosts(userId) {
    await wait();
    return photos.filter((p) => p.uploaderId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submit(input) {
    await wait();
    const { friends } = friendState(input.uploaderId);
    if (!input.taggedIds.every((id) => friends.includes(id))) throw new Error('You can only tag friends');
    photos = [
      {
        id: `m${Date.now()}`,
        uploaderId: input.uploaderId,
        caption: input.caption,
        taggedIds: input.taggedIds,
        createdAt: now(),
        reviews: {},
        imageUrl: input.localUri,
      },
      ...photos,
    ];
  },
  async review({ photoId, reviewerId, decision, reaction, comment }) {
    await wait(100);
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) throw new Error('Photo not found');
    if (isExpired(photo)) throw new Error('Too late, this one already auto-approved');
    const review: Review = { decision, reaction, comment: comment?.trim() || undefined, at: now() };
    photo.reviews = { ...photo.reviews, [reviewerId]: review };
  },
  async deletePhoto(userId, photoId) {
    await wait(100);
    photos = photos.filter((p) => !(p.id === photoId && p.uploaderId === userId));
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
