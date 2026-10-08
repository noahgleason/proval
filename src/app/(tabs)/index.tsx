import { DashboardScreen } from '../../screens/DashboardScreen';
import { useUserId } from '../../session';

export default function Dashboard() {
  const userId = useUserId();
  return <DashboardScreen key={userId} userId={userId} />;
}
