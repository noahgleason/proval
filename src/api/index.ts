import type { Decision, FriendState, Photo, ReactionId, User } from '../types';
import { mockApi } from './mock';
import { supabaseApi } from './supabase';

/**
 * With EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set, the app
 * talks to Supabase. Without them it runs on in-memory demo data so every screen works.
 */
export const usingMock = !process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type NewPhoto = {
  uploaderId: string;
  caption: string;
  taggedIds: string[];
  imageBase64: string;
  mimeType: string;
  /** Local file uri, used by the demo to show the picked photo. */
  localUri: string;
};

export type ReviewInput = {
  photoId: string;
  reviewerId: string;
  decision: Decision;
  reaction?: ReactionId;
  comment?: string;
};

export type ReportInput = {
  reporterId: string;
  reason: string;
  photoId?: string;
  userId?: string;
};

/**
 * Everything the screens need from a backend. `userId` is always the signed-in
 * user; Supabase ignores it and trusts the session instead.
 */
export interface Api {
  /** Photos you're tagged in, haven't answered, still inside the window. Oldest first. */
  queue(userId: string): Promise<Photo[]>;
  /** Photos you sent, newest first. */
  myPosts(userId: string): Promise<Photo[]>;
  submit(input: NewPhoto): Promise<void>;
  review(input: ReviewInput): Promise<void>;
  /** Withdraw a photo you sent. */
  deletePhoto(userId: string, photoId: string): Promise<void>;

  friends(userId: string): Promise<FriendState>;
  /** Sends a friend request, or accepts theirs if they already asked you. */
  addFriend(userId: string, otherId: string): Promise<FriendState>;
  /** Declines a request, cancels yours, or unfriends. */
  removeFriend(userId: string, otherId: string): Promise<FriendState>;
  searchUsers(userId: string, query: string): Promise<User[]>;

  blocked(userId: string): Promise<string[]>;
  block(userId: string, otherId: string): Promise<void>;
  unblock(userId: string, otherId: string): Promise<void>;
  report(input: ReportInput): Promise<void>;

  savePushToken(userId: string, token: string, platform: string): Promise<void>;
  removePushToken(token: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}

export const api: Api = usingMock ? mockApi : supabaseApi;

export const errorMessage = (e: unknown, fallback = 'Something went wrong') =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : fallback;
