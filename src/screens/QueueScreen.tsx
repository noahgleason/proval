import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { PostPreview } from '../components/PostPreview';
import { ReviewSheet } from '../components/ReviewSheet';
import { SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import type { Decision, Photo, ReactionId } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';

type Props = { userId: string };

export function QueueScreen({ userId }: Props) {
  const [queue, setQueue] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Decision | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const card = useRef<SwipeCardHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQueue(await api.queue(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load photos');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[0];
  const next = queue[1];

  const send = async (reaction?: ReactionId, comment?: string) => {
    if (!current || !pending) return;
    const decision = pending;
    setPending(null);
    setQueue((q) => q.slice(1)); // optimistic
    try {
      await api.review({ photoId: current.id, reviewerId: userId, decision, reaction, comment });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send review');
      setQueue((q) => [current, ...q]);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{queue.length === 0 ? 'Inbox zero' : `${queue.length} waiting on you`}</Text>
        <Text style={styles.h1}>{queue.length === 0 ? 'All caught up' : 'Your call'}</Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.deck}>
        {next && <Image source={{ uri: next.imageUrl }} style={styles.behind} />}
        {current ? (
          <SwipeCard key={current.id} ref={card} photo={current} onSwiped={setPending} onPreview={() => setPreviewing(true)} />
        ) : (
          <View style={[styles.empty]}>
            <View style={styles.emptyIcon}>
              <Icon name="inbox" size={28} color={colors.muted} />
            </View>
            <Text style={styles.emptyText}>Nothing waiting on you.{'\n'}Your friends can post freely, for now.</Text>
            <Pressable onPress={load} style={styles.refresh}>
              <Icon name="refresh" size={16} color={colors.ink} weight={2} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        )}
      </View>

      {current && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => card.current?.swipe('deny')}
            style={({ pressed }) => [styles.round, styles.denyBtn, pressed && styles.pressed]}
            accessibilityLabel="Deny"
          >
            <Icon name="x" size={26} color={colors.deny} weight={2.4} />
          </Pressable>
          <Pressable
            onPress={() => card.current?.swipe('approve')}
            style={({ pressed }) => [styles.round, styles.approveBtn, pressed && styles.pressed]}
            accessibilityLabel="Approve"
          >
            <Icon name="check" size={28} color="#fff" weight={2.4} />
          </Pressable>
        </View>
      )}

      <PostPreview
        post={previewing ? (current ?? null) : null}
        viewerId={userId}
        onClose={() => setPreviewing(false)}
        onDecide={(d) => {
          setPreviewing(false);
          card.current?.swipe(d);
        }}
      />
      <ReviewSheet
        decision={pending}
        askerName={current ? userById(current.uploaderId).name : ''}
        onSend={send}
        onUndo={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { marginTop: 14, marginBottom: 16, gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  error: { color: colors.deny, marginBottom: 8 },
  deck: { flex: 1 },
  behind: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    bottom: -12,
    borderRadius: radius.lg,
    opacity: 0.35,
    backgroundColor: colors.line,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingTop: 26, paddingBottom: 14 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  denyBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  approveBtn: { backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginBottom: 16,
    gap: 14,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  refreshText: { color: colors.ink, fontWeight: '600' },
});
