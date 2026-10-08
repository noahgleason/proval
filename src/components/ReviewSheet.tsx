import { useEffect, useState } from 'react';
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
import { colors, radius } from '../theme';

type Props = {
  decision: Decision | null;
  onSend: (reaction?: ReactionId, comment?: string) => void;
  onUndo: () => void;
};

/** Pops up after a swipe so you can add "last resort", "crop me out", or a note. */
export function ReviewSheet({ decision, onSend, onUndo }: Props) {
  const [reaction, setReaction] = useState<ReactionId | undefined>();
  const [comment, setComment] = useState('');

  useEffect(() => {
    setReaction(undefined);
    setComment('');
  }, [decision]);

  if (!decision) return null;
  const approve = decision === 'approve';
  const accent = approve ? colors.approve : colors.deny;
  const options = REACTIONS.filter((r) => r.fits === 'both' || r.fits === decision);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onUndo}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={[styles.title, { color: accent }]}>{approve ? 'Approved 👍' : 'Denied 🙅‍♀️'}</Text>
          <Text style={styles.sub}>Add a note so she knows where you stand (optional)</Text>

          <View style={styles.chips}>
            {options.map((r) => {
              const on = reaction === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setReaction(on ? undefined : r.id)}
                  style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
                >
                  <Text style={[styles.chipText, on && { color: '#fff' }]}>
                    {r.emoji} {r.label}
                  </Text>
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
              <Text style={[styles.btnText, { color: colors.muted }]}>Undo</Text>
            </Pressable>
            <Pressable onPress={() => onSend(reaction, comment)} style={[styles.btn, { backgroundColor: accent }]}>
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,15,22,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: -8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  chipText: { color: colors.ink, fontWeight: '600' },
  input: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  ghost: { backgroundColor: colors.bg },
  btnText: { fontWeight: '700', fontSize: 16 },
});
