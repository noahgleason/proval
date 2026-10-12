import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, errorMessage } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon, REACTION_ICON, type IconName } from '../components/Icon';
import { useLoader } from '../hooks/useLoader';
import { showAlert } from '../lib/alert';
import { answerOf, reactionFor, statusOf, timeLeft, type Answer, type Photo, type PhotoStatus } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';
import { PhoneFrame, useScreenWidth } from '../components/PhoneFrame';

type Props = { userId: string };
type Layout = 'grid' | 'list';

const STATUS: Record<PhotoStatus, { label: string; short: string; icon: IconName; fg: string; bg: string }> = {
  approved: { label: 'Cleared to post', short: 'Cleared', icon: 'check', fg: colors.approve, bg: colors.approveSoft },
  pending: { label: 'Waiting', short: 'Waiting', icon: 'clock', fg: colors.pending, bg: colors.pendingSoft },
  denied: { label: 'Don’t post', short: 'Blocked', icon: 'x', fg: colors.deny, bg: colors.denySoft },
};
const ORDER: PhotoStatus[] = ['approved', 'pending', 'denied'];

const ANSWER: Record<Answer, { text: string; color: string }> = {
  approve: { text: 'approved', color: colors.approve },
  deny: { text: 'denied', color: colors.deny },
  auto: { text: 'auto-approved', color: colors.muted },
  waiting: { text: 'hasn’t answered', color: colors.pending },
};

const GAP = 6;
const GUTTER = 20;

/** Everything you've asked about: what's cleared, what's waiting, what got blocked. */
export function DashboardScreen({ userId }: Props) {
  const fetchPosts = useCallback(() => api.myPosts(userId), [userId]);
  const { data: posts, setData: setPosts, loading, error, reload } = useLoader<Photo[]>(fetchPosts, []);
  const [filter, setFilter] = useState<PhotoStatus | null>(null);
  const [view, setView] = useState<Layout>('grid');
  const [open, setOpen] = useState<Photo | null>(null);
  const width = useScreenWidth();
  const tile = (width - GUTTER * 2 - GAP * 2) / 3;

  const withdraw = (photo: Photo) => {
    showAlert('Withdraw this request?', 'The photo is deleted from Proval and your friends stop seeing it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePhoto(userId, photo.id);
            setOpen(null);
            setPosts((ps) => ps.filter((p) => p.id !== photo.id));
          } catch (e) {
            showAlert('Couldn’t withdraw it', errorMessage(e));
          }
        },
      },
    ]);
  };

  const withStatus = useMemo(() => posts.map((p) => ({ photo: p, status: statusOf(p) })), [posts]);
  const counts = useMemo(() => {
    const c: Record<PhotoStatus, number> = { approved: 0, pending: 0, denied: 0 };
    withStatus.forEach((x) => c[x.status]++);
    return c;
  }, [withStatus]);
  const shown = filter ? withStatus.filter((x) => x.status === filter) : withStatus;

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.headRow}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>{posts.length} sent</Text>
          <Text style={styles.h1}>Dashboard</Text>
        </View>
        <View style={styles.toggle}>
          {(['grid', 'list'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.toggleBtn, view === v && styles.toggleOn]}
              accessibilityLabel={v === 'grid' ? 'Grid view' : 'List view'}
            >
              <Icon name={v === 'grid' ? 'grid' : 'rows'} size={17} color={view === v ? '#fff' : colors.muted} weight={1.9} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.stats}>
        {ORDER.map((s) => {
          const on = filter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setFilter(on ? null : s)}
              style={[styles.stat, on && styles.statOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.statNum, on && { color: '#fff' }]}>{counts[s]}</Text>
              <View style={styles.statLabelRow}>
                <View style={[styles.dot, { backgroundColor: STATUS[s].fg }]} />
                <Text style={[styles.statLabel, on && { color: 'rgba(255,255,255,0.75)' }]}>{STATUS[s].short}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  const empty = loading ? null : (
    <View style={styles.empty}>
      <Icon name="image" size={26} color={colors.muted} />
      <Text style={styles.emptyText}>
        {filter ? `Nothing ${STATUS[filter].short.toLowerCase()} right now.` : 'You haven’t asked anyone yet.\nStart from the Ask tab.'}
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        key={view}
        data={shown}
        keyExtractor={(x) => x.photo.id}
        numColumns={view === 'grid' ? 3 : 1}
        columnWrapperStyle={view === 'grid' ? { gap: GAP } : undefined}
        contentContainerStyle={[styles.list, { gap: view === 'grid' ? GAP : 12 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) =>
          view === 'grid' ? (
            <Pressable onPress={() => setOpen(item.photo)} style={{ width: tile }}>
              <Image source={{ uri: item.photo.imageUrl }} style={[styles.tile, { height: tile * 1.25 }]} />
              <StatusChip photo={item.photo} status={item.status} />
            </Pressable>
          ) : (
            <View style={styles.card}>
              <PostDetails photo={item.photo} status={item.status} />
            </View>
          )
        }
      />

      <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
        <PhoneFrame>
          {open && (
            <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.sheet}>
              <View style={styles.sheetTop}>
                <Text style={styles.sheetTitle}>Request</Text>
                <Pressable onPress={() => setOpen(null)} style={styles.close} accessibilityLabel="Close">
                  <Icon name="x" size={18} color={colors.ink} weight={2.2} />
                </Pressable>
              </View>
              <Image source={{ uri: open.imageUrl }} style={styles.hero} />
              <View style={styles.card}>
                <PostDetails photo={open} status={statusOf(open)} hideThumb />
              </View>
              <Pressable onPress={() => withdraw(open)} style={styles.withdraw}>
                <Icon name="trash" size={18} color={colors.deny} weight={2} />
                <Text style={styles.withdrawText}>Withdraw request</Text>
              </Pressable>
            </ScrollView>
          )}
        </PhoneFrame>
      </Modal>
    </>
  );
}

/** Small corner badge on grid tiles. Waiting photos show the countdown instead of a glyph. */
function StatusChip({ photo, status }: { photo: Photo; status: PhotoStatus }) {
  const s = STATUS[status];
  return (
    <View style={[styles.chip, { backgroundColor: s.fg }]}>
      <Icon name={s.icon} size={11} color="#fff" weight={3} />
      {status === 'pending' && <Text style={styles.chipText}>{timeLeft(photo)}</Text>}
    </View>
  );
}

function PostDetails({ photo, status, hideThumb }: { photo: Photo; status: PhotoStatus; hideThumb?: boolean }) {
  const s = STATUS[status];
  return (
    <>
      <View style={styles.top}>
        {!hideThumb && <Image source={{ uri: photo.imageUrl }} style={styles.thumb} />}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.caption} numberOfLines={1}>
            {photo.caption || 'Untitled'}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: s.bg }]}>
              <Icon name={s.icon} size={13} color={s.fg} weight={2.6} />
              <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
            </View>
            {status === 'pending' && <Text style={styles.deadline}>auto-approves in {timeLeft(photo)}</Text>}
          </View>
        </View>
      </View>

      {photo.taggedIds.map((id) => {
        const r = photo.reviews[id];
        const a = ANSWER[answerOf(photo, id)];
        const reaction = reactionFor(r?.reaction);
        return (
          <View key={id} style={styles.reviewRow}>
            <Avatar userId={id} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewLine}>
                <Text style={{ fontWeight: '700' }}>{userById(id).name}</Text>{' '}
                <Text style={{ color: a.color }}>{a.text}</Text>
              </Text>
              {reaction && (
                <View style={styles.reaction}>
                  <Icon name={REACTION_ICON[reaction.id]} size={13} color={colors.muted} weight={2} />
                  <Text style={styles.reactionText}>{reaction.label}</Text>
                </View>
              )}
              {!!r?.comment && <Text style={styles.comment}>“{r.comment}”</Text>}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 24 },
  headerWrap: { gap: 16, marginBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  head: { gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  toggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 4,
  },
  toggleBtn: { width: 36, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.ink },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  statOn: { backgroundColor: colors.ink },
  statNum: { fontSize: 26, fontWeight: '800', letterSpacing: -1, color: colors.ink },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tile: { width: '100%', borderRadius: 12, backgroundColor: colors.line },
  chip: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    justifyContent: 'center',
  },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, marginTop: 48 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg - 6, padding: 14, gap: 12 },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 60, height: 76, borderRadius: radius.sm, backgroundColor: colors.line },
  caption: { fontWeight: '700', color: colors.ink, fontSize: 16, letterSpacing: -0.2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: { fontWeight: '700', fontSize: 12 },
  deadline: { color: colors.muted, fontSize: 12 },
  reviewRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  reviewLine: { color: colors.ink, lineHeight: 26 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  reactionText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  comment: { color: colors.ink, marginTop: 4, lineHeight: 19 },
  sheet: { padding: 20, gap: 14, paddingBottom: 48 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...type.title, color: colors.ink },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdraw: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  withdrawText: { color: colors.deny, fontWeight: '700', fontSize: 16 },
  error: { color: colors.deny },
  hero: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg, backgroundColor: colors.line },
});
