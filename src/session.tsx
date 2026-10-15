import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage, usingMock } from './api';
import { DEMO_USERS } from './api/mock';
import { PROFILE_FIELDS, toUser } from './api/supabase';
import type { AvatarPhoto } from './lib/avatarPhoto';
import { supabase } from './lib/supabase';
import { registerForPush, unregisterPush } from './notifications';
import type { User } from './types';
import { AVATAR_COLORS, rememberUsers } from './users';

type Status = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

type Session = {
  status: Status;
  /** Signed-in user id ('' when signed out). */
  userId: string;
  /** The email of the signed-in auth account (Google or email code), if any. */
  email: string | null;
  me: User | null;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  createProfile(input: { name: string; username: string }): Promise<void>;
  /** Sets or removes (null) your profile photo. */
  setPhoto(photo: AvatarPhoto | null): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Demo only: become a different placeholder account. */
  switchUser(id: string): void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be inside SessionProvider');
  return s;
}

/** The signed-in user id, for screens that only render when signed in. */
export const useUserId = () => useSession().userId;

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(usingMock ? 'ready' : 'loading');
  const [userId, setUserId] = useState(usingMock ? DEMO_USERS[0].id : '');
  const [me, setMe] = useState<User | null>(usingMock ? DEMO_USERS[0] : null);
  const [email, setEmail] = useState<string | null>(null);

  // Supabase: follow the auth session, then look up the profile row.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const loadProfile = async (uid: string | undefined) => {
      if (!uid) {
        setUserId('');
        setMe(null);
        setStatus('signedOut');
        return;
      }
      const { data } = await client.from('profiles').select(PROFILE_FIELDS).eq('id', uid).maybeSingle();
      setUserId(uid);
      if (data) {
        const user = toUser(data);
        rememberUsers([user]);
        setMe(user);
        setStatus('ready');
      } else {
        setMe(null);
        setStatus('needsProfile');
      }
    };

    client.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      loadProfile(data.session?.user.id);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      // Supabase advises against awaiting its own calls inside this callback.
      setTimeout(() => loadProfile(session?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (status === 'ready' && userId && !usingMock) registerForPush(userId).catch(() => {});
  }, [status, userId]);

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    if (error) throw new Error(error.message);
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) {
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code');
      setUserId(DEMO_USERS[0].id);
      setMe(DEMO_USERS[0]);
      setStatus('ready');
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
    if (error) throw new Error(error.message);
  }, []);

  const createProfile = useCallback(
    async ({ name, username }: { name: string; username: string }) => {
      if (!supabase) return;
      const row = {
        id: userId,
        username: username.trim().toLowerCase(),
        name: name.trim(),
        color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      };
      const { error } = await supabase.from('profiles').insert(row);
      if (error) throw new Error(error.code === '23505' ? 'That username is taken' : error.message);
      rememberUsers([row]);
      setMe(row);
      setStatus('ready');
    },
    [userId],
  );

  const setPhoto = useCallback(
    async (photo: AvatarPhoto | null) => {
      setMe(await api.setAvatar(userId, photo));
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    await unregisterPush();
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      setUserId('');
      setMe(null);
      setStatus('signedOut');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    await unregisterPush();
    try {
      await api.deleteAccount(userId);
    } catch (e) {
      throw new Error(errorMessage(e, 'Could not delete your account'));
    }
    if (!supabase) {
      setUserId('');
      setMe(null);
      setStatus('signedOut');
    }
  }, [userId]);

  const switchUser = useCallback((id: string) => {
    const user = DEMO_USERS.find((u) => u.id === id);
    if (!usingMock || !user) return;
    setUserId(user.id);
    setMe(user);
  }, []);

  const value = useMemo(
    () => ({ status, userId, email, me, sendCode, verifyCode, createProfile, setPhoto, signOut, deleteAccount, switchUser }),
    [status, userId, email, me, sendCode, verifyCode, createProfile, setPhoto, signOut, deleteAccount, switchUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
