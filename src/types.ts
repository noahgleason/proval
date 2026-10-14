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

/** A story request is one photo; a post request is an Instagram-style carousel of up to MAX_POST_PHOTOS. */
export type RequestKind = 'story' | 'post';
/** Instagram's carousel limit. Mirrors create_request() in SQL. */
export const MAX_POST_PHOTOS = 20;

/** One photo inside a request. Everyone tagged in it answers it on its own. */
export type Photo = {
  id: string;
  requestId: string;
  kind: RequestKind;
  /** 0-based place in the post. */
  position: number;
  /** How many photos the whole request has. */
  photoCount: number;
  uploaderId: string;
  /** The request's caption. */
  caption: string;
  taggedIds: string[];
  createdAt: string; // ISO date
  /** Keyed by the tagged user's id. */
  reviews: Record<string, Review>;
  /** Where the app loads the image from. */
  imageUrl: string;
};

/** A story or post someone wants to share: its photos share one caption and one deadline. */
export type PhotoRequest = {
  id: string;
  kind: RequestKind;
  uploaderId: string;
  caption: string;
  createdAt: string; // ISO date
  /** In post order. */
  photos: Photo[];
};

/** Groups photos into their requests, keeping the order requests first appear in. */
export function groupRequests(photos: Photo[]): PhotoRequest[] {
  const byId = new Map<string, PhotoRequest>();
  for (const p of photos) {
    let r = byId.get(p.requestId);
    if (!r) {
      r = { id: p.requestId, kind: p.kind, uploaderId: p.uploaderId, caption: p.caption, createdAt: p.createdAt, photos: [] };
      byId.set(p.requestId, r);
    }
    r.photos.push(p);
  }
  for (const r of byId.values()) r.photos.sort((a, b) => a.position - b.position);
  return [...byId.values()];
}

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

/**
 * Cleared once everyone tagged approves (or stays silent until the deadline). A "no" marks the
 * photo; it isn't removed, and the sender decides what to do. A photo nobody is tagged in is cleared.
 */
export function statusOf(photo: Pick<Photo, 'taggedIds' | 'reviews' | 'createdAt'>, now = Date.now()): PhotoStatus {
  const answers = photo.taggedIds.map((id) => answerOf(photo, id, now));
  if (answers.includes('deny')) return 'denied';
  if (answers.includes('waiting')) return 'pending';
  return 'approved';
}

/** A request is waiting while any photo is; otherwise it's marked if any photo got a no. */
export function requestStatusOf(request: PhotoRequest, now = Date.now()): PhotoStatus {
  const statuses = request.photos.map((p) => statusOf(p, now));
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('denied')) return 'denied';
  return 'approved';
}

/** Everyone tagged anywhere in the request. */
export function taggedInRequest(request: PhotoRequest): string[] {
  return [...new Set(request.photos.flatMap((p) => p.taggedIds))];
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
