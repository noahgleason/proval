import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';

const MAX_SCALE = 5;
/** Double-tap zooms to this. */
const TAP_SCALE = 2.5;
/** At normal size, dragging down this far closes the viewer. */
const CLOSE_DRAG = 120;

type Props = {
  /** The photo to show; null hides the viewer. */
  uri: string | null;
  onClose: () => void;
};

/**
 * A photo on black, filling the screen. Pinch or double-tap (double-click) to zoom, drag to look
 * around, drag down or press Esc to close.
 */
export function PhotoViewer({ uri, onClose }: Props) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Modals render outside the app's gesture root on Android, so they need their own. */}
      <GestureHandlerRootView style={{ flex: 1 }}>{uri && <Zoomable key={uri} uri={uri} onClose={onClose} />}</GestureHandlerRootView>
    </Modal>
  );
}

function Zoomable({ uri, onClose }: { uri: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0 });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { width: W, height: H } = size;

  /** Keeps the zoomed photo covering the screen instead of sliding off it. */
  const clamp = (t: number, s: number, side: number) => {
    'worklet';
    const limit = (side * (s - 1)) / 2;
    return Math.min(limit, Math.max(-limit, t));
  };

  /** Zooms to `s`, keeping the point under the fingers (fx, fy from the centre) in place. */
  const zoomTo = (s: number, fx: number, fy: number, from: { scale: number; tx: number; ty: number }) => {
    'worklet';
    const ratio = s / from.scale;
    scale.set(s);
    tx.set(fx - (fx - from.tx) * ratio);
    ty.set(fy - (fy - from.ty) * ratio);
  };

  const settle = () => {
    'worklet';
    if (scale.get() <= 1.01) {
      scale.set(withTiming(1));
      tx.set(withTiming(0));
      ty.set(withTiming(0));
    } else {
      tx.set(withSpring(clamp(tx.get(), scale.get(), W), { damping: 20 }));
      ty.set(withSpring(clamp(ty.get(), scale.get(), H), { damping: 20 }));
    }
  };

  const pinch = Gesture.Pinch()
    .onStart(() => start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get() }))
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE, Math.max(0.8, start.get().scale * e.scale));
      zoomTo(s, e.focalX - W / 2, e.focalY - H / 2, start.get());
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get() }))
    .onUpdate((e) => {
      tx.set(start.get().tx + e.translationX);
      ty.set(start.get().ty + e.translationY);
    })
    .onEnd((e) => {
      if (scale.get() <= 1.01 && (e.translationY > CLOSE_DRAG || e.velocityY > 1200)) {
        scheduleOnRN(onClose);
        return;
      }
      settle();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const from = { scale: scale.get(), tx: tx.get(), ty: ty.get() };
      if (from.scale > 1.01) {
        scale.set(withTiming(1));
        tx.set(withTiming(0));
        ty.set(withTiming(0));
      } else {
        const fx = e.x - W / 2;
        const fy = e.y - H / 2;
        scale.set(withTiming(TAP_SCALE));
        tx.set(withTiming(clamp(-fx * (TAP_SCALE - 1), TAP_SCALE, W)));
        ty.set(withTiming(clamp(-fy * (TAP_SCALE - 1), TAP_SCALE, H)));
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  // Fades the black as you drag down to close.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: scale.get() <= 1.01 ? Math.max(0.4, 1 - Math.abs(ty.get()) / (CLOSE_DRAG * 3)) : 1,
  }));

  const hint = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.maxTouchPoints === 0
    ? 'Double-click to zoom · drag to move · Esc to close'
    : 'Pinch or double-tap to zoom';

  return (
    <View style={styles.screen}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, backdropStyle]} />
      <GestureDetector gesture={gesture}>
        <View style={styles.stage} onLayout={(e) => setSize(e.nativeEvent.layout)} collapsable={false}>
          <Animated.View style={[styles.stage, imageStyle]}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel="Photo, full screen" />
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 14 }]} accessibilityLabel="Close full screen" hitSlop={10}>
        <Icon name="x" size={20} color="#fff" weight={2.4} />
      </Pressable>
      <Text style={[styles.hint, { bottom: insets.bottom + 18 }]} pointerEvents="none">
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  black: { backgroundColor: '#000' },
  stage: { flex: 1, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
});
