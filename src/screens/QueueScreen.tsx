import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../api';
import { ActionSheet } from '../components/ActionSheet';
import { Icon } from '../components/Icon';
import { PostPreview } from '../components/PostPreview';
import { ReviewSheet } from '../components/ReviewSheet';
import { SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import { useLoader } from '../hooks/useLoader';
import { showAlert } from '../lib/alert';
import { REPORT_REASONS, type Decision, type Photo, type ReactionId, type User } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';

type Props = { userId: string };
type Menu = null | 'more' | 'report';

export function QueueScreen({ userId }: Props) {
  const fetchQueue = useCallback(() => api.queue(userId), [userId]);
  const { data: queue, setData: setQueue, loading, error, setError, reload } = useLoader<Photo[]>(fetchQueue, []);
  const [pending, setPending] = useState<Decision | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const card = useRef<SwipeCardHandle>(null);

  const current = queue[0];
  const next = queue[1];

  const send = async (reaction?: ReactionId, comment?: string) => {
    if (!current || !pending) return;
    const decision = pending;
    setPending(null);
    setNotice(null);
    setQueue((q) => q.slice(1)); // optimistic
    try {
      await api.review({ photoId: current.id, reviewerId: userId, decision, reaction, comment });
    } catch (e) {
      setError(errorMessage(e, 'Could not send your answer'));
      reload();
    }
  };

  const report = async (reason: string) => {
    if (!current) return;
    const photo = current;
    setQueue((q) => q.filter((p) => p.id !== photo.id));
    try {
      await api.report({ reporterId: userId, reason, photoId: photo.id, userId: photo.uploaderId });
      // Reporting also says no, so the photo can't auto-approve with you in it.
      await api.review({ photoId: photo.id, reviewerId: userId, decision: 'deny' });
      setNotice('Reported. We also told them not to post it.');
    } catch (e) {
      setError(errorMessage(e, 'Could not send the report'));
      reload();
    }
  };

  const block = () => {
    if (!current) return;
    const other = userById(current.uploaderId);
    // Let the menu finish closing first; iOS won't show an alert over a dismissing modal.
    setTimeout(() => confirmBlock(other), 300);
  };

  const confirmBlock = (other: User) => {
    showAlert(`Block ${other.name}?`, 'They won’t be able to find you, add you, or send you photos. They aren’t told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          setQueue((q) => q.filter((p) => p.uploaderId !== other.id));
          try {
            await api.block(userId, other.id);
            setNotice(`${other.name} is blocked.`);
          } catch (e) {
            setError(errorMessage(e, 'Could not block'));
            reload();
          }
        },
      },
    ]);
  };

  if (loading && queue.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
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
      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.deck}>
        {next && <Image source={{ uri: next.imageUrl }} style={styles.behind} />}
        {current ? (
          <SwipeCard
            key={current.id}
            ref={card}
            photo={current}
            onSwiped={setPending}
            onPreview={() => setPreviewing(true)}
            onMore={() => setMenu('more')}
          />
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="inbox" size={28} color={colors.muted} />
            </View>
            <Text style={styles.emptyText}>Nothing waiting on you.{'\n'}Your friends can post freely, for now.</Text>
            <Pressable onPress={reload} style={styles.refresh}>
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
        key={`${current?.id}-${pending}`}
        decision={pending}
        askerName={current ? userById(current.uploaderId).name : ''}
        onSend={send}
        onUndo={() => setPending(null)}
      />
      {/* One sheet whose options change, so two modals never animate at once. */}
      <ActionSheet
        visible={menu !== null && !!current}
        title={menu === 'report' ? 'Why are you reporting this?' : undefined}
        onClose={() => setMenu(null)}
        options={
          !current
            ? []
            : menu === 'report'
              ? REPORT_REASONS.map((r) => ({ label: r, onPress: () => report(r) }))
              : [
                  { label: 'Report photo', icon: 'alert', destructive: true, onPress: () => setMenu('report') },
                  { label: `Block ${userById(current.uploaderId).name}`, icon: 'x', destructive: true, onPress: block },
                ]
        }
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
  notice: { color: colors.muted, marginBottom: 8 },
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
