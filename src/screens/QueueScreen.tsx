import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api, errorMessage } from '../api';
import { ActionSheet } from '../components/ActionSheet';
import { Avatar } from '../components/Avatar';
import { isHovered } from '../components/DesktopBar';
import { Icon, type IconName } from '../components/Icon';
import { desktopPage, useIsDesktop, useScreenWidth } from '../components/PhoneFrame';
import { PostPreview } from '../components/PostPreview';
import { ReviewSheet } from '../components/ReviewSheet';
import { requestLine, SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import { useLoader } from '../hooks/useLoader';
import { showAlert } from '../lib/alert';
import { REPORT_REASONS, timeLeft, type Decision, type Photo, type PhotoRequest, type ReactionId, type User } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';

type Props = { userId: string };
type Menu = null | 'more' | 'report';

export function QueueScreen({ userId }: Props) {
  const fetchQueue = useCallback(() => api.queue(userId), [userId]);
  const { data: queue, setData: setQueue, loading, error, setError, reload } = useLoader<Photo[]>(fetchQueue, []);
  const [pending, setPending] = useState<Decision | null>(null);
  const [previewing, setPreviewing] = useState(false);
  /** The whole post around the current photo, once "View whole post" loads it. */
  const [whole, setWhole] = useState<PhotoRequest | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const card = useRef<SwipeCardHandle>(null);
  const desktop = useIsDesktop();
  const { height: windowHeight } = useWindowDimensions();
  const pageWidth = useScreenWidth();
  // Desktop: the card fits the window, in the photos' 4:5 shape, leaving at least 45% of the row for the answer panel.
  const cardWidth = Math.round(Math.min(Math.min(620, Math.max(380, windowHeight - 240)) * 0.8, (pageWidth - 48) * 0.55));
  const cardHeight = Math.round(cardWidth / 0.8);

  const current = queue[0];
  const next = queue[1];

  // Desktop: ← and → answer, like swiping.
  const keysOn = desktop && !!current && !pending && !previewing && menu === null;
  useEffect(() => {
    if (!keysOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') card.current?.swipe('deny');
      else if (e.key === 'ArrowRight') card.current?.swipe('approve');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keysOn]);

  const preview = async () => {
    if (!current) return;
    if (current.photoCount <= 1) {
      setWhole(null);
      setPreviewing(true);
      return;
    }
    try {
      setWhole(await api.request(userId, current.requestId));
      setPreviewing(true);
    } catch (e) {
      setError(errorMessage(e, 'Could not load the whole post'));
    }
  };

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

  const head = (
    <>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>
          {queue.length === 0 ? 'Inbox zero' : `${queue.length} ${queue.length === 1 ? 'photo' : 'photos'} waiting on you`}
        </Text>
        <Text style={[styles.h1, desktop && styles.h1Desktop]}>{queue.length === 0 ? 'All caught up' : 'Your call'}</Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </>
  );

  const empty = (
    <View style={[styles.empty, desktop && styles.emptyDesktop]}>
      <View style={styles.emptyIcon}>
        <Icon name="inbox" size={28} color={colors.muted} />
      </View>
      <Text style={styles.emptyText}>Nothing waiting on you.{'\n'}Your friends can post freely, for now.</Text>
      {Platform.OS === 'web' && (
        <Text style={styles.emptyTip}>
          Next time someone tags you, it shows up here. Add Proval to your home screen so it’s one tap away.
        </Text>
      )}
      <Pressable onPress={reload} style={styles.refresh}>
        <Icon name="refresh" size={16} color={colors.ink} weight={2} />
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );

  const stack = current && (
    <>
      {next && <Image source={{ uri: next.imageUrl }} style={styles.behind} />}
      <SwipeCard
        key={current.id}
        ref={card}
        photo={current}
        onSwiped={setPending}
        onPreview={preview}
        onMore={() => setMenu('more')}
        width={desktop ? cardWidth : undefined}
        hideFooter={desktop}
      />
    </>
  );

  const modals = (
    <>
      <PostPreview
        key={current?.id}
        post={
          previewing && current
            ? whole && whole.id === current.requestId
              ? whole
              : { uploaderId: current.uploaderId, kind: current.kind, caption: current.caption, photos: [current] }
            : null
        }
        viewerId={userId}
        startIndex={current && current.photoCount > 1 ? current.position : 0}
        highlightIndex={current && current.photoCount > 1 ? current.position : undefined}
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
    </>
  );

  if (desktop) {
    return (
      <ScrollView contentContainerStyle={styles.desktopWrap}>
        {head}
        {current ? (
          <View style={styles.desktopRow}>
            <View style={{ width: cardWidth, height: cardHeight }}>{stack}</View>
            <DecisionPanel
              photo={current}
              waiting={queue.length - 1}
              onDecide={(d) => card.current?.swipe(d)}
              onPreview={preview}
              onMore={() => setMenu('more')}
            />
          </View>
        ) : (
          empty
        )}
        {modals}
      </ScrollView>
    );
  }

  return (
    <View style={styles.wrap}>
      {head}
      <View style={styles.deck}>{current ? stack : empty}</View>

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
      {modals}
    </View>
  );
}

type PanelProps = {
  photo: Photo;
  waiting: number;
  onDecide: (d: Decision) => void;
  onPreview: () => void;
  onMore: () => void;
};

/** Desktop: who's asking, what they'll post, and big answer buttons, beside the photo. */
function DecisionPanel({ photo, waiting, onDecide, onPreview, onMore }: PanelProps) {
  const uploader = userById(photo.uploaderId);
  const others = photo.taggedIds.length - 1;
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Avatar userId={uploader.id} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.panelTitle}>{requestLine(photo, uploader.name)}</Text>
          <Text style={styles.panelSub}>@{uploader.username}</Text>
        </View>
      </View>

      {!!photo.caption && <Text style={styles.panelCaption}>“{photo.caption}”</Text>}

      <View style={styles.facts}>
        <Fact
          icon="users"
          text={
            others > 0
              ? `You and ${others} other${others === 1 ? '' : 's'} are in this photo`
              : `You’re the only one tagged in this photo`
          }
        />
        <Fact icon="clock" text={`Counts as a yes in ${timeLeft(photo)} if you don’t answer`} />
      </View>

      <View style={styles.panelActions}>
        <Pressable
          onPress={() => onDecide('deny')}
          style={(s) => [styles.bigBtn, styles.bigDeny, isHovered(s) && { borderColor: colors.deny }]}
        >
          <Icon name="x" size={20} color={colors.deny} weight={2.4} />
          <Text style={[styles.bigText, { color: colors.deny }]}>Don’t post</Text>
        </Pressable>
        <Pressable onPress={() => onDecide('approve')} style={(s) => [styles.bigBtn, styles.bigApprove, isHovered(s) && { opacity: 0.88 }]}>
          <Icon name="check" size={20} color="#fff" weight={2.4} />
          <Text style={[styles.bigText, { color: '#fff' }]}>Post it</Text>
        </Pressable>
      </View>
      <Text style={styles.tip}>Tip: press ← or →, or drag the photo.</Text>

      <View style={styles.panelLinks}>
        {photo.photoCount > 1 ? (
          <PanelLink icon="cards" label={`View whole post (${photo.photoCount} photos)`} onPress={onPreview} />
        ) : (
          <PanelLink icon="eye" label="Preview as a post" onPress={onPreview} />
        )}
        <PanelLink icon="alert" label="Report or block" onPress={onMore} destructive />
      </View>
      {waiting > 0 && <Text style={styles.panelSub}>{waiting} more waiting after this one</Text>}
    </View>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={colors.muted} weight={2} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

function PanelLink({ icon, label, onPress, destructive }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }) {
  const color = destructive ? colors.deny : colors.ink;
  return (
    <Pressable onPress={onPress} style={(s) => [styles.panelLink, isHovered(s) && { backgroundColor: colors.bg }]}>
      <Icon name={icon} size={17} color={color} weight={2} />
      <Text style={[styles.panelLinkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { marginTop: 14, marginBottom: 16, gap: 2 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  h1Desktop: { fontSize: 40, letterSpacing: -1.6 },
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
  emptyTip: { color: colors.muted, textAlign: 'center', lineHeight: 19, fontSize: 13, maxWidth: 300, marginTop: 8 },
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
  desktopWrap: { ...desktopPage, paddingTop: 20, paddingBottom: 64 },
  desktopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 48 },
  emptyDesktop: { flex: 0, height: 360, marginBottom: 0 },
  panel: {
    flex: 1,
    maxWidth: 480,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 28,
    gap: 20,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  panelTitle: { ...type.title, color: colors.ink },
  panelSub: { color: colors.muted },
  panelCaption: { fontSize: 17, lineHeight: 25, color: colors.ink },
  facts: { gap: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { color: colors.muted, fontSize: 14 },
  panelActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bigBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.pill,
  },
  bigDeny: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  bigApprove: { backgroundColor: colors.ink },
  bigText: { fontSize: 16, fontWeight: '700' },
  tip: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: -8 },
  panelLinks: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 2 },
  panelLink: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm },
  panelLinkText: { fontSize: 15, fontWeight: '600' },
});
