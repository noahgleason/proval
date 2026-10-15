import type { Decision, FriendState, InvitePreview, LinkPreview, Photo, PhotoRequest, ReactionId, RequestKind, User } from '../types';
import { mockApi } from './mock';
import { supabaseApi } from './supabase';
import type { AvatarPhoto } from '../lib/avatarPhoto';

/**
 * With EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set, the app
 * talks to Supabase. Without them it runs on in-memory demo data so every screen works.
 */
export const usingMock = !process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type NewPhoto = {
  /** Who's in this photo. A post can have photos with nobody tagged, as long as someone is tagged somewhere. */
  taggedIds: string[];
  /** People not on Proval, by name. The same name on several photos is one person. */
  guestNames: string[];
  imageBase64: string;
  /** Tiny preview for the link page, as a data: URI. */
  blur?: string;
  mimeType: string;
  /** Local file uri, used by the demo to show the picked photo. */
  localUri: string;
};

export type NewRequest = {
  uploaderId: string;
  kind: RequestKind;
  caption: string;
  /** In post order. A story has exactly one. */
  photos: NewPhoto[];
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
  /**
   * Photos you're tagged in, haven't answered, still inside the window: only your photos,
   * never the rest of the post. Oldest request first, in post order.
   */
  queue(userId: string): Promise<Photo[]>;
  /** Requests you sent, newest first. */
  myPosts(userId: string): Promise<PhotoRequest[]>;
  /** A whole request, for "View whole post". You must have sent it or be tagged in it. */
  request(userId: string, requestId: string): Promise<PhotoRequest>;
  /** Returns the new request's id. */
  submit(input: NewRequest): Promise<string>;
  review(input: ReviewInput): Promise<void>;
  /** Withdraw a request you sent, with all its photos. */
  deleteRequest(userId: string, requestId: string): Promise<void>;

  /** Your request's group-chat link: its token, and whether it's turned on. */
  shareLink(userId: string, requestId: string): Promise<{ token: string; on: boolean }>;
  setShareOn(userId: string, requestId: string, on: boolean): Promise<void>;
  /** The link page. Works signed out. Null if the link doesn't exist. */
  linkPreview(userId: string, token: string): Promise<LinkPreview | null>;
  /** Tap your name on a link. You're then tagged for real; returns the request id. */
  claimGuest(userId: string, token: string, guestId: string): Promise<string>;
  /** "That's not me" on a name someone else took. */
  disputeGuest(userId: string, token: string, guestId: string): Promise<void>;
  /** Sender: free a name again, clearing whatever the claimer answered. */
  resetGuest(userId: string, guestId: string): Promise<void>;
  /** Sender: settle a "That's not me" by keeping the claimer or switching to the flagger. */
  resolveGuest(userId: string, guestId: string, switchToFlagger: boolean): Promise<void>;

  /**
   * The numbers on the Review and Dashboard tabs: photos waiting on your answer, and changes to
   * your requests since you last opened the Dashboard (new answers, names claimed) plus any unsettled flags.
   */
  badges(userId: string): Promise<{ review: number; dashboard: number }>;
  /** You opened the Dashboard: its number clears, on every device. */
  markDashboardSeen(userId: string): Promise<void>;

  /** Your invite link's code (getproval.app/i/<code>). */
  myInviteCode(userId: string): Promise<string>;
  /** The invite page. Works signed out. Null if the code doesn't exist. */
  invitePreview(userId: string, code: string): Promise<InvitePreview | null>;
  /** Sends the inviter a friend request, or accepts theirs. */
  acceptInvite(userId: string, code: string): Promise<void>;

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

  /** Sets your profile photo, or removes it with null. Returns your updated profile. */
  setAvatar(userId: string, photo: AvatarPhoto | null): Promise<User>;

  savePushToken(userId: string, token: string, platform: string): Promise<void>;
  removePushToken(token: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}

export const api: Api = usingMock ? mockApi : supabaseApi;

export const errorMessage = (e: unknown, fallback = 'Something went wrong') =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : fallback;
