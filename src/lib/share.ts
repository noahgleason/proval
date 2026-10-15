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

/** Remembers a link across signing in (Google sign-in leaves the page and comes back to /). */
const PENDING_KEY = 'proval.pendingLink';

export function rememberPendingLink(token: string) {
  try {
    localStorage.setItem(PENDING_KEY, token);
  } catch {}
}

export function takePendingLink(): string | null {
  try {
    const token = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return token;
  } catch {
    return null;
  }
}
