import { QueueScreen } from '../../screens/QueueScreen';
import { useUserId } from '../../session';

export default function Review() {
  const userId = useUserId();
  return <QueueScreen key={userId} userId={userId} />;
}
