import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { colors, radius } from '../theme';
import { LogoMark } from './Icon';
import { PAGE_GUTTER, PAGE_MAX, useIsDesktop } from './PhoneFrame';

/** React Native Web reports hover in a Pressable's style callback; the native types leave it out. */
export const isHovered = (s: PressableStateCallbackType) => (s as { hovered?: boolean }).hovered === true;

/** The desktop site header: logo on the left, whatever the page needs on the right. */
export function DesktopBar({ onLogoPress, children }: { onLogoPress?: () => void; children?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable onPress={onLogoPress} disabled={!onLogoPress} style={styles.brand} accessibilityRole="link" accessibilityLabel="Proval">
          <LogoMark size={26} />
          <Text style={styles.logo}>proval</Text>
        </Pressable>
        {children}
      </View>
    </View>
  );
}

/** Desktop: puts a form screen under the site header, centered in a column. Mobile: the screen as is. */
export function FormPage({ children, width = 440 }: { children: ReactNode; width?: number }) {
  const desktop = useIsDesktop();
  if (!desktop) return <>{children}</>;
  return (
    <View style={styles.page}>
      <DesktopBar />
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.formColumn, { maxWidth: width }]}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** A text link in the header, underlined when it's the current page. */
export function NavLink({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.link} accessibilityRole="link" accessibilityState={{ selected: active }}>
      {(s) => (
        <>
          <Text style={[styles.linkText, (active || isHovered(s)) && { color: colors.ink }]}>{label}</Text>
          <View style={[styles.underline, active && { backgroundColor: colors.brand }]} />
        </>
      )}
    </Pressable>
  );
}

/** A small pill button for the header. */
export function BarButton({ label, onPress, solid }: { label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={(s) => [styles.button, solid ? styles.solid : styles.ghost, isHovered(s) && { opacity: 0.85 }]}
    >
      <Text style={[styles.buttonText, solid && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  formScroll: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: PAGE_GUTTER },
  formColumn: { width: '100%' },
  bar: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  inner: {
    width: '100%',
    maxWidth: PAGE_MAX,
    alignSelf: 'center',
    paddingHorizontal: PAGE_GUTTER,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  link: { height: 68, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  underline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1 },
  button: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  solid: { backgroundColor: colors.ink },
  ghost: { borderWidth: 1, borderColor: colors.line },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
