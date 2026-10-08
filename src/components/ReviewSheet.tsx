import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { REACTIONS, type Decision, type ReactionId } from '../types';
import { colors, radius, type } from '../theme';
import { Icon, REACTION_ICON } from './Icon';

type Props = {
  decision: Decision | null;
  /** Who sent the photo, so the prompt can name them. */
  askerName: string;
  onSend: (reaction?: ReactionId, comment?: string) => void;
  onUndo: () => void;
};

/**
 * Pops up after a swipe so you can add "last resort", "crop me out", or a note.
 * Give it a `key` per photo + decision so the note starts empty each time.
 */
export function ReviewSheet({ decision, askerName, onSend, onUndo }: Props) {
  const [reaction, setReaction] = useState<ReactionId | undefined>();
  const [comment, setComment] = useState('');

  if (!decision) return null;
  const approve = decision === 'approve';
  const accent = approve ? colors.approve : colors.deny;
  const options = REACTIONS.filter((r) => r.fits === 'both' || r.fits === decision);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onUndo}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={[styles.verdict, { backgroundColor: accent }]}>
              <Icon name={approve ? 'check' : 'x'} size={20} color="#fff" weight={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{approve ? 'Approved' : 'Denied'}</Text>
              <Text style={styles.sub}>Tell {askerName || 'them'} where you stand. Optional.</Text>
            </View>
          </View>

          <View style={styles.chips}>
            {options.map((r) => {
              const on = reaction === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setReaction(on ? undefined : r.id)}
                  style={[styles.chip, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}
                >
                  <Icon name={REACTION_ICON[r.id]} size={16} color={on ? '#fff' : colors.ink} weight={1.9} />
                  <Text style={[styles.chipText, on && { color: '#fff' }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={approve ? 'e.g. cute! maybe brighten it a little' : 'e.g. use the one where I’m smiling'}
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={200}
            multiline
          />

          <View style={styles.row}>
            <Pressable onPress={onUndo} style={[styles.btn, styles.ghost]}>
              <Icon name="undo" size={18} color={colors.ink} weight={2} />
              <Text style={[styles.btnText, { color: colors.ink }]}>Undo</Text>
            </Pressable>
            <Pressable onPress={() => onSend(reaction, comment)} style={[styles.btn, styles.primary]}>
              <Text style={[styles.btnText, { color: '#fff' }]}>
                {reaction || comment.trim() ? 'Send' : 'Skip note'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 18,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verdict: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.ink },
  sub: { color: colors.muted, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 11,
    paddingRight: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.ink, fontWeight: '600' },
  input: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    padding: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 15,
    borderRadius: radius.pill,
  },
  ghost: { borderWidth: 1, borderColor: colors.line },
  primary: { backgroundColor: colors.ink },
  btnText: { fontWeight: '700', fontSize: 16 },
});
