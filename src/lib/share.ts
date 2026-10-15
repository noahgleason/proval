import { Platform, Share } from 'react-native';

/** Links point at whichever site you're on (production, a deploy preview, localhost); the app uses the real one. */
export function linkUrl(token: string): string {
  const origin = Platform.OS === 'web' ? window.location.origin : 'https://getproval.app';
  return `${origin}/l/${token}`;
}

/** What gets pasted into the group chat. Says nothing about the photos themselves. */
export function linkMessage(senderName: string, token: string): string {
  return `${senderName} wants to post some photos you’re in. Tap your name to approve or veto: ${linkUrl(token)}`;
}

/**
 * Opens the share sheet where there is one (phones, and mobile browsers); otherwise copies the
 * message. Returns 'copied' when it copied, so the screen can say so.
 */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS !== 'web') {
    const r = await Share.share({ message });
    return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }
  if (typeof navigator.share === 'function' && navigator.maxTouchPoints > 0) {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Some browsers refuse share() outside a tap; fall back to copying.
    }
  }
  await navigator.clipboard.writeText(message);
  return 'copied';
}

/** Your invite link: whoever signs up through it sends you a friend request. */
export function inviteUrl(code: string): string {
  const origin = Platform.OS === 'web' ? window.location.origin : 'https://getproval.app';
  return `${origin}/i/${code}`;
}

export function inviteMessage(code: string): string {
  return `I’m using Proval so friends can okay photos before they’re posted. Join me: ${inviteUrl(code)}`;
}

// Remembers a link across signing in (Google sign-in leaves the page and comes back to /).
const PENDING_LINK = 'proval.pendingLink';
const PENDING_INVITE = 'proval.pendingInvite';

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function take(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

export const rememberPendingLink = (token: string) => remember(PENDING_LINK, token);
export const takePendingLink = () => take(PENDING_LINK);
export const rememberPendingInvite = (code: string) => remember(PENDING_INVITE, code);
export const takePendingInvite = () => take(PENDING_INVITE);
