import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PhoneFrame, useIsDesktop } from '../components/PhoneFrame';
import { takePendingLink } from '../lib/share';
import { urlFromResponse } from '../notifications';
import { SessionProvider, useSession } from '../session';
import { colors } from '../theme';
import { ThemeProvider, useThemeMode } from '../themeMode';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <ThemedStatusBar />
            <PhoneFrame>
              <RootStack />
            </PhoneFrame>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  return <StatusBar style={useThemeMode().scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootStack() {
  const { status } = useSession();
  const ready = status === 'ready';
  // Desktop opens these as ordinary pages; phones slide them up.
  const presentation = useIsDesktop() ? 'card' : 'modal';

  // Tapping a notification opens the screen it's about.
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync().then((r) => {
      const url = urlFromResponse(r);
      if (url) router.navigate(url as never);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = urlFromResponse(r);
      if (url) router.navigate(url as never);
    });
    return () => sub.remove();
  }, [ready]);

  // Signed in from a group-chat link (Google sign-in leaves and returns to /): go back to it.
  useEffect(() => {
    if (!ready) return;
    const token = takePendingLink();
    if (token) setTimeout(() => router.replace(`/l/${token}` as never), 0);
  }, [ready]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ presentation }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsProfile'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ presentation }} />
      {/* Group-chat links work signed in or out. */}
      <Stack.Screen name="l/[token]" />
    </Stack>
  );
}
