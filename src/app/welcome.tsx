import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, usingMock } from '../api';
import { Icon, LogoMark, type IconName } from '../components/Icon';
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.brand}>
        <LogoMark size={44} />
        <Text style={styles.logo}>proval</Text>
      </View>
      <Text style={styles.headline}>Ask before{'\n'}you post.</Text>

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

      <View style={{ flex: 1 }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
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
  secondary: { backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center' },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 17 },
});
