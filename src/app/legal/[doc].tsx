import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { LAST_UPDATED, PRIVACY, TERMS } from '../../legal';
import { colors, type } from '../../theme';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = doc === 'terms' ? TERMS : PRIVACY;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Updated {LAST_UPDATED}</Text>
          <Text style={styles.h1}>{content.title}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="Close">
          <Icon name="x" size={18} color={colors.ink} weight={2.2} />
        </Pressable>
      </View>
      {content.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading}>{s.heading}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, paddingBottom: 48, gap: 20 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { ...type.label, color: colors.brand },
  h1: { ...type.display, color: colors.ink },
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
