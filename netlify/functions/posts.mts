import type { Config } from '@netlify/functions';
import { allPhotos, fail, isUser, json, preflight, toPhoto } from '../lib/store';

/** GET /api/posts?user=ava → photos Ava submitted, newest first, with everyone's reviews. */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const user = new URL(req.url).searchParams.get('user');
  if (!isUser(user)) return fail('Unknown user');

  const photos = await allPhotos();
  return json(photos.filter((p) => p.uploaderId === user).map(toPhoto));
};

export const config: Config = { path: '/api/posts', method: ['GET', 'OPTIONS'] };
