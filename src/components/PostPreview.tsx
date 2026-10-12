import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Decision, Photo } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PhoneFrame } from './PhoneFrame';

type Props = {
  post: Pick<Photo, 'uploaderId' | 'caption' | 'taggedIds' | 'imageUrl'> | null;
  /** Who's looking, so their own name reads as "you". */
  viewerId: string;
  onClose: () => void;
  /** Reviewers can decide straight from the preview. */
  onDecide?: (d: Decision) => void;
};

/** The post as it would land in a feed: who posted it, the photo, the caption, who's tagged. */
export function PostPreview({ post, viewerId, onClose, onDecide }: Props) {
  if (!post) return null;
  const author = userById(post.uploaderId);
  const mine = post.uploaderId === viewerId;
  const tagged = post.taggedIds.map((id) => (id === viewerId ? 'you' : userById(id).name));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <PhoneFrame>
        <View style={styles.screen}>
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Preview · not posted</Text>
              <Text style={styles.title}>{mine ? 'Your post' : `${author.name}’s post`}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close preview">
              <Icon name="x" size={18} color={colors.ink} weight={2.2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.post}>
              <View style={styles.postHead}>
                <Avatar userId={author.id} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.author}>{author.name}</Text>
                  <Text style={styles.handle}>@{author.username}</Text>
                </View>
                <Icon name="dots" size={20} color={colors.muted} />
              </View>

              <Image source={{ uri: post.imageUrl }} style={styles.image} />

              <View style={styles.icons}>
                <Icon name="heart" size={23} />
                <Icon name="bubble" size={23} />
                <Icon name="share" size={22} />
                <View style={{ flex: 1 }} />
                <Icon name="bookmark" size={22} />
              </View>

              <View style={styles.body}>
                {!!post.caption && (
                  <Text style={styles.caption}>
                    <Text style={styles.author}>{author.username} </Text>
                    {post.caption}
                  </Text>
                )}
                <View style={styles.with}>
                  <Icon name="users" size={14} color={colors.muted} weight={2} />
                  <Text style={styles.withText}>with {joinNames(tagged)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {onDecide && (
            <View style={styles.actions}>
              <Pressable onPress={() => onDecide('deny')} style={[styles.btn, styles.deny]}>
                <Icon name="x" size={18} color={colors.deny} weight={2.4} />
                <Text style={[styles.btnText, { color: colors.deny }]}>Don’t post</Text>
              </Pressable>
              <Pressable onPress={() => onDecide('approve')} style={[styles.btn, styles.approve]}>
                <Icon name="check" size={18} color="#fff" weight={2.4} />
                <Text style={[styles.btnText, { color: '#fff' }]}>Post it</Text>
              </Pressable>
            </View>
          )}
        </View>
      </PhoneFrame>
    </Modal>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 },
  eyebrow: { ...type.label, color: colors.brand },
  title: { ...type.title, color: colors.ink },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  post: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  author: { fontWeight: '700', color: colors.ink },
  handle: { color: colors.muted, fontSize: 12 },
  image: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.line },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingTop: 12 },
  body: { padding: 14, paddingTop: 10, gap: 8 },
  caption: { color: colors.ink, lineHeight: 20 },
  with: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  withText: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 15,
    borderRadius: radius.pill,
  },
  deny: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  approve: { backgroundColor: colors.ink },
  btnText: { fontWeight: '700', fontSize: 16 },
});
