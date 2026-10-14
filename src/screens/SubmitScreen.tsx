import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { desktopPage, useIsDesktop } from '../components/PhoneFrame';
import { PostPreview } from '../components/PostPreview';
import { useLoader } from '../hooks/useLoader';
import { shrinkPhoto, type ShrunkPhoto } from '../lib/shrinkPhoto';
import { colors, radius, type } from '../theme';
import { AUTO_APPROVE_HOURS, MAX_POST_PHOTOS, type RequestKind } from '../types';
import { userById } from '../users';

type Props = { userId: string; onSubmitted: () => void };

/** A picked photo and who's in it. */
type Shot = ShrunkPhoto & { tagged: string[] };

const KINDS: { id: RequestKind; label: string; hint: string }[] = [
  { id: 'post', label: 'Post', hint: `Up to ${MAX_POST_PHOTOS} photos, like an Instagram post. Tag who’s in each one.` },
  { id: 'story', label: 'Story', hint: 'One photo for your story.' },
];

export function SubmitScreen({ userId, onSubmitted }: Props) {
  const [kind, setKind] = useState<RequestKind>('post');
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState(0);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const desktop = useIsDesktop();

  // Refreshes on focus, so friends you just added show up.
  const fetchFriends = useCallback(async () => (await api.friends(userId)).friends, [userId]);
  const { data: friendIds, loading: loadingFriends } = useLoader<string[]>(fetchFriends, []);
  const friends = friendIds.map(userById);

  const max = kind === 'story' ? 1 : MAX_POST_PHOTOS;
  const current = shots[Math.min(active, shots.length - 1)];
  const everyone = [...new Set(shots.flatMap((s) => s.tagged))];

  const pick = async () => {
    const room = max - (kind === 'story' ? 0 : shots.length);
    if (room <= 0) return;
    // Full quality here; shrinkPhoto does the one resize and compression.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
      allowsMultipleSelection: kind === 'post' && room > 1,
      selectionLimit: room,
      orderedSelection: true,
    });
    if (result.canceled) return;
    setError(null);
    setNotice(null);
    setReading(true);
    try {
      const added: Shot[] = [];
      for (const a of result.assets.slice(0, room)) added.push({ ...(await shrinkPhoto(a.uri, a.width, a.height)), tagged: [] });
      if (kind === 'story') {
        setShots(added.slice(0, 1));
        setActive(0);
      } else {
        setShots((s) => [...s, ...added]);
        setActive(shots.length); // the first new one
      }
    } catch (e) {
      setError(errorMessage(e, 'Could not read that photo. Try another one.'));
    } finally {
      setReading(false);
    }
  };

  const switchKind = (k: RequestKind) => {
    if (k === kind) return;
    setKind(k);
    setNotice(null);
    if (k === 'story' && shots.length > 1) {
      setShots([current]);
      setActive(0);
      setNotice('Story requests are one photo, so only the photo you were on is kept.');
    }
  };

  const toggle = (id: string) =>
    setShots((all) =>
      all.map((s, i) => (i !== active ? s : { ...s, tagged: s.tagged.includes(id) ? s.tagged.filter((x) => x !== id) : [...s.tagged, id] })),
    );

  const remove = () => {
    setShots((all) => all.filter((_, i) => i !== active));
    setActive((a) => Math.max(0, Math.min(a, shots.length - 2)));
  };

  const move = (by: -1 | 1) => {
    const to = active + by;
    if (to < 0 || to >= shots.length) return;
    setShots((all) => {
      const next = [...all];
      [next[active], next[to]] = [next[to], next[active]];
      return next;
    });
    setActive(to);
  };

  const canSend = shots.length > 0 && everyone.length > 0 && !busy && !reading;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      await api.submit({
        uploaderId: userId,
        kind,
        caption: caption.trim(),
        photos: shots.map((s) => ({ taggedIds: s.tagged, imageBase64: s.base64, mimeType: s.mimeType, localUri: s.uri })),
      });
      setShots([]);
      setActive(0);
      setCaption('');
      setNotice(null);
      onSubmitted();
    } catch (e) {
      setError(errorMessage(e, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const kindToggle = (
    <View style={{ gap: 8 }}>
      <View style={styles.kinds}>
        {KINDS.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => switchKind(k.id)}
            style={[styles.kind, kind === k.id && styles.kindOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === k.id }}
          >
            <Text style={[styles.kindText, kind === k.id && { color: '#fff' }]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{KINDS.find((k) => k.id === kind)!.hint}</Text>
    </View>
  );

  const pickerEl = (
    <View style={[styles.pickerCol, desktop && styles.pickerColDesktop]}>
      {current ? (
        <View style={[styles.picker, desktop ? styles.pickerDesktop : styles.pickerMobile]}>
          <Image source={{ uri: current.uri }} style={styles.preview} />
          {shots.length > 1 && (
            <View style={styles.position}>
              <Text style={styles.positionText}>
                {active + 1}/{shots.length}
              </Text>
            </View>
          )}
          <Pressable onPress={remove} style={styles.removeBtn} accessibilityLabel="Remove this photo" hitSlop={8}>
            <Icon name="x" size={16} color="#fff" weight={2.6} />
          </Pressable>
          {kind === 'story' && (
            <Pressable onPress={pick} style={styles.replaceBtn}>
              <Icon name="image" size={15} color={colors.ink} weight={2} />
              <Text style={styles.replaceText}>Change photo</Text>
            </Pressable>
          )}
          {shots.length > 1 && (
            <View style={styles.moveRow}>
              <Pressable
                onPress={() => move(-1)}
                disabled={active === 0}
                style={[styles.moveBtn, active === 0 && { opacity: 0.35 }]}
                accessibilityLabel="Move earlier"
              >
                <Icon name="chevronLeft" size={18} color={colors.ink} weight={2.4} />
              </Pressable>
              <Text style={styles.moveText}>Move</Text>
              <Pressable
                onPress={() => move(1)}
                disabled={active === shots.length - 1}
                style={[styles.moveBtn, active === shots.length - 1 && { opacity: 0.35 }]}
                accessibilityLabel="Move later"
              >
                <Icon name="chevronRight" size={18} color={colors.ink} weight={2.4} />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <Pressable onPress={pick} style={[styles.picker, desktop ? styles.pickerDesktop : styles.pickerMobile]}>
          {reading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <View style={styles.pickerEmpty}>
              <View style={styles.pickerIcon}>
                <Icon name="image" size={26} color={colors.ink} />
              </View>
              <Text style={styles.pickerText}>{kind === 'post' ? 'Choose photos' : 'Choose a photo'}</Text>
              <Text style={styles.pickerHint}>Nobody sees {kind === 'post' ? 'them' : 'it'} until you send</Text>
            </View>
          )}
        </Pressable>
      )}

      {kind === 'post' && shots.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {shots.map((s, i) => (
            <Pressable
              key={s.uri + i}
              onPress={() => setActive(i)}
              style={[styles.thumbWrap, i === active && styles.thumbOn]}
              accessibilityLabel={`Photo ${i + 1}`}
            >
              <Image source={{ uri: s.uri }} style={styles.thumb} />
              <View style={[styles.tagCount, !s.tagged.length && { backgroundColor: colors.muted }]}>
                <Icon name="users" size={10} color="#fff" weight={2.4} />
                <Text style={styles.tagCountText}>{s.tagged.length}</Text>
              </View>
            </Pressable>
          ))}
          {shots.length < MAX_POST_PHOTOS && (
            <Pressable onPress={pick} style={[styles.thumbWrap, styles.addThumb]} accessibilityLabel="Add photos">
              {reading ? <ActivityIndicator color={colors.ink} /> : <Icon name="plus" size={22} color={colors.ink} weight={2.2} />}
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );

  const formEl = (
    <>
      <Text style={styles.label}>{kind === 'post' && shots.length > 1 ? `Who’s in photo ${active + 1}` : 'Who’s in it'}</Text>
      {!loadingFriends && friendIds.length === 0 && (
        <Text style={styles.hint}>No friends yet. Add some from your profile ({desktop ? 'click' : 'tap'} your name up top).</Text>
      )}
      {!current && friendIds.length > 0 && <Text style={styles.hint}>Choose {kind === 'post' ? 'photos' : 'a photo'} first.</Text>}
      {!!current && (
        <View style={styles.friends}>
          {friends.map((f) => {
            const on = current.tagged.includes(f.id);
            return (
              <Pressable key={f.id} onPress={() => toggle(f.id)} style={[styles.friend, on && styles.friendOn]}>
                <Avatar userId={f.id} size={28} />
                <Text style={[styles.friendName, on && { color: '#fff' }]}>{f.name}</Text>
                {on && <Icon name="check" size={14} color="#fff" weight={2.6} />}
              </Pressable>
            );
          })}
        </View>
      )}
      {kind === 'post' && shots.length > 1 && (
        <Text style={styles.hint}>Each person only reviews the photos they’re in, and can open the whole post if they want.</Text>
      )}

      <Text style={styles.label}>Caption · optional</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="what you're planning to post with it"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={500}
        multiline
      />

      {!!notice && <Text style={styles.hint}>{notice}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.note}>
        <Icon name="clock" size={15} color={colors.muted} weight={2} />
        <Text style={styles.noteText}>Anyone who doesn’t answer within {AUTO_APPROVE_HOURS}h counts as a yes.</Text>
      </View>

      {shots.length > 0 && (
        <Pressable onPress={() => setPreviewing(true)} style={styles.previewBtn}>
          <Icon name="eye" size={18} color={colors.ink} weight={2} />
          <Text style={styles.previewText}>{kind === 'post' && shots.length > 1 ? 'Preview post' : `Preview ${kind}`}</Text>
        </Pressable>
      )}

      <Pressable onPress={send} disabled={!canSend} style={[styles.send, !canSend && { opacity: 0.4 }]}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.sendText}>
              {everyone.length ? `Ask ${everyone.length} ${everyone.length === 1 ? 'friend' : 'friends'}` : 'Send for approval'}
            </Text>
            <Icon name="send" size={18} color="#fff" weight={2.2} />
          </>
        )}
      </Pressable>
    </>
  );

  return (
    <ScrollView contentContainerStyle={[styles.wrap, desktop && styles.wrapDesktop]} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Text style={styles.eyebrow}>New request</Text>
        <Text style={[styles.h1, desktop && styles.h1Desktop]}>Ask first</Text>
      </View>

      {desktop ? (
        <View style={styles.columns}>
          {pickerEl}
          <View style={styles.form}>
            {kindToggle}
            {formEl}
          </View>
        </View>
      ) : (
        <>
          {kindToggle}
          {pickerEl}
          {formEl}
        </>
      )}
      <PostPreview
        key={`${previewing}-${active}`}
        post={
          previewing && shots.length
            ? { uploaderId: userId, kind, caption: caption.trim(), photos: shots.map((s) => ({ imageUrl: s.uri, taggedIds: s.tagged })) }
            : null
        }
        viewerId={userId}
        startIndex={active}
        onClose={() => setPreviewing(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  wrapDesktop: { ...desktopPage, paddingTop: 20, paddingBottom: 64, gap: 20 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 40 },
  form: { flex: 1, maxWidth: 520, gap: 12 },
  head: { marginTop: 14, marginBottom: 4, gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  h1Desktop: { fontSize: 40, letterSpacing: -1.6 },
  picker: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerMobile: { height: 320 },
  pickerDesktop: { width: '100%', aspectRatio: 4 / 5, borderWidth: 1, borderColor: colors.line },
  pickerCol: { gap: 10 },
  pickerColDesktop: { width: '45%', maxWidth: 440 },
  kinds: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  kind: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: radius.pill },
  kindOn: { backgroundColor: colors.ink },
  kindText: { fontWeight: '700', color: colors.ink },
  position: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  positionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  replaceText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  moveRow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  moveBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  moveText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  strip: { gap: 8, paddingVertical: 2 },
  thumbWrap: { width: 56, height: 70, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.brand },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.line },
  addThumb: { borderColor: colors.line, borderStyle: 'dashed', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tagCount: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
  },
  tagCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
    paddingTop: 14,
    minHeight: 52,
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
