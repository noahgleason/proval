import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { ReviewSheet } from '../components/ReviewSheet';
import { SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import type { Decision, Photo, ReactionId } from '../types';
import { colors, radius } from '../theme';

type Props = { userId: string };

export function QueueScreen({ userId }: Props) {
  const [queue, setQueue] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Decision | null>(null);
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
      <Text style={styles.count}>
        {queue.length === 0
          ? 'All caught up ✨'
          : `You have ${queue.length} photo${queue.length === 1 ? '' : 's'} to review`}
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.deck}>
        {next && <Image source={{ uri: next.imageUrl }} style={styles.behind} />}
        {current ? (
          <SwipeCard key={current.id} ref={card} photo={current} onSwiped={setPending} />
        ) : (
          <View style={[styles.empty]}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>Nothing waiting on you.{'\n'}Your friends can post freely… for now.</Text>
            <Pressable onPress={load} style={styles.refresh}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        )}
      </View>

      {current && (
        <View style={styles.actions}>
          <Pressable onPress={() => card.current?.swipe('deny')} style={[styles.round, { backgroundColor: colors.denySoft }]}>
            <Text style={[styles.roundIcon, { color: colors.deny }]}>✕</Text>
          </Pressable>
          <Pressable onPress={() => card.current?.swipe('approve')} style={[styles.round, { backgroundColor: colors.approveSoft }]}>
            <Text style={[styles.roundIcon, { color: colors.approve }]}>✓</Text>
          </Pressable>
        </View>
      )}

      <ReviewSheet decision={pending} onSend={send} onUndo={() => setPending(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 20, fontWeight: '800', color: colors.ink, marginVertical: 12 },
  error: { color: colors.deny, marginBottom: 8 },
  deck: { flex: 1 },
  behind: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: -10,
    borderRadius: radius.lg,
    opacity: 0.5,
    backgroundColor: colors.line,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: 18 },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  roundIcon: { fontSize: 30, fontWeight: '800' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    marginBottom: 16,
    gap: 10,
  },
  emptyEmoji: { fontSize: 44 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  refresh: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  refreshText: { color: colors.brand, fontWeight: '700' },
});
