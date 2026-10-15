import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage, usingMock } from '../../api';
import { FormPage } from '../../components/DesktopBar';
import { Icon, LogoMark } from '../../components/Icon';
import { useIsDesktop } from '../../components/PhoneFrame';
import { OAUTH_PROVIDERS, signInWithProvider } from '../../lib/auth';
import { linkMessage, rememberPendingLink, shareText } from '../../lib/share';
import { useSession } from '../../session';
import { colors, radius, type } from '../../theme';
import { AUTO_APPROVE_HOURS, type LinkPreview } from '../../types';

type Open = Extract<LinkPreview, { off: false }>;
type Name = NonNullable<Open['guests']>[number];

/**
 * A request's group-chat link. Anyone can open it and see who's asking, with the photos blurred.
 * To see them and answer you sign in and tap your name, which tags you for real; then you answer
 * in Review like everyone else.
 */
export default function LinkPage() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = String(params.token ?? '');
  const { status, userId, me } = useSession();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const [data, setData] = useState<LinkPreview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** The name you tapped, waiting for "Yes, that's me" or "That's not me". */
  const [confirm, setConfirm] = useState<{ name: Name; action: 'claim' | 'dispute' } | null>(null);
  const [copied, setCopied] = useState(false);

  /** Whether answers are past due, worked out when the page loads. */
  const [closed, setClosed] = useState(false);

  const load = useCallback(
    () =>
      api.linkPreview(userId, token).then(
        (d) => {
          setData(d);
          setClosed(!!d && !d.off && Date.now() >= Date.parse(d.closesAt));
        },
        (e) => {
          setError(errorMessage(e));
          setData(null);
        },
      ),
    [userId, token],
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

  const google = (id: (typeof OAUTH_PROVIDERS)[number]['id']) =>
    run(id, async () => {
      rememberPendingLink(token);
      await signInWithProvider(id);
    });
  const email = () => {
    rememberPendingLink(token);
    router.push('/sign-in');
  };
  const claim = (g: Name) =>
    run('claim', async () => {
      await api.claimGuest(userId, token, g.id);
      router.replace('/review');
    });
  const dispute = (g: Name) =>
    run('dispute', async () => {
      await api.disputeGuest(userId, token, g.id);
      setConfirm(null);
      await load();
    });
  const share = (sender: string) =>
    run('share', async () => {
      if ((await shareText(linkMessage(sender, token))) === 'copied') setCopied(true);
    });

  let body: ReactNode;
  if (data === undefined) {
    body = <ActivityIndicator color={colors.ink} style={{ marginTop: 80 }} />;
  } else if (data === null || data.off) {
    body = (
      <Notice
        title={data?.off ? 'This link is turned off' : 'This link doesn’t work'}
        text={data?.off ? `${data.sender} turned this link off. Ask them for a new one.` : 'Check that you copied the whole thing.'}
      />
    );
  } else {
    const many = data.photoCount > 1;
    body = (
      <>
        <Text style={styles.eyebrow}>Before it’s posted</Text>
        <Text style={styles.h1}>
          {data.kind === 'story'
            ? `${data.sender} wants to add a photo to their story`
            : `${data.sender} wants to post ${many ? `${data.photoCount} photos` : 'a photo'}`}
        </Text>
        <Text style={styles.sub}>
          You might be in {many ? 'some of them' : 'it'}. On Proval, nothing gets posted until the people in it say yes.
        </Text>

        <Blurs blurs={data.blurs} />

        {closed ? (
          <Notice
            title="This one’s closed"
            text={`Answers were due within ${AUTO_APPROVE_HOURS} hours, and anyone who didn’t answer counts as a yes.`}
          />
        ) : status !== 'ready' && status !== 'needsProfile' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Sign in to see {many ? 'them' : 'it'} and answer</Text>
            <Text style={styles.panelText}>Takes a few seconds. No password, no app to download.</Text>
            {(usingMock ? [] : OAUTH_PROVIDERS).map((p) => (
              <Pressable key={p.id} onPress={() => google(p.id)} disabled={!!busy} style={styles.cta}>
                {busy === p.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{p.label}</Text>}
              </Pressable>
            ))}
            <Pressable onPress={email} disabled={!!busy} style={usingMock ? styles.cta : styles.secondary}>
              <Text style={usingMock ? styles.ctaText : styles.secondaryText}>Continue with email</Text>
            </Pressable>
          </View>
        ) : status === 'needsProfile' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>One more step</Text>
            <Text style={styles.panelText}>Pick the name your friends will see, then you’ll come right back here.</Text>
            <Pressable
              onPress={() => {
                rememberPendingLink(token);
                router.replace('/onboarding');
              }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Finish setting up</Text>
            </Pressable>
          </View>
        ) : data.viewer?.isSender ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>This is your link</Text>
            <Text style={styles.panelText}>Drop it in the group chat. Each person signs in and taps their name.</Text>
            <Pressable onPress={() => share(me?.name ?? data.sender)} style={styles.cta}>
              {busy === 'share' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{copied ? 'Copied' : 'Share link'}</Text>
              )}
            </Pressable>
            <Pressable onPress={() => router.replace('/')} style={styles.secondary}>
              <Text style={styles.secondaryText}>See who’s answered</Text>
            </Pressable>
          </View>
        ) : data.viewer?.tagged ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {data.viewer.guestId ? `You’re in as ${data.guests?.find((g) => g.id === data.viewer?.guestId)?.name}` : 'You’re tagged in this'}
            </Text>
            <Text style={styles.panelText}>Your photos are waiting in Review.</Text>
            <Pressable onPress={() => router.replace('/review')} style={styles.cta}>
              <Text style={styles.ctaText}>Answer now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Which one is you?</Text>
            {!data.guests?.length && (
              <Text style={styles.panelText}>
                {data.sender} didn’t tag anyone by name on this one. If you’re in it, ask them to tag you.
              </Text>
            )}
            {data.guests?.map((g) => {
              const open = confirm?.name.id === g.id;
              return (
                <View key={g.id} style={[styles.name, open && styles.nameOpen]}>
                  <View style={styles.nameRow}>
                    <View style={[styles.initial, g.claimed && { backgroundColor: colors.muted }]}>
                      <Text style={styles.initialText}>{g.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.nameText, g.claimed && { color: colors.muted }]}>{g.name}</Text>
                      {g.claimed && (
                        <Text style={styles.nameHint}>
                          {g.flaggedByMe ? `You flagged this. ${data.sender} will sort it out.` : 'Taken'}
                        </Text>
                      )}
                    </View>
                    {!open &&
                      (g.claimed ? (
                        !g.flaggedByMe && (
                          <Pressable onPress={() => setConfirm({ name: g, action: 'dispute' })} style={styles.small}>
                            <Text style={styles.smallText}>That’s not me</Text>
                          </Pressable>
                        )
                      ) : (
                        <Pressable onPress={() => setConfirm({ name: g, action: 'claim' })} style={[styles.small, styles.smallOn]}>
                          <Text style={[styles.smallText, { color: '#fff' }]}>That’s me</Text>
                        </Pressable>
                      ))}
                  </View>
                  {open && (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.panelText}>
                        {confirm.action === 'claim'
                          ? `You’re ${g.name}? ${data.sender} will see your Proval name next to it, and you two become friends.`
                          : `Someone else picked ${g.name}. If that’s you, ${data.sender} gets a heads-up and picks who’s right.`}
                      </Text>
                      <View style={styles.confirmRow}>
                        <Pressable onPress={() => setConfirm(null)} style={[styles.secondary, { flex: 1 }]}>
                          <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => (confirm.action === 'claim' ? claim(g) : dispute(g))}
                          disabled={!!busy}
                          style={[styles.cta, { flex: 1 }]}
                        >
                          {busy ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.ctaText}>{confirm.action === 'claim' ? 'Yes, that’s me' : 'Flag it'}</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <Text style={styles.nameHint}>Not on the list? Ask {data.sender} to add you.</Text>
          </View>
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

  return desktop ? <FormPage width={520}>{content}</FormPage> : <ScrollView style={{ backgroundColor: colors.bg }}>{content}</ScrollView>;
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelText}>{text}</Text>
      <Pressable onPress={() => router.replace('/')} style={styles.secondary}>
        <Text style={styles.secondaryText}>Go to Proval</Text>
      </Pressable>
    </View>
  );
}

/** The photos, unrecognizable: each is a ~24px copy, stretched and blurred. */
function Blurs({ blurs }: { blurs: (string | null)[] }) {
  const one = blurs.length === 1;
  return (
    <View>
      <ScrollView horizontal={!one} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blurs}>
        {blurs.map((b, i) => (
          <View key={i} style={one ? styles.blurOne : styles.blurTile}>
            {b ? <Image source={{ uri: b }} blurRadius={14} style={styles.blurImage} /> : <View style={styles.blurBlank} />}
          </View>
        ))}
      </ScrollView>
      <View style={styles.lock} pointerEvents="none">
        <Icon name="lock" size={14} color="#fff" weight={2.4} />
        <Text style={styles.lockText}>Hidden until you pick your name</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 10, backgroundColor: colors.bg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  sub: { color: colors.muted, lineHeight: 20, marginBottom: 6 },
  blurs: { gap: 8 },
  blurOne: { width: '100%', aspectRatio: 4 / 5, maxHeight: 420, borderRadius: radius.lg, overflow: 'hidden' },
  blurTile: { width: 120, height: 150, borderRadius: radius.md, overflow: 'hidden' },
  blurImage: { width: '100%', height: '100%', transform: [{ scale: 1.2 }] },
  blurBlank: { flex: 1, backgroundColor: colors.line },
  lock: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  lockText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  panel: { backgroundColor: colors.card, borderRadius: radius.lg - 6, padding: 18, gap: 12, marginTop: 10 },
  panelTitle: { ...type.title, color: colors.ink },
  panelText: { color: colors.muted, lineHeight: 20 },
  cta: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  name: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12, gap: 12 },
  nameOpen: {},
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initial: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nameText: { fontWeight: '700', fontSize: 16, color: colors.ink },
  nameHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  small: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  smallOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  smallText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  error: { color: colors.deny, marginTop: 6 },
});
