import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, usingMock } from '../api';
import { FormPage } from '../components/DesktopBar';
import { Icon } from '../components/Icon';
import { useSession } from '../session';
import { colors, radius, type } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { sendCode, verifyCode } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    run(async () => {
      await sendCode(email);
      setStep('code');
    });
  const submitCode = () => run(() => verifyCode(email, code));

  const canSubmit = !busy && (step === 'email' ? EMAIL_RE.test(email.trim()) : code.length === 6);

  return (
    <FormPage>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          onPress={() => (step === 'code' ? setStep('email') : router.back())}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <Icon name="undo" size={20} color={colors.ink} weight={2} />
        </Pressable>

        <Text style={styles.eyebrow}>{step === 'email' ? 'Sign in or sign up' : 'Check your email'}</Text>
        <Text style={styles.h1}>{step === 'email' ? 'What’s your email?' : 'Enter the code'}</Text>
        <Text style={styles.sub}>
          {step === 'email'
            ? 'We’ll send you a 6-digit code. No passwords.'
            : `We sent a code to ${email.trim()}. It expires in 10 minutes.`}
        </Text>

        {step === 'email' ? (
          <TextInput
            key="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
            onSubmitEditing={() => canSubmit && submitEmail()}
          />
        ) : (
          <TextInput
            key="code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.code]}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            onSubmitEditing={() => canSubmit && submitCode()}
          />
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {usingMock && <Text style={styles.hint}>Demo mode: any email works, and any 6 digits sign you in as Ava.</Text>}
        {step === 'code' && (
          <Pressable onPress={submitEmail} disabled={busy} style={styles.resend}>
            <Text style={styles.resendText}>Send a new code</Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />
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
        <Pressable
          onPress={step === 'email' ? submitEmail : submitCode}
          disabled={!canSubmit}
          style={[styles.cta, !canSubmit && { opacity: 0.4 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{step === 'email' ? 'Send code' : 'Sign in'}</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </FormPage>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, gap: 10 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  sub: { color: colors.muted, lineHeight: 20, marginBottom: 12 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
    color: colors.ink,
  },
  code: { fontSize: 28, letterSpacing: 10, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.deny },
  hint: { color: colors.muted, fontSize: 13 },
  resend: { alignSelf: 'flex-start', paddingVertical: 6 },
  resendText: { color: colors.brand, fontWeight: '700' },
  legal: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  cta: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
