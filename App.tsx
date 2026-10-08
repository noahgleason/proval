import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, usingMock } from './src/api';
import { Avatar } from './src/components/Avatar';
import { FriendsSheet } from './src/components/FriendsSheet';
import { Icon, LogoMark, type IconName } from './src/components/Icon';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { QueueScreen } from './src/screens/QueueScreen';
import { SubmitScreen } from './src/screens/SubmitScreen';
import { colors, radius } from './src/theme';
import { USERS, userById } from './src/users';

type Tab = 'dashboard' | 'review' | 'ask';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'review', label: 'Review', icon: 'cards' },
  { id: 'ask', label: 'Ask', icon: 'send' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  // Placeholder "login" until real accounts: switch who you are from the profile sheet.
  const [me, setMe] = useState(USERS[0].id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    api.friends(me).then(
      (s) => setRequests(s.incoming.length),
      () => setRequests(0),
    );
  }, [me]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <View style={styles.brand}>
            <LogoMark size={26} />
            <Text style={styles.logo}>proval</Text>
          </View>
          <Pressable onPress={() => setProfileOpen(true)} style={styles.me} accessibilityLabel="Profile and friends">
            <Text style={styles.meText}>{userById(me).name}</Text>
            <View>
              <Avatar userId={me} size={28} />
              {requests > 0 && <View style={styles.badge} />}
            </View>
          </Pressable>
        </View>
        {usingMock && <Text style={styles.mock}>Demo data · tap your name to switch accounts</Text>}

        <View style={styles.body}>
          {tab === 'dashboard' && <DashboardScreen key={me} userId={me} />}
          {tab === 'review' && <QueueScreen key={me} userId={me} />}
          {tab === 'ask' && <SubmitScreen key={me} userId={me} onSubmitted={() => setTab('dashboard')} />}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Icon name={t.icon} size={22} color={on ? colors.ink : colors.muted} weight={on ? 2.1 : 1.7} />
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                <View style={[styles.tabDot, on && { backgroundColor: colors.brand }]} />
              </Pressable>
            );
          })}
        </View>
        <FriendsSheet
          visible={profileOpen}
          userId={me}
          onClose={() => setProfileOpen(false)}
          onSwitchUser={setMe}
          onChange={(s) => setRequests(s.incoming.length)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 3,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  meText: { fontWeight: '600', color: colors.ink },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.card,
  },
  mock: { paddingHorizontal: 20, color: colors.muted, fontSize: 12 },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.2 },
  tabLabelOn: { color: colors.ink },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});
