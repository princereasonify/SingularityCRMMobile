/**
 * Push Notification Service
 * Uses @react-native-firebase/messaging for FCM on Android & iOS.
 * Background/foreground display uses @notifee/react-native.
 */

import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { notificationsApi } from '../api/notifications';

export interface FcmMessage {
  title: string;
  body: string;
  type: string;
}

export async function displayNotification(title: string, body: string): Promise<void> {
  await notifee.createChannel({
    id: 'default',
    name: 'Singularity CRM',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
  });
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: 'default',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
}

/**
 * Requests notification permission (iOS) and registers the FCM token.
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
 */
export function onForegroundMessage(
  callback: (msg: FcmMessage) => void,
): () => void {
  return messaging().onMessage(async remoteMessage => {
    const title =
      remoteMessage.notification?.title ||
      (remoteMessage.data?.title as string) ||
      'Notification';
    const body =
      remoteMessage.notification?.body ||
      (remoteMessage.data?.body as string) ||
      '';
    // Display a visible banner even when app is in foreground
    await displayNotification(title, body).catch(() => {});
    callback({
      title,
      body,
      type: (remoteMessage.data?.type as string) || 'Info',
    });
  });
}

/**
 * Listens for notifee foreground events (e.g. notification press).
 * Returns the unsubscribe function.
 */
export function onNotifeeEvent(onPress: () => void): () => void {
  return notifee.onForegroundEvent(({ type }) => {
    if (type === EventType.PRESS) {
      onPress();
    }
  });
}

/**
 * Registers the background / quit-state FCM handler.
 * Must be called BEFORE AppRegistry in index.js.
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    const title =
      remoteMessage.notification?.title ||
      (remoteMessage.data?.title as string) ||
      'New Notification';
    const body =
      remoteMessage.notification?.body ||
      (remoteMessage.data?.body as string) ||
      '';
    await displayNotification(title, body).catch(() => {});
  });

  // Handle notification press when app is in background (notifee banner tapped)
  notifee.onBackgroundEvent(async ({ type }) => {
    // EventType.PRESS = 1
    if (type === EventType.PRESS) {
      // Navigation happens via messaging().onNotificationOpenedApp() in App.tsx
    }
  });
}
