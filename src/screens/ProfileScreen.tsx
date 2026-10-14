import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage, usingMock } from '../api';
import { DEMO_USERS } from '../api/mock';
import { ActionSheet } from '../components/ActionSheet';
import { Avatar } from '../components/Avatar';
import { BarButton, DesktopBar } from '../components/DesktopBar';
import { Icon, type IconName } from '../components/Icon';
import { desktopPage, useIsDesktop } from '../components/PhoneFrame';
import { useLoader } from '../hooks/useLoader';
import { showAlert } from '../lib/alert';
import { useSession } from '../session';
import type { FriendState, User } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';

const EMPTY: FriendState = { friends: [], incoming: [], outgoing: [] };

/** You, your friends, requests, blocked people, and account settings. */
export function ProfileScreen() {
  const { userId, email, me, signOut, deleteAccount, switchUser } = useSession();
  const fetchAll = useCallback(
    async () => ({ friends: await api.friends(userId), blocked: await api.blocked(userId) }),
    [userId],
  );
  const { data, setData, error, setError } = useLoader(fetchAll, { friends: EMPTY, blocked: [] as string[] });
  const state = data.friends;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const desktop = useIsDesktop();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Debounced search; the results arrive in a callback, never synchronously.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      (q ? api.searchUsers(userId, q) : Promise.resolve([])).then(setResults, () => setResults([]));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, userId]);

  const act = async (otherId: string, fn: typeof api.addFriend) => {
    setBusy(otherId);
    setError(null);
    try {
      const friends = await fn(userId, otherId);
      setData((d) => ({ ...d, friends }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const block = (other: User) => {
    setTimeout(
      () =>
        showAlert(`Block ${other.name}?`, 'They won’t be able to find you, add you, or send you photos. They aren’t told.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.block(userId, other.id);
                setData(await fetchAll());
              } catch (e) {
                setError(errorMessage(e));
              }
            },
          },
        ]),
      300,
    );
  };

  const unblock = async (otherId: string) => {
    setBusy(otherId);
    try {
      await api.unblock(userId, otherId);
      setData((d) => ({ ...d, blocked: d.blocked.filter((id) => id !== otherId) }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    showAlert(
      'Delete your account?',
      'Your profile, friends, every photo you sent, and your answers are deleted for good. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await deleteAccount();
            } catch (e) {
              setLeaving(false);
              showAlert('Couldn’t delete your account', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const menuUser = menuFor ? userById(menuFor) : null;

  const you = (
    <View style={[styles.top, desktop && styles.topDesktop]}>
      <Avatar userId={userId} size={56} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{me?.name}</Text>
        <Text style={styles.handle}>
          @{me?.username} · {state.friends.length} {state.friends.length === 1 ? 'friend' : 'friends'}
        </Text>
        {!!email && <Text style={styles.sub}>Signed in as {email}</Text>}
      </View>
      {!desktop && (
        <Pressable onPress={close} style={styles.close} accessibilityLabel="Close">
          <Icon name="x" size={18} color={colors.ink} weight={2.2} />
        </Pressable>
      )}
    </View>
  );

  const people = (
    <>
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
        {query.trim() !== '' && results.length === 0 && (
          <Text style={styles.muted}>No one matches “{query.trim()}”.</Text>
        )}
        {results
          .filter((u) => !state.friends.includes(u.id))
          .map((u) => {
            const incoming = state.incoming.includes(u.id);
            const outgoing = state.outgoing.includes(u.id);
            return (
              <Row key={u.id} id={u.id} sub={`@${u.username}`}>
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
        {state.outgoing.length > 0 && !query.trim() && (
          <Text style={styles.muted}>Waiting on {state.outgoing.map((id) => userById(id).name).join(', ')} to accept.</Text>
        )}
      </Section>

      <Section label="Friends">
        {state.friends.length === 0 && (
          <Text style={styles.muted}>Only friends can send you photos to approve, and you can only tag friends.</Text>
        )}
        {state.friends.map((id) => (
          <Row key={id} id={id} sub={`@${userById(id).username}`}>
            <Pressable onPress={() => setMenuFor(id)} style={styles.dots} accessibilityLabel={`Options for ${userById(id).name}`}>
              <Icon name="dots" size={20} color={colors.muted} />
            </Pressable>
          </Row>
        ))}
      </Section>

      {data.blocked.length > 0 && (
        <Section label="Blocked">
          {data.blocked.map((id) => (
            <Row key={id} id={id} sub={`@${userById(id).username}`}>
              <SmallBtn onPress={() => unblock(id)} disabled={busy === id} label="Unblock" />
            </Row>
          ))}
        </Section>
      )}
    </>
  );

  const settings = (
    <>
      <Section label="Account">
        <LinkRow icon="eye" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
        <LinkRow icon="list" label="Terms of use" onPress={() => router.push('/legal/terms')} />
        <LinkRow icon="undo" label="Sign out" onPress={signOut} />
        <LinkRow icon="trash" label="Delete account" onPress={confirmDelete} destructive />
        {leaving && <ActivityIndicator style={{ padding: 10 }} color={colors.ink} />}
      </Section>

      {usingMock && (
        <Section label="Demo · switch account">
          <View style={styles.switcher}>
            {DEMO_USERS.map((u) => (
              <Pressable key={u.id} onPress={() => switchUser(u.id)} style={styles.switchItem}>
                <Avatar userId={u.id} size={40} ring={u.id === userId ? colors.ink : undefined} />
                <Text style={[styles.switchName, u.id === userId && { color: colors.ink }]}>{u.name}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      )}
    </>
  );

  const menu = (
    <ActionSheet
      visible={!!menuUser}
      title={menuUser?.name}
      onClose={() => setMenuFor(null)}
      options={
        menuUser
          ? [
              { label: 'Remove friend', icon: 'x', onPress: () => act(menuUser.id, api.removeFriend) },
              { label: `Block ${menuUser.name}`, icon: 'alert', destructive: true, onPress: () => block(menuUser) },
            ]
          : []
      }
    />
  );

  if (desktop) {
    return (
      <View style={styles.screen}>
        <DesktopBar onLogoPress={close}>
          <View style={{ flex: 1 }} />
          <BarButton label="Done" onPress={close} />
        </DesktopBar>
        <ScrollView contentContainerStyle={styles.desktopWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.side}>
            {you}
            {settings}
          </View>
          <View style={styles.main}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {people}
          </View>
        </ScrollView>
        {menu}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {you}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {people}
      {settings}
      {menu}
    </ScrollView>
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

function LinkRow({ icon, label, onPress, destructive }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }) {
  const color = destructive ? colors.deny : colors.ink;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={19} color={color} weight={1.9} />
      <Text style={[styles.linkText, { color }]}>{label}</Text>
    </Pressable>
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
  icon?: IconName;
  solid?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const fg = solid ? '#fff' : colors.ink;
  const iconOnly = icon === 'x';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.small, solid ? styles.smallSolid : styles.smallGhost, iconOnly && { paddingHorizontal: 0, width: 34 }, disabled && { opacity: 0.4 }]}
      accessibilityLabel={label}
    >
      {icon && <Icon name={icon} size={14} color={fg} weight={2.4} />}
      {!iconOnly && <Text style={[styles.smallText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 22, paddingBottom: 48 },
  desktopWrap: { ...desktopPage, flexDirection: 'row', alignItems: 'flex-start', gap: 40, paddingTop: 40, paddingBottom: 64 },
  side: { width: 340, gap: 22 },
  main: { flex: 1, maxWidth: 640, gap: 22 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topDesktop: { backgroundColor: colors.card, borderRadius: radius.md + 2, padding: 20 },
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
  dots: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  small: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  smallSolid: { backgroundColor: colors.ink },
  smallGhost: { borderWidth: 1, borderColor: colors.line },
  smallText: { fontWeight: '700', fontSize: 13 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 13 },
  linkText: { fontSize: 15, fontWeight: '600' },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 8, rowGap: 12 },
  switchItem: { alignItems: 'center', gap: 4, width: 52 },
  switchName: { fontSize: 11, fontWeight: '600', color: colors.muted },
});
