import type { User } from './types';

// Placeholder accounts until real sign-in exists. Who's friends with whom lives
// in the friendships data, not here. Switch "who you are" from the header.
export const USERS: User[] = [
  { id: 'ava', name: 'Ava', color: '#3A2BF5' },
  { id: 'marcus', name: 'Marcus', color: '#C2410C' },
  { id: 'jordan', name: 'Jordan', color: '#0F766E' },
  { id: 'priya', name: 'Priya', color: '#7C3AED' },
  { id: 'leo', name: 'Leo', color: '#334155' },
  { id: 'sam', name: 'Sam', color: '#B45309' },
  { id: 'noor', name: 'Noor', color: '#0E7490' },
];

export function userById(id: string): User {
  return USERS.find((u) => u.id === id) ?? { id, name: id, color: '#999' };
}
