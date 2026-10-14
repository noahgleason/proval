import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { colors } from '../theme';

/**
 * Proval has two layouts:
 * - mobile: the phone app (iOS/Android, phone browsers, narrow windows)
 * - desktop: a website layout for browser windows at least DESKTOP_MIN wide
 */
export const DESKTOP_MIN = 768;
/** Desktop pages are centered and no wider than this, gutters included. */
export const PAGE_MAX = 1200;
export const PAGE_GUTTER = 40;
/** Narrow browser windows get the phone layout in a centered column this wide. */
export const PHONE_WIDTH = 430;

const isWeb = Platform.OS === 'web';

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return isWeb && width >= DESKTOP_MIN;
}

/** The width content gets: the phone's width, the phone column, or the desktop page minus its gutters. */
export function useScreenWidth(): number {
  const { width } = useWindowDimensions();
  if (!isWeb) return width;
  if (width >= DESKTOP_MIN) return Math.min(width, PAGE_MAX) - PAGE_GUTTER * 2;
  return Math.min(width, PHONE_WIDTH);
}

/** Centers a desktop page's content. Spread into a ScrollView/FlatList contentContainerStyle. */
export const desktopPage: ViewStyle = {
  width: '100%',
  maxWidth: PAGE_MAX,
  alignSelf: 'center',
  paddingHorizontal: PAGE_GUTTER,
};

/**
 * Narrow browser windows: centers the phone layout in a phone-width column.
 * A no-op on iOS/Android and on desktop. Wrap the app and the content of
 * every mobile Modal (web renders modals over the whole page). `transparent`
 * is for sheets that draw their own scrim.
 */
export function PhoneFrame({ children, transparent }: { children: ReactNode; transparent?: boolean }) {
  const desktop = useIsDesktop();
  if (!isWeb || desktop) return <>{children}</>;
  return (
    <View style={[styles.surround, transparent && styles.clear]}>
      <View style={[styles.column, transparent && styles.clear]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surround: { flex: 1, alignItems: 'center', backgroundColor: colors.line },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_WIDTH,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    boxShadow: '0 0 40px rgba(22, 20, 26, 0.08)',
  },
  clear: { backgroundColor: 'transparent', boxShadow: 'none' },
});
