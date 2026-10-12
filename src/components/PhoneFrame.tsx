import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

/** On web the app is laid out like a phone: a centered column no wider than this. */
export const PHONE_WIDTH = 430;

const isWeb = Platform.OS === 'web';

/** The width the app actually gets: the window on a phone, the column on web. */
export function useScreenWidth(): number {
  const { width } = useWindowDimensions();
  return isWeb ? Math.min(width, PHONE_WIDTH) : width;
}

/**
 * Centers its children in a phone-width column on web; a no-op on iOS/Android.
 * Wrap the app and the content of every Modal (web renders modals over the
 * whole page). `transparent` is for sheets that draw their own scrim.
 */
export function PhoneFrame({ children, transparent }: { children: ReactNode; transparent?: boolean }) {
  if (!isWeb) return <>{children}</>;
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
