import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let currentToken: string | null = null;

/**
 * Asks for permission and stores this device's Expo push token for the user.
 * Quietly does nothing on web, in Expo Go, on simulators, or if permission is
 * denied: push needs a development or store build.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return; // set by `eas init`

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = token;
  await api.savePushToken(userId, token, Platform.OS);
}

/** Stops this device getting pushes for the account that's signing out. */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  await api.removePushToken(currentToken).catch(() => {});
  currentToken = null;
}

/** Where a tapped notification should take you (set by the notify function). */
export function urlFromResponse(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
}
