import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../api';
import { USERNAME_RE, useSession } from '../session';
import { colors, radius, type } from '../theme';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { createProfile, signOut } = useSession();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = username.trim().toLowerCase();
  const handleOk = USERNAME_RE.test(handle);
  const canSubmit = !busy && name.trim().length > 0 && handleOk;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createProfile({ name, username: handle });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 16 }]}
    >
      <Text style={styles.eyebrow}>Almost there</Text>
      <Text style={styles.h1}>Who are you?</Text>
      <Text style={styles.sub}>Friends find you by your name or username.</Text>

      <View style={styles.preview}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View>
          <Text style={styles.previewName}>{name.trim() || 'Your name'}</Text>
          <Text style={styles.previewHandle}>@{handle || 'username'}</Text>
        </View>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="First name is fine"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={40}
        autoComplete="given-name"
        autoFocus
      />
      <Text style={styles.label}>Username</Text>
      <View style={styles.handleRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="username"
          placeholderTextColor={colors.muted}
          style={[styles.input, { flex: 1, paddingLeft: 4 }]}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => canSubmit && submit()}
        />
      </View>
      <Text style={[styles.hint, handle && !handleOk && { color: colors.deny }]}>
        3–20 characters: letters, numbers, underscores.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flex: 1 }} />
      <Pressable onPress={submit} disabled={!canSubmit} style={[styles.cta, !canSubmit && { opacity: 0.4 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Continue</Text>}
      </Pressable>
      <Pressable onPress={signOut} style={styles.out}>
        <Text style={styles.outText}>Use a different email</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, gap: 8 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  sub: { color: colors.muted, lineHeight: 20 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md + 2,
    padding: 14,
    marginVertical: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#fff', fontWeight: '700', fontSize: 20 },
  previewName: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  previewHandle: { color: colors.muted, marginTop: 1 },
  label: { ...type.label, color: colors.muted, marginTop: 6 },
  input: { backgroundColor: colors.card, borderRadius: radius.md, padding: 15, fontSize: 16, color: colors.ink },
  handleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingLeft: 15 },
  at: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.deny },
  cta: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  out: { alignItems: 'center', paddingVertical: 10 },
  outText: { color: colors.muted, fontWeight: '600' },
});
