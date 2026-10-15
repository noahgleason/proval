import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage } from '../api';
import { linkMessage, shareText } from '../lib/share';
import { colors, radius, type } from '../theme';
import { AppModal } from './AppModal';
import { Icon } from './Icon';
import { useIsDesktop } from './PhoneFrame';

type Props = {
  /** The request whose link to share; null hides the sheet. */
  requestId: string | null;
  userId: string;
  senderName: string;
  /** People tagged by name, so the sheet can say who the link is for. */
  names: string[];
  /** Right after sending: the button under Share says "Done" instead of "Close". */
  justSent?: boolean;
  onClose: () => void;
};

/** "Send this to the group chat": share or copy the request's link, or turn it off. */
export function ShareLinkSheet({ requestId, userId, senderName, names, justSent, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const [link, setLink] = useState<{ token: string; on: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Callers key this by request, so each request starts fresh.
  useEffect(() => {
    if (!requestId) return;
    api.shareLink(userId, requestId).then(setLink, (e) => setError(errorMessage(e)));
  }, [requestId, userId]);

  const share = async () => {
    if (!link) return;
    setError(null);
    try {
      if ((await shareText(linkMessage(senderName, link.token))) === 'copied') setCopied(true);
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t share the link'));
    }
  };

  const toggle = async () => {
    if (!link || !requestId) return;
    setBusy(true);
    setError(null);
    try {
      await api.setShareOn(userId, requestId, !link.on);
      setLink({ ...link, on: !link.on });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const who = names.length === 0 ? 'anyone' : names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;

  return (
    <AppModal visible={!!requestId} onClose={onClose} kind="sheet" width={480}>
      <View style={[styles.sheet, desktop ? styles.dialog : { paddingBottom: insets.bottom + 24 }]}>
        {!desktop && <View style={styles.grabber} />}
        <View style={styles.icon}>
          <Icon name="link" size={22} color={colors.brand} weight={2.2} />
        </View>
        <Text style={styles.title}>{justSent ? 'Now send it to the group chat' : 'Group chat link'}</Text>
        <Text style={styles.text}>
          {names.length
            ? `${who} ${names.length === 1 ? 'isn’t' : 'aren’t'} on Proval yet. They open the link, sign in, tap their name and answer. No app needed.`
            : 'Anyone you tagged can open it. It doesn’t show the photos until they sign in.'}
        </Text>

        {!link && !error && <ActivityIndicator color={colors.ink} style={{ marginVertical: 18 }} />}
        {link && !link.on && <Text style={styles.off}>This link is off. Nobody new can use it.</Text>}
        {link?.on && (
          <View style={styles.preview}>
            <Text style={styles.previewText} numberOfLines={3}>
              {linkMessage(senderName, link.token)}
            </Text>
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {link?.on && (
          <Pressable onPress={share} style={styles.cta}>
            <Icon name="share" size={18} color="#fff" weight={2.2} />
            <Text style={styles.ctaText}>{copied ? 'Copied, paste it in the chat' : 'Share link'}</Text>
          </Pressable>
        )}
        {link && (
          <Pressable onPress={toggle} disabled={busy} style={styles.secondary}>
            <Text style={[styles.secondaryText, link.on && { color: colors.deny }]}>{link.on ? 'Turn link off' : 'Turn link back on'}</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>{justSent ? 'Done' : 'Close'}</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  dialog: { borderRadius: radius.lg, padding: 28 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, color: colors.ink },
  text: { color: colors.muted, lineHeight: 20 },
  preview: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14 },
  previewText: { color: colors.ink, lineHeight: 20 },
  off: { color: colors.pending, fontWeight: '600' },
  error: { color: colors.deny },
  cta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    marginTop: 4,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  done: { alignItems: 'center', paddingVertical: 8 },
  doneText: { color: colors.muted, fontWeight: '700' },
});
