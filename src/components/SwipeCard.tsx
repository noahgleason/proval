import * as Haptics from 'expo-haptics';
import { useImperativeHandle, type Ref } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { timeLeft, type Decision, type Photo } from '../types';
import { colors, radius } from '../theme';
import { userById } from '../users';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useScreenWidth } from './PhoneFrame';

export type SwipeCardHandle = { swipe: (d: Decision) => void };

type Props = {
  photo: Photo;
  onSwiped: (d: Decision) => void;
  onPreview: () => void;
  onMore: () => void;
  /** The card's width, when it isn't the screen's (desktop). */
  width?: number;
  /** Desktop shows the sender and caption beside the card instead of on it. */
  hideFooter?: boolean;
  ref?: Ref<SwipeCardHandle>;
};

const tick = () => Haptics.selectionAsync();
const decided = (d: Decision) =>
  Haptics.notificationAsync(d === 'approve' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);

/** Tinder-style card: drag right to approve, left to deny. Runs on the UI thread. */
export function SwipeCard({ photo, onSwiped, onPreview, onMore, width: cardWidth, hideFooter, ref }: Props) {
  const screenWidth = useScreenWidth();
  const width = cardWidth ?? screenWidth;
  const threshold = width * 0.28;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const armed = useSharedValue(0); // -1 deny, 0 none, 1 approve: for one haptic tick per crossing

  const finish = (d: Decision) => {
    decided(d);
    onSwiped(d);
  };

  const flyOut = (d: Decision) => {
    'worklet';
    const dir = d === 'approve' ? 1 : -1;
    x.set(
      withTiming(dir * width * 1.5, { duration: 220 }, (done) => {
        if (!done) return;
        x.set(0);
        y.set(0);
        armed.set(0);
        scheduleOnRN(finish, d);
      }),
    );
    y.set(withTiming(40, { duration: 220 }));
  };

  useImperativeHandle(ref, () => ({ swipe: (d: Decision) => flyOut(d) }));

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      x.set(e.translationX);
      y.set(e.translationY);
      const side = e.translationX > threshold ? 1 : e.translationX < -threshold ? -1 : 0;
      if (side !== armed.get()) {
        armed.set(side);
        if (side !== 0) scheduleOnRN(tick);
      }
    })
    .onEnd((e) => {
      const flung = Math.abs(e.velocityX) > 900 && Math.abs(e.translationX) > 40;
      if (e.translationX > threshold || (flung && e.velocityX > 0)) flyOut('approve');
      else if (e.translationX < -threshold || (flung && e.velocityX < 0)) flyOut('deny');
      else {
        x.set(withSpring(0, { damping: 16 }));
        y.set(withSpring(0, { damping: 16 }));
        armed.set(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: `${interpolate(x.get(), [-width, 0, width], [-14, 0, 14])}deg` },
    ],
  }));
  const yesStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, threshold], [0, 1], Extrapolation.CLAMP) }));
  const noStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-threshold, 0], [1, 0], Extrapolation.CLAMP) }));
  const yesWash = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, threshold], [0, 0.28], Extrapolation.CLAMP) }));
  const noWash = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-threshold, 0], [0.28, 0], Extrapolation.CLAMP) }));

  const uploader = userById(photo.uploaderId);
  const others = photo.taggedIds.length - 1;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image source={{ uri: photo.imageUrl }} style={styles.image} />

        <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.approve }, yesWash]} />
        <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.deny }, noWash]} />
        <Animated.View pointerEvents="none" style={[styles.badge, styles.yes, yesStyle]}>
          <Icon name="check" size={18} color="#fff" weight={2.6} />
          <Text style={styles.badgeText}>Post it</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.badge, styles.no, noStyle]}>
          <Icon name="x" size={18} color="#fff" weight={2.6} />
          <Text style={styles.badgeText}>Don’t</Text>
        </Animated.View>

        <Pressable onPress={onMore} style={styles.more} accessibilityLabel="More options" hitSlop={8}>
          <Icon name="dots" size={20} color="#fff" />
        </Pressable>

        {!hideFooter && (
          <View style={styles.footer}>
            <Avatar userId={uploader.id} size={36} ring="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.from}>{uploader.name} wants to post</Text>
              {!!photo.caption && (
                <Text style={styles.caption} numberOfLines={2}>
                  “{photo.caption}”
                </Text>
              )}
              <Text style={styles.meta}>
                {others > 0 ? `You + ${others} other${others === 1 ? '' : 's'} · ` : ''}auto-approves in {timeLeft(photo)}
              </Text>
            </View>
            <Pressable onPress={onPreview} style={styles.preview} accessibilityLabel="Preview the post" hitSlop={8}>
              <Icon name="eye" size={18} color={colors.ink} weight={2} />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
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
  more: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  no: { right: 64, backgroundColor: colors.deny },
  badgeText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});
