import { router } from 'expo-router';
import { SubmitScreen } from '../../screens/SubmitScreen';
import { useUserId } from '../../session';

export default function Ask() {
  const userId = useUserId();
  return <SubmitScreen key={userId} userId={userId} onSubmitted={() => router.navigate('/')} />;
}
