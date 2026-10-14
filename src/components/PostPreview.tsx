import { useRef, useState } from 'react';
import { Image, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Decision, Photo, RequestKind } from '../types';
import { colors, radius, type } from '../theme';
import { userById } from '../users';
import { AppModal } from './AppModal';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

export type PreviewPost = {
  uploaderId: string;
  kind: RequestKind;
  caption: string;
  photos: Pick<Photo, 'imageUrl' | 'taggedIds'>[];
};

type Props = {
  post: PreviewPost | null;
  /** Who's looking, so their own name reads as "you". */
  viewerId: string;
  onClose: () => void;
  /** Which photo to open on. */
  startIndex?: number;
  /** Marks one photo as "the one you're answering". */
  highlightIndex?: number;
  /** Reviewers can decide straight from the preview of a single photo. */
  onDecide?: (d: Decision) => void;
};

/** The post as it would land in a feed: who posted it, the photos (swipe through a carousel), the caption, who's tagged. */
export function PostPreview({ post, viewerId, onClose, startIndex = 0, highlightIndex, onDecide }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollView>(null);
  if (!post) return null;

  const author = userById(post.uploaderId);
  const mine = post.uploaderId === viewerId;
  const count = post.photos.length;
  const current = post.photos[Math.min(index, count - 1)];
  const tagged = current.taggedIds.map((id) => (id === viewerId ? 'you' : userById(id).name));
  const title = post.kind === 'story' ? (mine ? 'Your story' : `${author.name}’s story`) : mine ? 'Your post' : `${author.name}’s post`;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <AppModal visible onClose={onClose} kind="page" width={520}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Preview · not posted</Text>
            <Text style={styles.title}>{title}</Text>
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

            <View
              style={styles.frame}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setWidth(w);
                scroller.current?.scrollTo({ x: index * w, animated: false });
              }}
            >
              <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
                onScroll={onScrollEnd}
                scrollEventThrottle={64}
                scrollEnabled={count > 1}
              >
                {post.photos.map((p, i) => (
                  <Image key={i} source={{ uri: p.imageUrl }} style={[styles.image, { width: width || 1 }]} />
                ))}
              </ScrollView>
              {count > 1 && (
                <View style={styles.counter}>
                  <Text style={styles.counterText}>
                    {index + 1}/{count}
                  </Text>
                </View>
              )}
              {highlightIndex === index && count > 1 && (
                <View style={styles.yours}>
                  <Icon name="check" size={12} color="#fff" weight={2.8} />
                  <Text style={styles.yoursText}>The one you’re answering</Text>
                </View>
              )}
              {count > 1 && index > 0 && (
                <Pressable onPress={() => go(index - 1)} style={[styles.arrow, { left: 10 }]} accessibilityLabel="Previous photo">
                  <Icon name="chevronLeft" size={18} color={colors.ink} weight={2.4} />
                </Pressable>
              )}
              {count > 1 && index < count - 1 && (
                <Pressable onPress={() => go(index + 1)} style={[styles.arrow, { right: 10 }]} accessibilityLabel="Next photo">
                  <Icon name="chevronRight" size={18} color={colors.ink} weight={2.4} />
                </Pressable>
              )}
            </View>

            <View style={styles.icons}>
              <Icon name="heart" size={23} />
              <Icon name="bubble" size={23} />
              <Icon name="share" size={22} />
              <View style={{ flex: 1 }}>
                {count > 1 && (
                  <View style={styles.dots}>
                    {post.photos.map((_, i) => (
                      <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
                    ))}
                  </View>
                )}
              </View>
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
                <Text style={styles.withText}>
                  {tagged.length ? `${count > 1 ? 'This photo: ' : ''}with ${joinNames(tagged)}` : 'Nobody tagged in this photo'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {onDecide && count === 1 && (
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
    </AppModal>
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
  frame: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.line },
  image: { height: '100%', backgroundColor: colors.line },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  yours: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  yoursText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingTop: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.brand },
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
