import type { Config } from '@netlify/functions';
import { friendStateFor, pairKey, type Friendship } from '../../src/types';
import { allFriendships, fail, friendStore, isUser, json, preflight } from '../lib/store';

const stateOf = async (userId: string) => json(friendStateFor(userId, await allFriendships()));

/**
 * GET    /api/friends?user=ava              → { friends, incoming, outgoing }
 * POST   /api/friends { userId, otherId }   → send a request, or accept theirs if they already asked
 * DELETE /api/friends?user=ava&other=leo    → decline, cancel, or unfriend
 */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const user = url.searchParams.get('user');
    if (!isUser(user)) return fail('Unknown user');
    return stateOf(user);
  }

  if (req.method === 'DELETE') {
    const user = url.searchParams.get('user');
    const other = url.searchParams.get('other');
    if (!isUser(user) || !isUser(other)) return fail('Unknown user');
    await friendStore().delete(pairKey(user, other));
    return stateOf(user);
  }

  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Body must be JSON');
  }
  const { userId, otherId } = body;
  if (!isUser(userId) || !isUser(otherId)) return fail('Unknown user');
  if (userId === otherId) return fail('That’s you');

  const store = friendStore();
  const key = pairKey(userId, otherId);
  const existing = (await store.get(key, { type: 'json' })) as Friendship | null;
  const now = new Date().toISOString();

  if (existing?.status === 'pending' && existing.to === userId) {
    await store.setJSON(key, { ...existing, status: 'accepted', at: now } satisfies Friendship);
  } else if (!existing) {
    // onlyIfNew: if they asked at the same moment, fall through and let the next tap accept.
    await store.setJSON(key, { from: userId, to: otherId, status: 'pending', at: now } satisfies Friendship, { onlyIfNew: true });
  }
  return stateOf(userId);
};

export const config: Config = { path: '/api/friends', method: ['GET', 'POST', 'DELETE', 'OPTIONS'] };
