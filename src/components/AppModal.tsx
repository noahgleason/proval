import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { PhoneFrame, useIsDesktop } from './PhoneFrame';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** page: a full screen on mobile. sheet: slides up from the bottom on mobile. */
  kind: 'page' | 'sheet';
  /** Desktop dialog width. */
  width?: number;
  /** Clicking the backdrop closes it. */
  dismissable?: boolean;
  /** Mobile sheet animation. */
  animation?: 'slide' | 'fade';
  children: ReactNode;
};

/**
 * Every pop-up in the app. Desktop shows a centered dialog over a dimmed page;
 * mobile shows a full-screen page or a bottom sheet.
 */
export function AppModal({ visible, onClose, kind, width, dismissable = true, animation = 'slide', children }: Props) {
  const desktop = useIsDesktop();
  const backdrop = (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={dismissable ? onClose : undefined}
      accessibilityLabel={dismissable ? 'Close' : undefined}
      tabIndex={-1}
    />
  );

  if (desktop) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.center}>
          {backdrop}
          <View
            style={[
              kind === 'page' ? styles.pageDialog : styles.sheetDialog,
              { width: width ?? (kind === 'page' ? 560 : 480) },
            ]}
          >
            {children}
          </View>
        </View>
      </Modal>
    );
  }

  if (kind === 'page') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <PhoneFrame>{children}</PhoneFrame>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType={animation} onRequestClose={onClose}>
      <PhoneFrame transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom}>
          {backdrop}
          {children}
        </KeyboardAvoidingView>
      </PhoneFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim, padding: 32 },
  pageDialog: {
    maxWidth: '100%',
    height: '88%',
    maxHeight: 860,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    boxShadow: '0 24px 80px rgba(22, 20, 26, 0.35)',
  },
  sheetDialog: { maxWidth: '100%' },
  bottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
});
