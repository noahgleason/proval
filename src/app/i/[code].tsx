import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage, usingMock } from '../../api';
import { Avatar } from '../../components/Avatar';
import { FormPage } from '../../components/DesktopBar';
import { Icon, LogoMark } from '../../components/Icon';
import { useIsDesktop } from '../../components/PhoneFrame';
import { OAUTH_PROVIDERS, signInWithProvider } from '../../lib/auth';
import { inviteMessage, rememberPendingInvite, shareText } from '../../lib/share';
import { useSession } from '../../session';
import { colors, radius, type } from '../../theme';
import type { InvitePreview } from '../../types';

/**
 * Someone's invite link. Signed out, it says who invited you and offers sign-in; a new account made
 * from here sends them a friend request (`?join=1` is how sign-in brings you back). Signed in, it's
 * one tap to add them.
 */
export default function InvitePage() {
  const params = useLocalSearchParams<{ code: string; join?: string }>();
  const code = String(params.code ?? '');
  const joining = params.join === '1';
  const { status, userId } = useSession();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const [data, setData] = useState<InvitePreview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoSent = useRef(false);

  const load = useCallback(
    () =>
      api.invitePreview(userId, code).then(
        (d) => setData(d),
        (e) => {
          setError(errorMessage(e));
          setData(null);
        },
      ),
    [userId, code],
  );

  useEffect(() => {
    if (status === 'loading') return;
    load();
  }, [status, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const add = useCallback(
    () =>
      run('add', async () => {
        await api.acceptInvite(userId, code);
        await load();
      }),
    [userId, code, load],
  );

  // Just joined through this link: send the request without making them tap.
  useEffect(() => {
    if (!joining || autoSent.current || status !== 'ready' || !data) return;
    if (data.relation === 'none' || data.relation === 'they_asked') {
      autoSent.current = true;
      api.acceptInvite(userId, code).then(load, (e) => setError(errorMessage(e)));
    }
  }, [joining, status, data, userId, code, load]);

  const join = (provider?: (typeof OAUTH_PROVIDERS)[number]['id']) => {
    rememberPendingInvite(code);
    if (provider) run(provider, () => signInWithProvider(provider));
    else router.push('/sign-in');
  };

  const name = data?.inviter.name ?? '';
  let body: ReactNode;
  if (data === undefined) {
    body = <ActivityIndicator color={colors.ink} style={{ marginTop: 80 }} />;
  } else if (data === null || data.relation === 'blocked') {
    body = (
      <Panel title="This invite link doesn’t work" text="Check that you copied the whole thing, or ask for a new one.">
        <Secondary label="Go to Proval" onPress={() => router.replace('/')} />
      </Panel>
    );
  } else {
    const r = data.relation;
    body = (
      <>
        <View style={styles.hero}>
          <Avatar userId={data.inviter.id} size={72} />
          <Text style={styles.h1}>{r === 'self' ? 'Your invite link' : `${name} invited you to Proval`}</Text>
          <Text style={styles.sub}>
            {r === 'self'
              ? 'Anyone who joins through it sends you a friend request.'
              : 'Friends okay photos before they’re posted. Send one, swipe yes or no, done.'}
          </Text>
        </View>

        {status !== 'ready' && status !== 'needsProfile' ? (
          <Panel title="Join in a few seconds" text={`No password. ${name} gets a friend request from you as soon as you’re in.`}>
            {(usingMock ? [] : OAUTH_PROVIDERS).map((p) => (
              <Primary key={p.id} label={p.label} busy={busy === p.id} onPress={() => join(p.id)} />
            ))}
            {usingMock ? (
              <Primary label="Continue with email" onPress={() => join()} />
            ) : (
              <Secondary label="Continue with email" onPress={() => join()} />
            )}
          </Panel>
        ) : status === 'needsProfile' ? (
          <Panel title="One more step" text={`Pick the name your friends will see, then we’ll send ${name} your request.`}>
            <Primary
              label="Finish setting up"
              onPress={() => {
                rememberPendingInvite(code);
                router.replace('/onboarding');
              }}
            />
          </Panel>
        ) : r === 'self' ? (
          <Panel title="Share it anywhere" text="Group chats, your bio, a text to one friend.">
            <Primary
              label={copied ? 'Copied' : 'Share invite link'}
              busy={busy === 'share'}
              onPress={() =>
                run('share', async () => {
                  if ((await shareText(inviteMessage(code))) === 'copied') setCopied(true);
                })
              }
            />
          </Panel>
        ) : r === 'none' || r === 'they_asked' ? (
          <Panel
            title={r === 'they_asked' ? `${name} already asked to be friends` : `Add ${name}?`}
            text={r === 'they_asked' ? 'Accept and you can tag each other in photos.' : 'Once they accept, you can tag each other in photos.'}
          >
            <Primary label={r === 'they_asked' ? 'Accept' : 'Send friend request'} busy={busy === 'add'} onPress={add} />
          </Panel>
        ) : (
          <Panel
            title={r === 'friends' ? `You and ${name} are friends` : `Friend request sent to ${name}`}
            text={r === 'friends' ? 'You can tag each other in photos.' : 'You’ll be friends as soon as they accept.'}
            icon
          >
            <Primary label="Go to Proval" onPress={() => router.replace('/')} />
          </Panel>
        )}
      </>
    );
  }

  const content = (
    <View style={[styles.screen, !desktop && { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {!desktop && (
        <View style={styles.brand}>
          <LogoMark size={24} />
          <Text style={styles.logo}>proval</Text>
        </View>
      )}
      {body}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  return desktop ? <FormPage width={480}>{content}</FormPage> : <ScrollView style={{ backgroundColor: colors.bg }}>{content}</ScrollView>;
}

function Panel({ title, text, icon, children }: { title: string; text: string; icon?: boolean; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        {icon && (
          <View style={styles.done}>
            <Icon name="check" size={16} color="#fff" weight={2.6} />
          </View>
        )}
        <Text style={[styles.panelTitle, icon && { flex: 1 }]}>{title}</Text>
      </View>
      <Text style={styles.panelText}>{text}</Text>
      {children}
    </View>
  );
}

function Primary({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={styles.cta}>
      {busy ? <ActivityIndicator color={colors.onInk} /> : <Text style={styles.ctaText}>{label}</Text>}
    </Pressable>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondary}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 10, backgroundColor: colors.bg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  hero: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  h1: { ...type.display, color: colors.ink, textAlign: 'center' },
  sub: { color: colors.muted, lineHeight: 20, textAlign: 'center', maxWidth: 340 },
  panel: { backgroundColor: colors.card, borderRadius: radius.lg - 6, padding: 18, gap: 12 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  done: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.approve, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { ...type.title, color: colors.ink },
  panelText: { color: colors.muted, lineHeight: 20 },
  cta: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: colors.onInk, fontWeight: '700', fontSize: 16 },
  secondary: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  error: { color: colors.deny, marginTop: 6 },
});
