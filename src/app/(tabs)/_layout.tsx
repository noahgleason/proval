import { router, useFocusEffect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usingMock } from '../../api';
import { Avatar } from '../../components/Avatar';
import { useBadges, useIncomingRequests, type Badges } from '../../badges';
import { FriendRequestBanner } from '../../components/FriendRequestBanner';
import { BarButton, CountBubble, DesktopBar, isHovered, NavLink } from '../../components/DesktopBar';
import { Icon, LogoMark, type IconName } from '../../components/Icon';
import { useIsDesktop } from '../../components/PhoneFrame';
import { useSession } from '../../session';
import { colors, radius } from '../../theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Dashboard', icon: 'grid' },
  review: { label: 'Review', icon: 'cards' },
  ask: { label: 'Ask', icon: 'send' },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const { userId } = useSession();
  const { incoming, reload } = useIncomingRequests(userId);
  // Coming back from the profile (where requests are answered) re-checks.
  useFocusEffect(reload);
  const requests = incoming.length;
  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {!desktop && <Header requests={requests} />}
      {!desktop && <FriendRequestBanner userId={userId} incoming={incoming} />}
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, tabBarPosition: desktop ? 'top' : 'bottom' }}
        tabBar={(p) =>
          desktop ? (
            <View>
              <TopNav {...p} requests={requests} />
              <FriendRequestBanner userId={userId} incoming={incoming} desktop />
            </View>
          ) : (
            <TabBar {...p} />
          )
        }
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="review" />
        <Tabs.Screen name="ask" />
      </Tabs>
    </View>
  );
}

/** Your name and photo, with how many friend requests are waiting. */
function FriendCount({ requests }: { requests: number }) {
  return <CountBubble count={requests} style={styles.friendBubble} />;
}

function Header({ requests }: { requests: number }) {
  const { userId, me } = useSession();

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.brand}>
          <LogoMark size={26} />
          <Text style={styles.logo}>proval</Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          style={styles.me}
          accessibilityLabel={requests ? `Profile and friends, ${requests} friend ${requests === 1 ? 'request' : 'requests'}` : 'Profile and friends'}
        >
          <Text style={styles.meText}>{me?.name}</Text>
          <View>
            <Avatar userId={userId} size={28} />
            <FriendCount requests={requests} />
          </View>
        </Pressable>
      </View>
      {usingMock && <Text style={styles.mock}>Demo data · tap your name to switch accounts</Text>}
    </View>
  );
}

/** Desktop: the tabs become a website header. */
function TopNav({ state, navigation, requests }: BottomTabBarProps & { requests: number }) {
  const { userId, me } = useSession();
  const current = state.routes[state.index]?.name;
  const badges = useBadges(userId);
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !e.defaultPrevented) navigation.navigate(name);
  };

  return (
    <DesktopBar onLogoPress={() => go('index')}>
      <View style={styles.navLinks}>
        <NavLink label="Dashboard" active={current === 'index'} onPress={() => go('index')} count={countFor('index', badges, current)} />
        <NavLink label="Review" active={current === 'review'} onPress={() => go('review')} count={countFor('review', badges, current)} />
      </View>
      <View style={{ flex: 1 }} />
      {usingMock && <Text style={styles.mockPill}>Demo data</Text>}
      <BarButton label="New request" solid onPress={() => go('ask')} />
      <Pressable
        onPress={() => router.push('/profile')}
        style={(s) => [styles.me, isHovered(s) && { borderColor: colors.muted }]}
        accessibilityLabel={requests ? `Profile and friends, ${requests} friend ${requests === 1 ? 'request' : 'requests'}` : 'Profile and friends'}
      >
        <Text style={styles.meText}>{me?.name}</Text>
        <View>
          <Avatar userId={userId} size={28} />
          <FriendCount requests={requests} />
        </View>
      </Pressable>
    </DesktopBar>
  );
}

/** Dashboard's number clears while you're on it; Review's always shows what's left to answer. */
function countFor(tab: string, badges: Badges, current: string | undefined): number {
  if (tab === 'review') return badges.review;
  if (tab === 'index' && current !== 'index') return badges.dashboard;
  return 0;
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const badges = useBadges(userId);
  const current = state.routes[state.index]?.name;
  return (
    <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const on = state.index === i;
        const count = countFor(route.name, badges, current);
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={count ? `${tab.label}, ${count} new` : tab.label}
          >
            <View>
              <Icon name={tab.icon} size={22} color={on ? colors.ink : colors.muted} weight={on ? 2.1 : 1.7} />
              <CountBubble count={count} style={styles.tabBubble} />
            </View>
            <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
            <View style={[styles.tabDot, on && { backgroundColor: colors.brand }]} />
          </Pressable>
        );
      })}
    </View>
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
  friendBubble: { position: 'absolute', top: -7, right: -8, borderWidth: 2, borderColor: colors.card },
  mock: { paddingHorizontal: 20, color: colors.muted, fontSize: 12 },
  navLinks: { flexDirection: 'row', gap: 28, marginLeft: 32 },
  mockPill: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.pending,
    backgroundColor: colors.pendingSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
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
  tabBubble: { position: 'absolute', top: -6, left: 13, borderWidth: 2, borderColor: colors.bg, height: 20, minWidth: 20, borderRadius: 10 },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});
