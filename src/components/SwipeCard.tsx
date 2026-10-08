import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Animated, Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { timeLeft, type Decision, type Photo } from '../types';
import { colors, radius } from '../theme';
import { userById } from '../users';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.28;

export type SwipeCardHandle = { swipe: (d: Decision) => void };

type Props = {
  photo: Photo;
  onSwiped: (d: Decision) => void;
  onPreview: () => void;
  ref?: Ref<SwipeCardHandle>;
};

/** Tinder-style card: drag right to approve, left to deny. */
export function SwipeCard({ photo, onSwiped, onPreview, ref }: Props) {
  const pos = useRef(new Animated.ValueXY()).current;

  const flyOut = (d: Decision) => {
    Animated.timing(pos, {
      toValue: { x: (d === 'approve' ? 1 : -1) * SCREEN_W * 1.4, y: 40 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      onSwiped(d);
    });
  };

  useImperativeHandle(ref, () => ({ swipe: flyOut }));

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > THRESHOLD) flyOut('approve');
          else if (g.dx < -THRESHOLD) flyOut('deny');
          else Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photo.id],
  );

  const rotate = pos.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: ['-14deg', '0deg', '14deg'] });
  const yesOpacity = pos.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const noOpacity = pos.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const uploader = userById(photo.uploaderId);
  const others = photo.taggedIds.length - 1;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.card, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }]}
    >
      <Image source={{ uri: photo.imageUrl }} style={styles.image} />

      <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.approve, opacity: Animated.multiply(yesOpacity, 0.28) }]} />
      <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.deny, opacity: Animated.multiply(noOpacity, 0.28) }]} />
      <Animated.View pointerEvents="none" style={[styles.badge, styles.yes, { opacity: yesOpacity }]}>
        <Icon name="check" size={18} color="#fff" weight={2.6} />
        <Text style={styles.badgeText}>Post it</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.badge, styles.no, { opacity: noOpacity }]}>
        <Icon name="x" size={18} color="#fff" weight={2.6} />
        <Text style={styles.badgeText}>Don’t</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Avatar userId={uploader.id} size={36} ring="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.from}>{uploader.name} wants to post</Text>
          {!!photo.caption && <Text style={styles.caption} numberOfLines={2}>“{photo.caption}”</Text>}
          <Text style={styles.meta}>
            {others > 0 ? `You + ${others} other${others === 1 ? '' : 's'} · ` : ''}auto-approves in {timeLeft(photo)}
          </Text>
        </View>
        <Pressable onPress={onPreview} style={styles.preview} accessibilityLabel="Preview the post" hitSlop={8}>
          <Icon name="eye" size={18} color={colors.ink} weight={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  image: { flex: 1, backgroundColor: colors.line },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 14,
    borderRadius: radius.md + 2,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.scrim,
  },
  from: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: -0.2 },
  caption: { color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  meta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  preview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  yes: { left: 20, backgroundColor: colors.approve },
  no: { right: 20, backgroundColor: colors.deny },
  badgeText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});
