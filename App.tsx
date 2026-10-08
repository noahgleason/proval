import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { usingMock } from './src/api';
import { Avatar } from './src/components/Avatar';
import { MyPostsScreen } from './src/screens/MyPostsScreen';
import { QueueScreen } from './src/screens/QueueScreen';
import { SubmitScreen } from './src/screens/SubmitScreen';
import { colors, radius } from './src/theme';
import { USERS, userById } from './src/users';

type Tab = 'review' | 'ask' | 'mine';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'review', label: 'Review', icon: '🃏' },
  { id: 'ask', label: 'Ask', icon: '📤' },
  { id: 'mine', label: 'My requests', icon: '📋' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('review');
  // Placeholder "login": tap your avatar to switch which friend you are.
  const [me, setMe] = useState(USERS[0].id);

  const nextUser = () => {
    const i = USERS.findIndex((u) => u.id === me);
    setMe(USERS[(i + 1) % USERS.length].id);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <Text style={styles.logo}>proval</Text>
          <Pressable onPress={nextUser} style={styles.me} accessibilityLabel="Switch user">
            <Text style={styles.meText}>{userById(me).name}</Text>
            <Avatar userId={me} size={30} />
          </Pressable>
        </View>
        {usingMock && <Text style={styles.mock}>Demo data · tap your name to switch friends</Text>}

        <View style={styles.body}>
          {tab === 'review' && <QueueScreen key={me} userId={me} />}
          {tab === 'ask' && <SubmitScreen key={me} userId={me} onSubmitted={() => setTab('mine')} />}
          {tab === 'mine' && <MyPostsScreen key={me} userId={me} />}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={styles.tabIcon}>{t.icon}</Text>
                <Text style={[styles.tabLabel, on && { color: colors.brand }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  logo: { fontSize: 28, fontWeight: '900', color: colors.brand, letterSpacing: -1 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meText: { fontWeight: '700', color: colors.ink },
  mock: { paddingHorizontal: 16, color: colors.muted, fontSize: 12 },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.md },
  tabOn: { backgroundColor: colors.brandSoft },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 2 },
});
