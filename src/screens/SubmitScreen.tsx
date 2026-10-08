import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { colors, radius } from '../theme';
import { USERS } from '../users';

type Props = { userId: string; onSubmitted: () => void };

type Picked = { uri: string; base64: string; mimeType: string };

export function SubmitScreen({ userId, onSubmitted }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friends = USERS.filter((u) => u.id !== userId);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.5, // keeps uploads well under the function body limit
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Could not read that photo. Try another one.');
      return;
    }
    setError(null);
    setPicked({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const toggle = (id: string) =>
    setTagged((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const canSend = !!picked && tagged.length > 0 && !busy;

  const send = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api.submit({
        uploaderId: userId,
        caption: caption.trim(),
        taggedIds: tagged,
        imageBase64: picked.base64,
        mimeType: picked.mimeType,
        localUri: picked.uri,
      });
      setPicked(null);
      setCaption('');
      setTagged([]);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Ask before you post</Text>

      <Pressable onPress={pick} style={styles.picker}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={styles.preview} />
        ) : (
          <Text style={styles.pickerText}>＋ Choose a photo</Text>
        )}
      </Pressable>

      <Text style={styles.label}>Who’s in it?</Text>
      <View style={styles.friends}>
        {friends.map((f) => {
          const on = tagged.includes(f.id);
          return (
            <Pressable key={f.id} onPress={() => toggle(f.id)} style={[styles.friend, on && styles.friendOn]}>
              <Avatar userId={f.id} size={28} />
              <Text style={[styles.friendName, on && { color: colors.brand }]}>{f.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Caption (optional)</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="what you're planning to post with it"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={150}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={send} disabled={!canSend} style={[styles.send, !canSend && { opacity: 0.4 }]}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendText}>
            Send for approval{tagged.length ? ` (${tagged.length})` : ''}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { fontSize: 20, fontWeight: '800', color: colors.ink },
  picker: {
    height: 300,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerText: { color: colors.brand, fontWeight: '700', fontSize: 16 },
  preview: { width: '100%', height: '100%' },
  label: { fontWeight: '700', color: colors.ink, marginTop: 4 },
  friends: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  friendOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  friendName: { fontWeight: '600', color: colors.ink },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 12,
    color: colors.ink,
  },
  error: { color: colors.deny },
  send: { marginTop: 8, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
