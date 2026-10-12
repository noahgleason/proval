import type { Provider } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { sb } from './supabase';

/**
 * OAuth sign-in buttons, in display order. To add a provider, enable it in
 * Supabase (Authentication → Sign In / Providers) and add one line here, e.g.
 *   { id: 'apple', label: 'Continue with Apple' },
 */
export const OAUTH_PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
];

/**
 * Web: the page leaves for the provider and comes back to this same origin
 * (localhost, a Netlify deploy preview, or production), where the Supabase
 * client picks the session up from the URL.
 * Native: the provider opens in an in-app browser that returns to proval://,
 * and we exchange the returned code for a session here.
 */
export async function signInWithProvider(provider: Provider): Promise<void> {
  if (Platform.OS === 'web') {
    const { error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) throw new Error(error.message);
    return;
  }

  const redirectTo = Linking.createURL('/');
  const { data, error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw new Error(error.message);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // closed or cancelled

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code !== 'string') {
    const message = queryParams?.error_description ?? queryParams?.error;
    throw new Error(typeof message === 'string' ? message : 'Sign-in didn’t finish');
  }
  const { error: exchangeError } = await sb().auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
}
