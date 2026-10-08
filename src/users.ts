import type { User } from './types';

/**
 * Profiles the app has seen, keyed by id. The API fills this as it loads data,
 * so components can turn an id into a name and color without another request.
 */
const cache = new Map<string, User>();

export function rememberUsers(users: User[]) {
  for (const u of users) cache.set(u.id, u);
}

export function userById(id: string): User {
  return cache.get(id) ?? { id, username: 'unknown', name: 'Someone', color: '#86827C' };
}

/** Colors new accounts pick from at random. */
export const AVATAR_COLORS = ['#3A2BF5', '#C2410C', '#0F766E', '#7C3AED', '#334155', '#B45309', '#0E7490', '#BE185D'];
