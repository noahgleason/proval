import { Image, StyleSheet, Text, View } from 'react-native';
import { userById } from '../users';

type Props = { userId: string; size?: number; ring?: string };

/** Someone's profile photo, or their first letter on their color when they haven't set one. */
export function Avatar({ userId, size = 32, ring }: Props) {
  const user = userById(userId);
  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: user.color,
    borderColor: ring ?? 'transparent',
    borderWidth: ring ? 2 : 0,
  };
  if (user.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} style={shape} accessibilityLabel={user.name} />;
  }
  return (
    <View style={[styles.circle, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{user.name[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
});
