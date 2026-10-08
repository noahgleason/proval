import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { PostPreview } from '../components/PostPreview';
import { useLoader } from '../hooks/useLoader';
import { colors, radius, type } from '../theme';
import { AUTO_APPROVE_HOURS } from '../types';
import { userById } from '../users';

type Props = { userId: string; onSubmitted: () => void };

type Picked = { uri: string; base64: string; mimeType: string };

export function SubmitScreen({ userId, onSubmitted }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);

  // Refreshes on focus, so friends you just added show up.
  const fetchFriends = useCallback(async () => (await api.friends(userId)).friends, [userId]);
  const { data: friendIds, loading: loadingFriends } = useLoader<string[]>(fetchFriends, []);
  const friends = friendIds.map(userById);

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
      setError(errorMessage(e, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Text style={styles.eyebrow}>New request</Text>
        <Text style={styles.h1}>Ask first</Text>
      </View>

      <Pressable onPress={pick} style={styles.picker}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={styles.preview} />
        ) : (
          <View style={styles.pickerEmpty}>
            <View style={styles.pickerIcon}>
              <Icon name="image" size={26} color={colors.ink} />
            </View>
            <Text style={styles.pickerText}>Choose a photo</Text>
            <Text style={styles.pickerHint}>Nobody sees it until you send</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Who’s in it</Text>
      {!loadingFriends && friendIds.length === 0 && (
        <Text style={styles.hint}>No friends yet. Add some from your profile (tap your name up top).</Text>
      )}
      <View style={styles.friends}>
        {friends.map((f) => {
          const on = tagged.includes(f.id);
          return (
            <Pressable key={f.id} onPress={() => toggle(f.id)} style={[styles.friend, on && styles.friendOn]}>
              <Avatar userId={f.id} size={28} />
              <Text style={[styles.friendName, on && { color: '#fff' }]}>{f.name}</Text>
              {on && <Icon name="check" size={14} color="#fff" weight={2.6} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Caption · optional</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="what you're planning to post with it"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={150}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.note}>
        <Icon name="clock" size={15} color={colors.muted} weight={2} />
        <Text style={styles.noteText}>Anyone who doesn’t answer within {AUTO_APPROVE_HOURS}h counts as a yes.</Text>
      </View>

      {picked && (
        <Pressable onPress={() => setPreviewing(true)} style={styles.previewBtn}>
          <Icon name="eye" size={18} color={colors.ink} weight={2} />
          <Text style={styles.previewText}>Preview post</Text>
        </Pressable>
      )}

      <Pressable onPress={send} disabled={!canSend} style={[styles.send, !canSend && { opacity: 0.4 }]}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.sendText}>
              {tagged.length ? `Ask ${tagged.length} ${tagged.length === 1 ? 'friend' : 'friends'}` : 'Send for approval'}
            </Text>
            <Icon name="send" size={18} color="#fff" weight={2.2} />
          </>
        )}
      </Pressable>
      <PostPreview
        post={
          previewing && picked
            ? { uploaderId: userId, caption: caption.trim(), taggedIds: tagged, imageUrl: picked.uri }
            : null
        }
        viewerId={userId}
        onClose={() => setPreviewing(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  head: { marginTop: 14, marginBottom: 4, gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  picker: {
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerEmpty: { alignItems: 'center', gap: 6 },
  pickerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pickerText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  pickerHint: { color: colors.muted, fontSize: 13 },
  preview: { width: '100%', height: '100%' },
  label: { ...type.label, color: colors.muted, marginTop: 10 },
  friends: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  friendOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  friendName: { fontWeight: '600', color: colors.ink },
  input: {
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: 14,
    color: colors.ink,
  },
  error: { color: colors.deny },
  hint: { color: colors.muted, lineHeight: 19 },
  previewBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 15,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  previewText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noteText: { color: colors.muted, fontSize: 13, flex: 1 },
  send: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 17,
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
