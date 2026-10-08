// Shared data model. Keep the rules here in sync with supabase/migrations.

export type User = {
  id: string;
  /** Lowercase handle, shown as @username. */
  username: string;
  name: string;
  color: string;
};

// ---------- Friends ----------

/** A friend request, or an accepted friendship once the other person says yes. */
export type Friendship = {
  from: string;
  to: string;
  status: 'pending' | 'accepted';
  at: string; // ISO date
};

/** Where one person stands with everyone else. */
export type FriendState = {
  friends: string[];
  /** People asking to be your friend. */
  incoming: string[];
  /** People you've asked who haven't answered. */
  outgoing: string[];
};

/** One record per pair, whoever asked first. */
export const pairKey = (a: string, b: string) => [a, b].sort().join('__');

export function friendStateFor(userId: string, all: Friendship[]): FriendState {
  const state: FriendState = { friends: [], incoming: [], outgoing: [] };
  for (const f of all) {
    if (f.from !== userId && f.to !== userId) continue;
    const other = f.from === userId ? f.to : f.from;
    if (f.status === 'accepted') state.friends.push(other);
    else if (f.to === userId) state.incoming.push(other);
    else state.outgoing.push(other);
  }
  return state;
}

// ---------- Photos ----------

export type Decision = 'approve' | 'deny';

export type ReactionId =
  | 'obsessed'
  | 'last_resort'
  | 'better_one'
  | 'edit_first'
  | 'crop_me'
  | 'delete_it';

export type Reaction = {
  id: ReactionId;
  label: string;
  /** Which swipe direction this reaction makes sense for. */
  fits: Decision | 'both';
};

export const REACTIONS: Reaction[] = [
  { id: 'obsessed', label: 'Obsessed', fits: 'approve' },
  { id: 'last_resort', label: 'Last resort', fits: 'approve' },
  { id: 'better_one', label: 'Only if no better one', fits: 'both' },
  { id: 'edit_first', label: 'Edit me first', fits: 'both' },
  { id: 'crop_me', label: 'Crop me out', fits: 'deny' },
  { id: 'delete_it', label: 'Delete this forever', fits: 'deny' },
];

export type Review = {
  decision: Decision;
  reaction?: ReactionId;
  comment?: string;
  at: string; // ISO date
};

export type PhotoStatus = 'pending' | 'approved' | 'denied';

export type Photo = {
  id: string;
  uploaderId: string;
  caption: string;
  taggedIds: string[];
  createdAt: string; // ISO date
  /** Keyed by the tagged user's id. */
  reviews: Record<string, Review>;
  /** Where the app loads the image from. */
  imageUrl: string;
};

/** Silence counts as a yes once this window passes. Mirrors answer_window() in SQL. */
export const AUTO_APPROVE_HOURS = 24;

/** When unanswered requests on this photo turn into approvals. */
export function deadlineOf(photo: Pick<Photo, 'createdAt'>): number {
  return Date.parse(photo.createdAt) + AUTO_APPROVE_HOURS * 3_600_000;
}

export function isExpired(photo: Pick<Photo, 'createdAt'>, now = Date.now()): boolean {
  return now >= deadlineOf(photo);
}

/** One tagged friend's answer, counting silence past the deadline as an auto-approval. */
export type Answer = Decision | 'auto' | 'waiting';

export function answerOf(photo: Pick<Photo, 'createdAt' | 'reviews'>, userId: string, now = Date.now()): Answer {
  const r = photo.reviews[userId];
  if (r) return r.decision;
  return isExpired(photo, now) ? 'auto' : 'waiting';
}

/** Everyone tagged has to approve (or stay silent until the deadline); one deny blocks the post. */
export function statusOf(photo: Pick<Photo, 'taggedIds' | 'reviews' | 'createdAt'>, now = Date.now()): PhotoStatus {
  const answers = photo.taggedIds.map((id) => answerOf(photo, id, now));
  if (answers.includes('deny')) return 'denied';
  if (answers.includes('waiting')) return 'pending';
  return 'approved';
}

/** "5h", "40m", "2d": compact time until the deadline. */
export function timeLeft(photo: Pick<Photo, 'createdAt'>, now = Date.now()): string {
  const mins = Math.max(1, Math.ceil((deadlineOf(photo) - now) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.ceil(mins / 60);
  return hours < 48 ? `${hours}h` : `${Math.ceil(hours / 24)}d`;
}

export function reactionFor(id?: ReactionId): Reaction | undefined {
  return REACTIONS.find((r) => r.id === id);
}

export const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Violence or self-harm',
  'Hate speech',
  'Spam or scam',
  'Something else',
] as const;
