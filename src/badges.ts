import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from './api';

/** The numbers on the Review and Dashboard tabs. */
export type Badges = { review: number; dashboard: number };

const POLL_MS = 45_000;
const listeners = new Set<() => void>();

/** Ask every badge to re-check now, e.g. right after you answer a photo. */
export function refreshBadges() {
  listeners.forEach((l) => l());
}

/** Clears the Dashboard number. It's saved with your account, so it clears on your other devices too. */
export function markDashboardSeen(userId: string) {
  api.markDashboardSeen(userId).then(refreshBadges, () => {});
}

/** Keeps the tab numbers current: on load, every 45 seconds, when the app comes back, and on request. */
export function useBadges(userId: string): Badges {
  const [badges, setBadges] = useState<Badges>({ review: 0, dashboard: 0 });

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const check = () => {
      api.badges(userId).then(
        (b) => live && setBadges(b),
        () => {}, // keep the last numbers if a check fails
      );
    };
    check();
    listeners.add(check);
    const timer = setInterval(check, POLL_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && check());
    const onVisible = () => document.visibilityState === 'visible' && check();
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      listeners.delete(check);
      clearInterval(timer);
      app.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return badges;
}

/**
 * People asking to be your friend. Re-checked like the tab numbers (every 45s, when the app comes
 * back, on refreshBadges()) and on reload().
 */
export function useIncomingRequests(userId: string): { incoming: string[]; reload: () => void } {
  const [incoming, setIncoming] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const check = () => {
      api.friends(userId).then(
        (s) => live && setIncoming(s.incoming),
        () => {},
      );
    };
    check();
    listeners.add(check);
    const timer = setInterval(check, POLL_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      live = false;
      listeners.delete(check);
      clearInterval(timer);
      app.remove();
    };
  }, [userId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { incoming, reload };
}
