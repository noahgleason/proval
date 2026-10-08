import { getStore } from '@netlify/blobs';
import type { Photo } from '../../src/types';
import { USERS } from '../../src/users';

/** Photo metadata (who's tagged, reviews) as JSON, keyed by photo id. */
export const metaStore = () => getStore({ name: 'photo-meta', consistency: 'strong' });
/** The image bytes, keyed by photo id. */
export const imageStore = () => getStore({ name: 'photo-images' });

export type StoredPhoto = Omit<Photo, 'imageUrl'> & { mimeType: string };

export const toPhoto = ({ mimeType: _m, ...p }: StoredPhoto): Photo => ({
  ...p,
  imageUrl: `/api/photos/${p.id}/image`,
});

export async function allPhotos(): Promise<StoredPhoto[]> {
  const store = metaStore();
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<StoredPhoto | null>));
  return items
    .filter((p): p is StoredPhoto => !!p)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const isUser = (id: unknown): id is string => typeof id === 'string' && USERS.some((u) => u.id === id);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export { CORS };
