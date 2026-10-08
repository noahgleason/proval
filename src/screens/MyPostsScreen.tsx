import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { reactionFor, statusOf, type Photo, type PhotoStatus } from '../types';
import { colors, radius } from '../theme';
import { userById } from '../users';

type Props = { userId: string };

const STATUS: Record<PhotoStatus, { label: string; fg: string; bg: string }> = {
  approved: { label: 'Good to post ✅', fg: colors.approve, bg: colors.approveSoft },
  denied: { label: 'Don’t post 🚫', fg: colors.deny, bg: colors.denySoft },
  pending: { label: 'Waiting…', fg: colors.pending, bg: colors.pendingSoft },
};

/** Photos you submitted, with where each friend stands. */
export function MyPostsScreen({ userId }: Props) {
  const [posts, setPosts] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await api.myPosts(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      ListHeaderComponent={<Text style={styles.h1}>My requests</Text>}
      ListEmptyComponent={
        loading ? null : <Text style={styles.empty}>You haven’t asked anyone yet. Send a photo from the Ask tab.</Text>
      }
      renderItem={({ item }) => {
        const s = STATUS[statusOf(item)];
        return (
          <View style={styles.card}>
            <View style={styles.top}>
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.caption} numberOfLines={1}>
                  {item.caption || 'Untitled'}
                </Text>
                <View style={[styles.badge, { backgroundColor: s.bg }]}>
                  <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
                </View>
              </View>
            </View>

            {item.taggedIds.map((id) => {
              const r = item.reviews[id];
              const reaction = reactionFor(r?.reaction);
              const verdict = !r ? 'hasn’t answered' : r.decision === 'approve' ? 'approved' : 'denied';
              const color = !r ? colors.muted : r.decision === 'approve' ? colors.approve : colors.deny;
              return (
                <View key={id} style={styles.reviewRow}>
                  <Avatar userId={id} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewLine}>
                      <Text style={{ fontWeight: '700' }}>{userById(id).name}</Text>{' '}
                      <Text style={{ color }}>{verdict}</Text>
                      {reaction ? `  ·  ${reaction.emoji} ${reaction.label}` : ''}
                    </Text>
                    {!!r?.comment && <Text style={styles.comment}>“{r.comment}”</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 64, height: 80, borderRadius: radius.sm, backgroundColor: colors.line },
  caption: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontWeight: '700', fontSize: 12 },
  reviewRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reviewLine: { color: colors.ink },
  comment: { color: colors.muted, fontStyle: 'italic', marginTop: 2 },
});
