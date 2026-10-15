import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../api';
import { AppModal } from '../components/AppModal';
import { Avatar } from '../components/Avatar';
import { Icon, REACTION_ICON, type IconName } from '../components/Icon';
import { useLoader } from '../hooks/useLoader';
import { showAlert } from '../lib/alert';
import {
  answerOf,
  reactionFor,
  requestStatusOf,
  statusOf,
  taggedInRequest,
  timeLeft,
  unclaimed,
  isExpired,
  type Answer,
  type Guest,
  type Photo,
  type PhotoRequest,
  type PhotoStatus,
} from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';
import { desktopPage, useIsDesktop, useScreenWidth } from '../components/PhoneFrame';
import { PostPreview } from '../components/PostPreview';
import { ShareLinkSheet } from '../components/ShareLinkSheet';
import { useSession } from '../session';

type Props = { userId: string };
type Layout = 'grid' | 'list';

const STATUS: Record<PhotoStatus, { label: string; short: string; icon: IconName; fg: string; bg: string }> = {
  approved: { label: 'Cleared to post', short: 'Cleared', icon: 'check', fg: colors.approve, bg: colors.approveSoft },
  pending: { label: 'Waiting', short: 'Waiting', icon: 'clock', fg: colors.pending, bg: colors.pendingSoft },
  // A no marks the photo; nothing is removed, and the sender decides.
  denied: { label: 'Got a no', short: 'Marked no', icon: 'x', fg: colors.deny, bg: colors.denySoft },
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
const DESKTOP_GAP = 16;
/** Desktop grid tiles are about this wide. */
const DESKTOP_TILE = 210;

/** Everything you've asked about: what's cleared, what's waiting, what got a no. */
export function DashboardScreen({ userId }: Props) {
  const fetchPosts = useCallback(() => api.myPosts(userId), [userId]);
  const { data: requests, setData: setRequests, loading, error, reload } = useLoader<PhotoRequest[]>(fetchPosts, []);
  const [filter, setFilter] = useState<PhotoStatus | null>(null);
  const [view, setView] = useState<Layout>('grid');
  const [open, setOpen] = useState<PhotoRequest | null>(null);
  /** Which photo of the open request the desktop dialog shows large. */
  const [focus, setFocus] = useState(0);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const { me } = useSession();
  const width = useScreenWidth();
  const desktop = useIsDesktop();
  const gap = desktop ? DESKTOP_GAP : GAP;
  const columns = view === 'list' ? (desktop ? 2 : 1) : desktop ? Math.max(3, Math.floor((width + gap) / (DESKTOP_TILE + gap))) : 3;
  const tile = desktop ? (width - gap * (columns - 1)) / columns : (width - GUTTER * 2 - GAP * 2) / 3;

  const openRequest = (r: PhotoRequest) => {
    setFocus(0);
    setOpen(r);
  };

  const withdraw = (request: PhotoRequest) => {
    const many = request.photos.length > 1;
    showAlert(
      'Withdraw this request?',
      `${many ? 'All its photos are' : 'The photo is'} deleted from Proval and your friends stop seeing ${many ? 'them' : 'it'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRequest(userId, request.id);
              setOpen(null);
              setRequests((rs) => rs.filter((r) => r.id !== request.id));
            } catch (e) {
              showAlert('Couldn’t withdraw it', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  /** Reset or settle a name, then show the request as it is now. */
  const changeGuest = async (fn: () => Promise<void>) => {
    if (!open) return;
    try {
      await fn();
      const fresh = await api.request(userId, open.id);
      setOpen(fresh);
      setRequests((rs) => rs.map((r) => (r.id === fresh.id ? fresh : r)));
    } catch (e) {
      showAlert('Couldn’t change that', errorMessage(e));
    }
  };

  const resetGuest = (g: Guest) =>
    showAlert(`Reset “${g.name}”?`, `${userById(g.claimedBy!).name} stops being tagged as ${g.name}, and anything they answered is cleared. The name opens up again on the link.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => changeGuest(() => api.resetGuest(userId, g.id)) },
    ]);

  const settleGuest = (g: Guest, switchToFlagger: boolean) =>
    changeGuest(() => api.resolveGuest(userId, g.id, switchToFlagger));

  const withStatus = useMemo(() => requests.map((r) => ({ request: r, status: requestStatusOf(r) })), [requests]);
  const counts = useMemo(() => {
    const c: Record<PhotoStatus, number> = { approved: 0, pending: 0, denied: 0 };
    withStatus.forEach((x) => c[x.status]++);
    return c;
  }, [withStatus]);
  const shown = filter ? withStatus.filter((x) => x.status === filter) : withStatus;

  const header = (
    <View style={[styles.headerWrap, desktop && styles.headerWrapDesktop]}>
      <View style={styles.headRow}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>{requests.length} sent</Text>
          <Text style={[styles.h1, desktop && styles.h1Desktop]}>Dashboard</Text>
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

      <View style={[styles.stats, desktop && styles.statsDesktop]}>
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

  const single = open?.photos.length === 1;
  const focused = open?.photos[Math.min(focus, (open?.photos.length ?? 1) - 1)];

  return (
    <>
      <FlatList
        key={`${view}-${columns}`}
        data={shown}
        keyExtractor={(x) => x.request.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: view === 'grid' ? gap : 16 } : undefined}
        contentContainerStyle={[
          styles.list,
          desktop && styles.listDesktop,
          { gap: view === 'grid' ? gap : desktop ? 16 : 12 },
        ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) =>
          view === 'grid' ? (
            <Pressable onPress={() => openRequest(item.request)} style={{ width: tile }}>
              <Image source={{ uri: item.request.photos[0].imageUrl }} style={[styles.tile, { height: tile * 1.25 }]} />
              {item.request.photos.length > 1 && <CountBadge n={item.request.photos.length} />}
              <StatusChip request={item.request} status={item.status} />
            </Pressable>
          ) : (
            <Pressable onPress={() => openRequest(item.request)} style={[styles.card, desktop && { flex: 1 }]}>
              <RequestSummary request={item.request} status={item.status} />
              {item.request.photos.length === 1 ? (
                <PhotoAnswers photo={item.request.photos[0]} />
              ) : (
                <PhotoStrip request={item.request} />
              )}
            </Pressable>
          )
        }
      />

      <AppModal visible={!!open} onClose={() => setOpen(null)} kind="page" width={900}>
        {open && focused && (
          <View style={[{ flex: 1 }, desktop && styles.sheetDesktop]}>
            {desktop && (
              <Pressable onPress={() => setPreviewAt(focus)} style={styles.heroDesktop} accessibilityLabel="Preview the post">
                <Image source={{ uri: focused.imageUrl }} style={styles.heroImage} />
                {!single && <CountBadge n={open.photos.length} label={`${focus + 1}/${open.photos.length}`} />}
              </Pressable>
            )}
            <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.sheet}>
              <View style={styles.sheetTop}>
                <Text style={styles.sheetTitle}>{open.kind === 'story' ? 'Story request' : 'Post request'}</Text>
                <Pressable onPress={() => setOpen(null)} style={styles.close} accessibilityLabel="Close">
                  <Icon name="x" size={18} color={colors.ink} weight={2.2} />
                </Pressable>
              </View>
              {!desktop && single && (
                <Pressable onPress={() => setPreviewAt(0)}>
                  <Image source={{ uri: focused.imageUrl }} style={styles.hero} />
                </Pressable>
              )}
              <View style={styles.card}>
                <RequestSummary request={open} status={requestStatusOf(open)} hideThumb />
                {single && <PhotoAnswers photo={open.photos[0]} />}
              </View>

              {open.guests.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.caption}>Tagged by name</Text>
                  {open.guests.map((g) => (
                    <GuestRow key={g.id} guest={g} onReset={() => resetGuest(g)} onSettle={(sw) => settleGuest(g, sw)} />
                  ))}
                </View>
              )}

              {!single &&
                open.photos.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => (desktop ? setFocus(i) : setPreviewAt(i))}
                    style={[styles.card, desktop && i === focus && styles.cardFocused]}
                  >
                    <View style={styles.top}>
                      <Image source={{ uri: p.imageUrl }} style={styles.thumb} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.caption}>Photo {i + 1}</Text>
                        <StatusBadge photo={p} />
                      </View>
                    </View>
                    {p.taggedIds.length || p.guests.length ? (
                      <PhotoAnswers photo={p} />
                    ) : (
                      <Text style={styles.muted}>Nobody tagged in this one.</Text>
                    )}
                  </Pressable>
                ))}

              <Pressable onPress={() => setPreviewAt(desktop ? focus : 0)} style={styles.secondary}>
                <Icon name="eye" size={18} color={colors.ink} weight={2} />
                <Text style={styles.secondaryText}>{single ? 'Preview post' : 'Preview whole post'}</Text>
              </Pressable>
              <Pressable onPress={() => setSharing(true)} style={styles.secondary}>
                <Icon name="link" size={18} color={colors.ink} weight={2} />
                <Text style={styles.secondaryText}>Group chat link</Text>
              </Pressable>
              <Pressable onPress={() => withdraw(open)} style={styles.withdraw}>
                <Icon name="trash" size={18} color={colors.deny} weight={2} />
                <Text style={styles.withdrawText}>Withdraw request</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
        <PostPreview
          key={`${open?.id}-${previewAt}`}
          post={open && previewAt !== null ? open : null}
          viewerId={userId}
          startIndex={previewAt ?? 0}
          onClose={() => setPreviewAt(null)}
        />
        <ShareLinkSheet
          key={`${open?.id}-${sharing}`}
          requestId={open && sharing ? open.id : null}
          userId={userId}
          senderName={me?.name ?? 'A friend'}
          names={open ? unclaimed(open).map((g) => g.name) : []}
          onClose={() => setSharing(false)}
        />
      </AppModal>
    </>
  );
}

/** "4" with a stack icon, top-right on a post's tile. */
function CountBadge({ n, label }: { n: number; label?: string }) {
  return (
    <View style={styles.count} accessibilityLabel={`${n} photos`}>
      <Icon name="cards" size={12} color="#fff" weight={2.4} />
      <Text style={styles.countText}>{label ?? n}</Text>
    </View>
  );
}

/** Small corner badge on grid tiles. Waiting requests show the countdown instead of a glyph. */
function StatusChip({ request, status }: { request: PhotoRequest; status: PhotoStatus }) {
  const s = STATUS[status];
  return (
    <View style={[styles.chip, { backgroundColor: s.fg }]}>
      <Icon name={s.icon} size={11} color="#fff" weight={3} />
      {status === 'pending' && <Text style={styles.chipText}>{timeLeft(request)}</Text>}
    </View>
  );
}

function StatusBadge({ photo }: { photo: Photo }) {
  const status = statusOf(photo);
  const s = STATUS[status];
  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Icon name={s.icon} size={13} color={s.fg} weight={2.6} />
        <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
      </View>
    </View>
  );
}

/** Caption, overall status and, for posts, how the photos are doing. */
function RequestSummary({ request, status, hideThumb }: { request: PhotoRequest; status: PhotoStatus; hideThumb?: boolean }) {
  const s = STATUS[status];
  const many = request.photos.length > 1;
  const per = request.photos.map((p) => statusOf(p));
  const parts = [
    per.filter((x) => x === 'approved').length && `${per.filter((x) => x === 'approved').length} cleared`,
    per.filter((x) => x === 'pending').length && `${per.filter((x) => x === 'pending').length} waiting`,
    per.filter((x) => x === 'denied').length && `${per.filter((x) => x === 'denied').length} marked no`,
  ].filter(Boolean);
  const people = taggedInRequest(request).length + unclaimed(request).length;
  return (
    <View style={styles.top}>
      {!hideThumb && <Image source={{ uri: request.photos[0].imageUrl }} style={styles.thumb} />}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.caption} numberOfLines={1}>
          {request.caption || 'Untitled'}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Icon name={s.icon} size={13} color={s.fg} weight={2.6} />
            <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
          </View>
          {status === 'pending' && <Text style={styles.deadline}>auto-approves in {timeLeft(request)}</Text>}
        </View>
        <Text style={styles.deadline}>
          {request.kind === 'story' ? 'Story' : 'Post'}
          {many ? ` · ${request.photos.length} photos · ${parts.join(', ')}` : ''} · {people} {people === 1 ? 'person' : 'people'} asked
        </Text>
        {request.guests.some((g) => g.disputedBy) && (
          <Text style={[styles.deadline, { color: colors.pending, fontWeight: '700' }]}>A name got flagged. Open to sort it out.</Text>
        )}
      </View>
    </View>
  );
}

/** List view, posts: a row of small photos with each one's status. */
function PhotoStrip({ request }: { request: PhotoRequest }) {
  return (
    <View style={styles.strip}>
      {request.photos.map((p) => {
        const s = STATUS[statusOf(p)];
        return (
          <View key={p.id}>
            <Image source={{ uri: p.imageUrl }} style={styles.stripThumb} />
            <View style={[styles.chip, styles.stripChip, { backgroundColor: s.fg }]}>
              <Icon name={s.icon} size={10} color="#fff" weight={3} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Someone tagged by name: waiting for them to open the link, claimed (with Reset), or flagged by
 * someone else who says they're the real one (keep or switch).
 */
function GuestRow({ guest: g, onReset, onSettle }: { guest: Guest; onReset: () => void; onSettle: (switchToFlagger: boolean) => void }) {
  const claimer = g.claimedBy ? userById(g.claimedBy) : null;
  const flagger = g.disputedBy ? userById(g.disputedBy) : null;
  return (
    <View style={styles.reviewRow}>
      {claimer ? <Avatar userId={claimer.id} size={26} /> : <GuestInitial name={g.name} />}
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={styles.reviewLine}>
          <Text style={{ fontWeight: '700' }}>{g.name}</Text>{' '}
          {claimer ? (
            <Text style={{ color: colors.muted }}>
              is {claimer.name} (@{claimer.username})
            </Text>
          ) : (
            <Text style={{ color: colors.pending }}>hasn’t opened the link</Text>
          )}
        </Text>
        {flagger && claimer && (
          <View style={styles.flag}>
            <Icon name="alert" size={15} color={colors.pending} weight={2.2} />
            <Text style={styles.flagText}>
              {flagger.name} (@{flagger.username}) says they’re the real {g.name}. Who is it?
            </Text>
          </View>
        )}
        {flagger && claimer ? (
          <View style={styles.guestActions}>
            <Pressable onPress={() => onSettle(false)} style={styles.small}>
              <Text style={styles.smallText}>Keep {claimer.name}</Text>
            </Pressable>
            <Pressable onPress={() => onSettle(true)} style={[styles.small, styles.smallOn]}>
              <Text style={[styles.smallText, { color: '#fff' }]}>Switch to {flagger.name}</Text>
            </Pressable>
          </View>
        ) : (
          claimer && (
            <Pressable onPress={onReset} style={[styles.small, { alignSelf: 'flex-start' }]}>
              <Text style={styles.smallText}>Wrong person? Reset</Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

function GuestInitial({ name }: { name: string }) {
  return (
    <View style={styles.guestInitial}>
      <Text style={styles.guestInitialText}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

/** Each tagged person's answer to one photo, with their reaction and note. */
function PhotoAnswers({ photo }: { photo: Photo }) {
  return (
    <>
      {unclaimed(photo).map((g) => {
        const a = ANSWER[isExpired(photo) ? 'auto' : 'waiting'];
        return (
          <View key={g.id} style={styles.reviewRow}>
            <GuestInitial name={g.name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewLine}>
                <Text style={{ fontWeight: '700' }}>{g.name}</Text> <Text style={{ color: a.color }}>{a.text}</Text>
              </Text>
              <Text style={styles.reactionText}>Not on Proval yet · gets the group chat link</Text>
            </View>
          </View>
        );
      })}
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
  listDesktop: { ...desktopPage, paddingTop: 20, paddingBottom: 64 },
  headerWrap: { gap: 16, marginBottom: 10 },
  headerWrapDesktop: { gap: 24, marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  head: { gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  h1Desktop: { fontSize: 40, letterSpacing: -1.6 },
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
  statsDesktop: { gap: 16, maxWidth: 720 },
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
  guestInitial: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestInitialText: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  flag: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.pendingSoft },
  flagText: { flex: 1, color: colors.ink, lineHeight: 19 },
  guestActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  small: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  smallOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  smallText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  error: { color: colors.deny },
  hero: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg, backgroundColor: colors.line },
  sheetDesktop: { flexDirection: 'row' },
  heroDesktop: { width: '45%', maxWidth: 420, height: '100%', backgroundColor: colors.line },
  heroImage: { width: '100%', height: '100%' },
  cardFocused: { borderWidth: 2, borderColor: colors.brand, padding: 12 },
  muted: { color: colors.muted },
  count: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.scrim,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stripThumb: { width: 48, height: 60, borderRadius: 8, backgroundColor: colors.line },
  stripChip: { left: 3, bottom: 3, minWidth: 16, height: 16, paddingHorizontal: 3 },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
});
