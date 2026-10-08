import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Animated, Dimensions, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Decision, Photo } from '../types';
import { colors, radius } from '../theme';
import { userById } from '../users';
import { Avatar } from './Avatar';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.28;

export type SwipeCardHandle = { swipe: (d: Decision) => void };

type Props = {
  photo: Photo;
  onSwiped: (d: Decision) => void;
  ref?: Ref<SwipeCardHandle>;
};

/** Tinder-style card: drag right to approve, left to deny. */
export function SwipeCard({ photo, onSwiped, ref }: Props) {
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

      <Animated.View style={[styles.stamp, styles.yes, { opacity: yesOpacity }]}>
        <Text style={[styles.stampText, { color: colors.approve }]}>POST IT</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.no, { opacity: noOpacity }]}>
        <Text style={[styles.stampText, { color: colors.deny }]}>NOPE</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Avatar userId={uploader.id} size={34} ring="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.from}>{uploader.name} wants to post</Text>
          {!!photo.caption && <Text style={styles.caption} numberOfLines={2}>“{photo.caption}”</Text>}
          {others > 0 && (
            <Text style={styles.meta}>
              You + {others} other{others === 1 ? '' : 's'} tagged
            </Text>
          )}
        </View>
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  image: { flex: 1, backgroundColor: colors.line },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(30,15,22,0.55)',
  },
  from: { color: '#fff', fontWeight: '700', fontSize: 16 },
  caption: { color: '#fff', marginTop: 2 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  stamp: {
    position: 'absolute',
    top: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  yes: { left: 24, borderColor: colors.approve, transform: [{ rotate: '-12deg' }] },
  no: { right: 24, borderColor: colors.deny, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 28, fontWeight: '900', letterSpacing: 2 },
});
