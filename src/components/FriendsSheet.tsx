import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, usingMock } from '../api';
import type { FriendState } from '../types';
import { colors, radius, type } from '../theme';
import { USERS, userById } from '../users';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  /** Demo only: swap which placeholder account you are. */
  onSwitchUser: (id: string) => void;
  /** Lets the header badge stay in sync with what happened in here. */
  onChange: (s: FriendState) => void;
};

const EMPTY: FriendState = { friends: [], incoming: [], outgoing: [] };

/** Your profile: friend requests, finding people, and who you can tag. */
export function FriendsSheet({ visible, userId, onClose, onSwitchUser, onChange }: Props) {
  const [state, setState] = useState<FriendState>(EMPTY);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = userById(userId);

  const apply = useCallback(
    (s: FriendState) => {
      setState(s);
      onChange(s);
    },
    [onChange],
  );

  useEffect(() => {
    if (!visible) return;
    api.friends(userId).then(apply, (e) => setError(e instanceof Error ? e.message : 'Could not load friends'));
  }, [visible, userId, apply]);

  const act = async (otherId: string, fn: typeof api.addFriend) => {
    setBusy(otherId);
    setError(null);
    try {
      apply(await fn(userId, otherId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    setQuery('');
    onClose();
  };

  const q = query.trim().toLowerCase();
  const results = q
    ? USERS.filter(
        (u) => u.id !== userId && !state.friends.includes(u.id) && (u.id.includes(q) || u.name.toLowerCase().includes(q)),
      )
    : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Avatar userId={userId} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{me.name}</Text>
            <Text style={styles.handle}>
              @{me.id} · {state.friends.length} {state.friends.length === 1 ? 'friend' : 'friends'}
            </Text>
          </View>
          <Pressable onPress={close} style={styles.close} accessibilityLabel="Close">
            <Icon name="x" size={18} color={colors.ink} weight={2.2} />
          </Pressable>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {state.incoming.length > 0 && (
          <Section label={`Requests · ${state.incoming.length}`}>
            {state.incoming.map((id) => (
              <Row key={id} id={id} sub="wants to be friends">
                <SmallBtn icon="x" onPress={() => act(id, api.removeFriend)} disabled={busy === id} label="Decline" />
                <SmallBtn icon="check" onPress={() => act(id, api.addFriend)} disabled={busy === id} label="Accept" solid />
              </Row>
            ))}
          </Section>
        )}

        <Section label="Add friends">
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} weight={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or @username"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {q !== '' && results.length === 0 && <Text style={styles.muted}>No one new matches “{query.trim()}”.</Text>}
          {results.map((u) => {
            const incoming = state.incoming.includes(u.id);
            const outgoing = state.outgoing.includes(u.id);
            return (
              <Row key={u.id} id={u.id} sub={`@${u.id}`}>
                {outgoing ? (
                  <SmallBtn icon="clock" onPress={() => act(u.id, api.removeFriend)} disabled={busy === u.id} label="Requested" />
                ) : (
                  <SmallBtn
                    icon={incoming ? 'check' : 'userPlus'}
                    onPress={() => act(u.id, api.addFriend)}
                    disabled={busy === u.id}
                    label={incoming ? 'Accept' : 'Add'}
                    solid
                  />
                )}
              </Row>
            );
          })}
          {state.outgoing.length > 0 && !q && (
            <Text style={styles.muted}>
              Waiting on {state.outgoing.map((id) => userById(id).name).join(', ')} to accept.
            </Text>
          )}
        </Section>

        <Section label="Friends">
          {state.friends.length === 0 && (
            <Text style={styles.muted}>Only friends can send you photos to approve, and you can only tag friends.</Text>
          )}
          {state.friends.map((id) => (
            <Row key={id} id={id} sub={`@${id}`}>
              <SmallBtn onPress={() => act(id, api.removeFriend)} disabled={busy === id} label="Remove" />
            </Row>
          ))}
        </Section>

        {usingMock && (
          <Section label="Demo · switch account">
            <View style={styles.switcher}>
              {USERS.map((u) => (
                <Pressable key={u.id} onPress={() => onSwitchUser(u.id)} style={styles.switchItem}>
                  <Avatar userId={u.id} size={40} ring={u.id === userId ? colors.ink : undefined} />
                  <Text style={[styles.switchName, u.id === userId && { color: colors.ink }]}>{u.name}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ id, sub, children }: { id: string; sub: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar userId={id} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{userById(id).name}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

function SmallBtn({
  label,
  icon,
  solid,
  onPress,
  disabled,
}: {
  label: string;
  icon?: 'x' | 'check' | 'clock' | 'userPlus';
  solid?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const fg = solid ? '#fff' : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.small, solid ? styles.smallSolid : styles.smallGhost, disabled && { opacity: 0.4 }]}
      accessibilityLabel={label}
    >
      {icon && <Icon name={icon} size={14} color={fg} weight={2.4} />}
      {(!icon || icon !== 'x') && <Text style={[styles.smallText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 22, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { ...type.title, color: colors.ink },
  handle: { color: colors.muted, marginTop: 1 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  error: { color: colors.deny },
  section: { gap: 8 },
  label: { ...type.label, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md + 2, padding: 6, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  name: { fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  muted: { color: colors.muted, padding: 10, lineHeight: 19 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    margin: 2,
    borderRadius: radius.md - 4,
    backgroundColor: colors.bg,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.ink },
  small: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 34,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  smallSolid: { backgroundColor: colors.ink },
  smallGhost: { borderWidth: 1, borderColor: colors.line },
  smallText: { fontWeight: '700', fontSize: 13 },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 8, rowGap: 12 },
  switchItem: { alignItems: 'center', gap: 4, width: 52 },
  switchName: { fontSize: 11, fontWeight: '600', color: colors.muted },
});
