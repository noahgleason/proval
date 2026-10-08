import type { User } from './types';

// Placeholder friend group until real accounts exist.
// Switch "who you are" from the header to test both sides of a review.
export const USERS: User[] = [
  { id: 'ava', name: 'Ava', color: '#E8517A' },
  { id: 'mia', name: 'Mia', color: '#7B61FF' },
  { id: 'zoe', name: 'Zoe', color: '#2DBE7E' },
  { id: 'lily', name: 'Lily', color: '#F2A93B' },
  { id: 'emma', name: 'Emma', color: '#2F9BE0' },
];

export function userById(id: string): User {
  return USERS.find((u) => u.id === id) ?? { id, name: id, color: '#999' };
}
