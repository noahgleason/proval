import type { Config } from '@netlify/functions';
import { isExpired, REACTIONS, type Review } from '../../src/types';
import { fail, isUser, json, metaStore, preflight, toPhoto, type StoredPhoto } from '../lib/store';

/** POST /api/reviews { photoId, reviewerId, decision, reaction?, comment? } */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Body must be JSON');
  }
  const { photoId, reviewerId, decision, reaction, comment } = body;

  if (typeof photoId !== 'string') return fail('Missing photoId');
  if (!isUser(reviewerId)) return fail('Unknown reviewer');
  if (decision !== 'approve' && decision !== 'deny') return fail('decision must be approve or deny');
  if (reaction !== undefined && !REACTIONS.some((r) => r.id === reaction)) return fail('Unknown reaction');

  const store = metaStore();
  // Retry on conflict so two friends reviewing at the same moment don't overwrite each other.
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await store.getWithMetadata(photoId, { type: 'json' });
    if (!found) return fail('Photo not found', 404);
    const photo = found.data as StoredPhoto;
    if (!photo.taggedIds.includes(reviewerId)) return fail('You are not tagged in this photo', 403);
    if (isExpired(photo)) return fail('Too late, this one already auto-approved', 409);

    const review: Review = {
      decision,
      reaction: reaction as Review['reaction'],
      comment: typeof comment === 'string' && comment.trim() ? comment.trim().slice(0, 200) : undefined,
      at: new Date().toISOString(),
    };
    const updated: StoredPhoto = { ...photo, reviews: { ...photo.reviews, [reviewerId]: review } };

    const result = await store.setJSON(photoId, updated, found.etag ? { onlyIfMatch: found.etag } : undefined);
    if (result.modified) return json(toPhoto(updated));
  }
  return fail('Busy, try again', 409);
};

export const config: Config = { path: '/api/reviews', method: ['POST', 'OPTIONS'] };
