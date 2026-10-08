import {
  friendStateFor,
  isExpired,
  pairKey,
  type Decision,
  type FriendState,
  type Friendship,
  type Photo,
  type ReactionId,
  type Review,
} from './types';

/**
 * Talks to the Netlify Functions backend when EXPO_PUBLIC_API_URL is set
 * (e.g. https://proval.netlify.app or http://localhost:8888 with `netlify dev`).
 * Without it, the app runs on in-memory mock data so the screens work right away.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const usingMock = !API_URL;

export type NewPhoto = {
  uploaderId: string;
  caption: string;
  taggedIds: string[];
  imageBase64: string;
  mimeType: string;
  /** Local uri, only used by the mock to show the picked photo. */
  localUri?: string;
};

export type ReviewInput = {
  photoId: string;
  reviewerId: string;
  decision: Decision;
  reaction?: ReactionId;
  comment?: string;
};

export interface Api {
  /** Photos this user is tagged in and hasn't reviewed yet. */
  queue(userId: string): Promise<Photo[]>;
  /** Photos this user submitted, newest first. */
  myPosts(userId: string): Promise<Photo[]>;
  submit(input: NewPhoto): Promise<Photo>;
  review(input: ReviewInput): Promise<Photo>;
  friends(userId: string): Promise<FriendState>;
  /** Sends a friend request, or accepts theirs if they already asked you. */
  addFriend(userId: string, otherId: string): Promise<FriendState>;
  /** Declines a request, cancels yours, or unfriends. */
  removeFriend(userId: string, otherId: string): Promise<FriendState>;
}

// ---------- Real backend ----------

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** The backend returns relative image paths; make them absolute for <Image>. */
function withAbsoluteImage(photo: Photo): Photo {
  return photo.imageUrl.startsWith('/') ? { ...photo, imageUrl: `${API_URL}${photo.imageUrl}` } : photo;
}

const remoteApi: Api = {
  async queue(userId) {
    const photos = await call<Photo[]>(`/api/queue?user=${encodeURIComponent(userId)}`);
    return photos.map(withAbsoluteImage);
  },
  async myPosts(userId) {
    const photos = await call<Photo[]>(`/api/posts?user=${encodeURIComponent(userId)}`);
    return photos.map(withAbsoluteImage);
  },
  async submit(input) {
    const { localUri: _unused, ...body } = input;
    return withAbsoluteImage(await call<Photo>('/api/photos', { method: 'POST', body: JSON.stringify(body) }));
  },
  async review(input) {
    return withAbsoluteImage(await call<Photo>('/api/reviews', { method: 'POST', body: JSON.stringify(input) }));
  },
  friends(userId) {
    return call<FriendState>(`/api/friends?user=${encodeURIComponent(userId)}`);
  },
  addFriend(userId, otherId) {
    return call<FriendState>('/api/friends', { method: 'POST', body: JSON.stringify({ userId, otherId }) });
  },
  removeFriend(userId, otherId) {
    const q = `user=${encodeURIComponent(userId)}&other=${encodeURIComponent(otherId)}`;
    return call<FriendState>(`/api/friends?${q}`, { method: 'DELETE' });
  },
};

// ---------- Mock backend ----------

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

let mockPhotos: Photo[] = [
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

// Ava, Marcus, Jordan, Priya and Leo are all friends. Sam has asked Ava; Noor knows nobody yet.
const CORE = ['ava', 'marcus', 'jordan', 'priya', 'leo'];
const mockFriendships = new Map<string, Friendship>(
  CORE.flatMap((a, i) =>
    CORE.slice(i + 1).map((b): [string, Friendship] => [pairKey(a, b), { from: a, to: b, status: 'accepted', at: hoursAgo(500) }]),
  ),
);
mockFriendships.set(pairKey('sam', 'ava'), { from: 'sam', to: 'ava', status: 'pending', at: hoursAgo(3) });

const mockFriendState = (userId: string) => friendStateFor(userId, [...mockFriendships.values()]);

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const mockApi: Api = {
  async queue(userId) {
    await wait();
    return mockPhotos
      .filter((p) => p.taggedIds.includes(userId) && !p.reviews[userId] && !isExpired(p))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async myPosts(userId) {
    await wait();
    return mockPhotos
      .filter((p) => p.uploaderId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submit(input) {
    await wait();
    const { friends } = mockFriendState(input.uploaderId);
    if (!input.taggedIds.every((id) => friends.includes(id))) throw new Error('You can only tag friends');
    const photo: Photo = {
      id: `m${Date.now()}`,
      uploaderId: input.uploaderId,
      caption: input.caption,
      taggedIds: input.taggedIds,
      createdAt: new Date().toISOString(),
      reviews: {},
      imageUrl: input.localUri ?? `data:${input.mimeType};base64,${input.imageBase64}`,
    };
    mockPhotos = [photo, ...mockPhotos];
    return photo;
  },
  async review({ photoId, reviewerId, decision, reaction, comment }) {
    await wait(100);
    const photo = mockPhotos.find((p) => p.id === photoId);
    if (!photo) throw new Error('Photo not found');
    if (isExpired(photo)) throw new Error('Too late, this one already auto-approved');
    const review: Review = { decision, reaction, comment: comment?.trim() || undefined, at: new Date().toISOString() };
    photo.reviews = { ...photo.reviews, [reviewerId]: review };
    return photo;
  },
  async friends(userId) {
    await wait(150);
    return mockFriendState(userId);
  },
  async addFriend(userId, otherId) {
    await wait(150);
    if (userId === otherId) throw new Error('That’s you');
    const key = pairKey(userId, otherId);
    const existing = mockFriendships.get(key);
    if (existing?.status === 'pending' && existing.to === userId) {
      mockFriendships.set(key, { ...existing, status: 'accepted', at: new Date().toISOString() });
    } else if (!existing) {
      mockFriendships.set(key, { from: userId, to: otherId, status: 'pending', at: new Date().toISOString() });
    }
    return mockFriendState(userId);
  },
  async removeFriend(userId, otherId) {
    await wait(150);
    mockFriendships.delete(pairKey(userId, otherId));
    return mockFriendState(userId);
  },
};

export const api: Api = usingMock ? mockApi : remoteApi;
