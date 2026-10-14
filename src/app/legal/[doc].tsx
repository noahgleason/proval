import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarButton, DesktopBar } from '../../components/DesktopBar';
import { Icon } from '../../components/Icon';
import { useIsDesktop } from '../../components/PhoneFrame';
import { LAST_UPDATED, PRIVACY, TERMS } from '../../legal';
import { colors, type } from '../../theme';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = doc === 'terms' ? TERMS : PRIVACY;
  const desktop = useIsDesktop();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const page = (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.wrap, desktop && styles.wrapDesktop]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Updated {LAST_UPDATED}</Text>
          <Text style={[styles.h1, desktop && styles.h1Desktop]}>{content.title}</Text>
        </View>
        {!desktop && (
          <Pressable onPress={close} style={styles.close} accessibilityLabel="Close">
            <Icon name="x" size={18} color={colors.ink} weight={2.2} />
          </Pressable>
        )}
      </View>
      {content.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading}>{s.heading}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );

  if (!desktop) return page;
  return (
    <View style={styles.screen}>
      <DesktopBar onLogoPress={close}>
        <View style={{ flex: 1 }} />
        <BarButton label="Done" onPress={close} />
      </DesktopBar>
      {page}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, paddingBottom: 48, gap: 20 },
  wrapDesktop: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 40, paddingTop: 48, paddingBottom: 80, gap: 24 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
  h1Desktop: { fontSize: 40, letterSpacing: -1.6 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: 6 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { color: colors.ink, lineHeight: 22, opacity: 0.85 },
});
