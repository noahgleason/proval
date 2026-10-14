import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, usingMock } from '../api';
import { DesktopBar } from '../components/DesktopBar';
import { Icon, LogoMark, type IconName } from '../components/Icon';
import { desktopPage, useIsDesktop } from '../components/PhoneFrame';
import { OAUTH_PROVIDERS, signInWithProvider } from '../lib/auth';
import { AUTO_APPROVE_HOURS } from '../types';
import { colors, radius, type } from '../theme';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'send', title: 'Send it first', body: 'Before you post, send the photo to everyone in it.' },
  { icon: 'cards', title: 'They swipe', body: 'Yes or no, with a note like “crop me out” or “use the other one.”' },
  {
    icon: 'check',
    title: 'Post with a clear conscience',
    body: `Everyone said yes, or stayed quiet for ${AUTO_APPROVE_HOURS} hours. One no means don’t.`,
  },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = usingMock ? [] : OAUTH_PROVIDERS;
  const desktop = useIsDesktop();

  const signIn = async (id: (typeof OAUTH_PROVIDERS)[number]['id']) => {
    setBusy(id);
    setError(null);
    try {
      await signInWithProvider(id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const stepList = (
    <View style={styles.steps}>
      {STEPS.map((s) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.stepIcon}>
            <Icon name={s.icon} size={20} color={colors.ink} weight={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const actions = (
    <>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.ctas}>
        {providers.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => signIn(p.id)}
            disabled={!!busy}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            {busy === p.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{p.label}</Text>}
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push('/sign-in')}
          disabled={!!busy}
          style={({ pressed }) => [providers.length ? styles.secondary : styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={providers.length ? styles.secondaryText : styles.ctaText}>
            {providers.length ? 'Continue with email' : 'Get started'}
          </Text>
        </Pressable>
      </View>
    </>
  );

  if (desktop) {
    return (
      <View style={styles.page}>
        <DesktopBar />
        <ScrollView contentContainerStyle={styles.landing}>
          <View style={styles.pitch}>
            <Text style={[styles.headline, styles.headlineDesktop]}>Ask before{'\n'}you post.</Text>
            <Text style={styles.lede}>
              Send a photo to everyone in it before it goes on Instagram. They approve or deny it in a tap.
            </Text>
            {stepList}
          </View>
          <View style={styles.authCard}>
            <Text style={styles.cardTitle}>Get started</Text>
            <Text style={styles.cardSub}>Sign in or create an account. No passwords.</Text>
            {actions}
            <Text style={styles.legal}>
              By continuing you agree to the{' '}
              <Link href="/legal/terms" style={styles.legalLink}>
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" style={styles.legalLink}>
                Privacy Policy
              </Link>
              .
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.brand}>
        <LogoMark size={44} />
        <Text style={styles.logo}>proval</Text>
      </View>
      <Text style={styles.headline}>Ask before{'\n'}you post.</Text>

      {stepList}

      <View style={{ flex: 1 }} />
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  page: { flex: 1, backgroundColor: colors.bg },
  landing: { ...desktopPage, flexDirection: 'row', alignItems: 'center', gap: 80, paddingVertical: 72 },
  pitch: { flex: 1, maxWidth: 600 },
  headlineDesktop: { fontSize: 72, lineHeight: 72, letterSpacing: -3.2, marginTop: 0 },
  lede: { fontSize: 19, lineHeight: 28, color: colors.muted, marginTop: 20, maxWidth: 520 },
  authCard: {
    width: 420,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 32,
    gap: 8,
  },
  cardTitle: { ...type.title, color: colors.ink },
  cardSub: { color: colors.muted, marginBottom: 16 },
  legal: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  legalLink: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -1.2 },
  headline: { fontSize: 46, lineHeight: 48, fontWeight: '800', letterSpacing: -2, color: colors.ink, marginTop: 36 },
  steps: { gap: 22, marginTop: 40 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { ...type.title, fontSize: 17, letterSpacing: -0.3, color: colors.ink },
  stepBody: { color: colors.muted, lineHeight: 20, marginTop: 2 },
  error: { color: colors.deny, marginBottom: 12 },
  ctas: { gap: 10 },
  cta: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  secondary: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 17,
    alignItems: 'center',
  },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 17 },
});
