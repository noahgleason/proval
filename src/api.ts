import type { Decision, Photo, ReactionId, Review } from './types';

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
};

// ---------- Mock backend ----------

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

let mockPhotos: Photo[] = [
  {
    id: 'm1',
    uploaderId: 'mia',
    caption: 'beach day ☀️',
    taggedIds: ['ava', 'zoe'],
    createdAt: daysAgo(0),
    reviews: { zoe: { decision: 'approve', reaction: 'obsessed', at: daysAgo(0) } },
    imageUrl: 'https://picsum.photos/seed/proval-beach/800/1000',
  },
  {
    id: 'm2',
    uploaderId: 'zoe',
    caption: 'birthday dinner!!',
    taggedIds: ['ava', 'mia', 'lily'],
    createdAt: daysAgo(1),
    reviews: {},
    imageUrl: 'https://picsum.photos/seed/proval-dinner/800/1000',
  },
  {
    id: 'm3',
    uploaderId: 'lily',
    caption: 'concert pics',
    taggedIds: ['ava'],
    createdAt: daysAgo(1),
    reviews: {},
    imageUrl: 'https://picsum.photos/seed/proval-concert/800/1000',
  },
  {
    id: 'm4',
    uploaderId: 'ava',
    caption: 'formal 💃',
    taggedIds: ['mia', 'emma'],
    createdAt: daysAgo(2),
    reviews: {
      mia: { decision: 'approve', at: daysAgo(2) },
      emma: { decision: 'deny', reaction: 'better_one', comment: 'use the one where im not blinking lol', at: daysAgo(1) },
    },
    imageUrl: 'https://picsum.photos/seed/proval-formal/800/1000',
  },
];

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const mockApi: Api = {
  async queue(userId) {
    await wait();
    return mockPhotos.filter((p) => p.taggedIds.includes(userId) && !p.reviews[userId]);
  },
  async myPosts(userId) {
    await wait();
    return mockPhotos
      .filter((p) => p.uploaderId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submit(input) {
    await wait();
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
    const review: Review = { decision, reaction, comment: comment?.trim() || undefined, at: new Date().toISOString() };
    photo.reviews = { ...photo.reviews, [reviewerId]: review };
    return photo;
  },
};

export const api: Api = usingMock ? mockApi : remoteApi;
