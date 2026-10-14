import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { AppModal } from './AppModal';
import { Icon, type IconName } from './Icon';
import { useIsDesktop } from './PhoneFrame';

export type ActionOption = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void };

type Props = {
  visible: boolean;
  title?: string;
  options: ActionOption[];
  onClose: () => void;
};

/** A bottom menu (a small dialog on desktop). Picking an option closes it, then runs it. */
export function ActionSheet({ visible, title, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  return (
    <AppModal visible={visible} onClose={onClose} kind="sheet" animation="fade" width={400}>
      <View style={[styles.sheet, { paddingBottom: desktop ? 0 : Math.max(insets.bottom, 12) + 8 }]}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.group}>
          {options.map((o, i) => {
            const color = o.destructive ? colors.deny : colors.ink;
            return (
              <Pressable
                key={o.label}
                onPress={() => {
                  onClose();
                  o.onPress();
                }}
                style={({ pressed }) => [styles.option, i > 0 && styles.divider, pressed && { backgroundColor: colors.bg }]}
              >
                {o.icon && <Icon name={o.icon} size={20} color={color} weight={1.9} />}
                <Text style={[styles.label, { color }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 12, gap: 8 },
  title: { color: '#fff', fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  group: { backgroundColor: colors.card, borderRadius: radius.md + 2, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  label: { fontSize: 16, fontWeight: '600' },
  cancel: { backgroundColor: colors.card, borderRadius: radius.md + 2, paddingVertical: 16, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
