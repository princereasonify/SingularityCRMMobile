/**
 * Push Notification Service — mirrors web's firebase.js
 * Uses @react-native-firebase/messaging for FCM on Android & iOS.
 */

import messaging from '@react-native-firebase/messaging';
import { notificationsApi } from '../api/notifications';

export interface FcmMessage {
  title: string;
  body: string;
  type: string;
}

/**
 * Requests notification permission (iOS) and registers the FCM token
 * with the backend. Call this right after login — same as web's
 * requestNotificationPermission() called inside handleLogin().
 */
export async function requestFCMPermission(): Promise<void> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    const token = await messaging().getToken();
    if (token) {
      await notificationsApi.saveFcmToken(token).catch(() => {});
    }
  } catch {}
}

/**
 * Sets up a foreground message listener. Returns the unsubscribe function.
 * Call this after the user is logged in — same as web's onForegroundMessage()
 * used inside the useEffect in App.jsx.
 */
export function onForegroundMessage(
  callback: (msg: FcmMessage) => void,
): () => void {
  return messaging().onMessage(async remoteMessage => {
    callback({
      title:
        remoteMessage.notification?.title ||
        (remoteMessage.data?.title as string) ||
        'Notification',
      body:
        remoteMessage.notification?.body ||
        (remoteMessage.data?.body as string) ||
        '',
      type: (remoteMessage.data?.type as string) || 'Info',
    });
  });
}

/**
 * Registers the background / quit-state message handler.
 * Must be called once at app startup (index.js), before AppRegistry.
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async _remoteMessage => {
    // FCM delivers background notifications as system notifications automatically.
    // No extra work needed here — the OS displays them natively.
  });
}
