// Shared data model. The Netlify functions import this file too.

export type User = {
  id: string;
  name: string;
  color: string;
};

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
  emoji: string;
  /** Which swipe direction this reaction makes sense for. */
  fits: Decision | 'both';
};

export const REACTIONS: Reaction[] = [
  { id: 'obsessed', label: 'Obsessed', emoji: '😍', fits: 'approve' },
  { id: 'last_resort', label: 'Last resort', emoji: '😬', fits: 'approve' },
  { id: 'better_one', label: 'Only if no better one', emoji: '🤔', fits: 'both' },
  { id: 'edit_first', label: 'Edit me first', emoji: '✨', fits: 'both' },
  { id: 'crop_me', label: 'Crop me out', emoji: '✂️', fits: 'deny' },
  { id: 'delete_it', label: 'Delete this forever', emoji: '🗑️', fits: 'deny' },
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

/** Everyone tagged has to approve; one deny blocks the post. */
export function statusOf(photo: Pick<Photo, 'taggedIds' | 'reviews'>): PhotoStatus {
  const reviews = photo.taggedIds.map((id) => photo.reviews[id]);
  if (reviews.some((r) => r?.decision === 'deny')) return 'denied';
  if (reviews.every((r) => r?.decision === 'approve')) return 'approved';
  return 'pending';
}

export function reactionFor(id?: ReactionId): Reaction | undefined {
  return REACTIONS.find((r) => r.id === id);
}
