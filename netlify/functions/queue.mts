import type { Config } from '@netlify/functions';
import { allPhotos, fail, isUser, json, preflight, toPhoto } from '../lib/store';

/** GET /api/queue?user=ava → photos Ava is tagged in and hasn't reviewed yet. */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const user = new URL(req.url).searchParams.get('user');
  if (!isUser(user)) return fail('Unknown user');

  const photos = await allPhotos();
  const waiting = photos.filter((p) => p.taggedIds.includes(user) && !p.reviews[user]);
  // Oldest first, so the photo that's been waiting longest comes up next.
  return json(waiting.reverse().map(toPhoto));
};

export const config: Config = { path: '/api/queue', method: ['GET', 'OPTIONS'] };
