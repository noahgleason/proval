import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert, but it also works on web, where React Native's Alert does
 * nothing. Web uses the browser's own dialogs: a message with no actions is
 * window.alert; otherwise window.confirm, and OK runs the first non-cancel button.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const action = buttons?.find((b) => b.style !== 'cancel');
  if (!action) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) action.onPress?.();
  else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
}
