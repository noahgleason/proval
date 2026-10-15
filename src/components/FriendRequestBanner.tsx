import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../api';
import { refreshBadges } from '../badges';
import { colors, radius } from '../theme';
import { userById } from '../users';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { desktopPage } from './PhoneFrame';

type Props = { userId: string; incoming: string[]; desktop?: boolean };

/**
 * "Sam wants to be friends", across the top of the main screens until you answer. Accept right
 * here, or open your profile to see them all (and decline).
 */
export function FriendRequestBanner({ userId, incoming, desktop }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (incoming.length === 0) return null;

  const first = userById(incoming[0]);
  const others = incoming.length - 1;
  const title =
    others === 0 ? `${first.name} wants to be friends` : `${first.name} and ${others} ${others === 1 ? 'other' : 'others'} want to be friends`;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.addFriend(userId, first.id);
      refreshBadges();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, desktop && styles.wrapDesktop]}>
      <View style={styles.banner} accessibilityRole="alert">
        <View>
          <Avatar userId={first.id} size={36} />
          <View style={styles.icon}>
            <Icon name="userPlus" size={11} color="#fff" weight={2.6} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {error ?? `@${first.username} · friends can tag each other in photos`}
          </Text>
        </View>
        {others === 0 ? (
          <>
            <Pressable onPress={() => router.push('/profile')} style={styles.ghost} accessibilityLabel={`See ${first.name}’s request`}>
              <Text style={styles.ghostText}>See</Text>
            </Pressable>
            <Pressable onPress={accept} disabled={busy} style={styles.solid}>
              {busy ? <ActivityIndicator size="small" color={colors.onInk} /> : <Text style={styles.solidText}>Accept</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => router.push('/profile')} style={styles.solid}>
            <Text style={styles.solidText}>See all {incoming.length}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 },
  wrapDesktop: { ...desktopPage, paddingTop: 16, paddingBottom: 0 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  icon: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  ghost: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill },
  ghostText: { color: colors.ink, fontWeight: '700' },
  solid: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.ink, minWidth: 76, alignItems: 'center' },
  solidText: { color: colors.onInk, fontWeight: '700' },
});
