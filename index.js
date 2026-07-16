/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from 'react-native-background-fetch';
import { sendLocationPing } from './src/services/locationPingService';
import { registerBackgroundHandler } from './src/services/pushNotificationService';
import { setTokenRefreshedHandler } from './src/api/client';
import { updateNativeAuthToken } from './src/services/nativeLocationTracking';

// Register FCM background handler — must be called before AppRegistry
registerBackgroundHandler();

// ─── Keep the native tracking service's token in sync — even with the app killed ──
// The native Android service reads its token from SharedPreferences, while JS stores
// tokens in AsyncStorage: two separate stores. Whenever JS mints a new access token it
// must copy it across, or the service keeps pinging with the expired one and every fix
// is rejected.
//
// This is registered HERE, at module scope, rather than only inside AuthContext, because
// the headless task below runs with no React tree mounted — AuthContext's effect never
// fires in that context, so a token refreshed by a headless ping would never reach the
// service. AuthProvider overrides this with a richer handler once the UI is up.
setTokenRefreshedHandler((token) => {
  updateNativeAuthToken(token).catch(() => {});
});

// ─── Headless Background Fetch Task ──────────────────────────────────────────
// This runs even when the app is completely killed by the user.
// Android WorkManager wakes the device and executes this task periodically.
// Must finish within 30 seconds — call BackgroundFetch.finish(taskId).
const backgroundFetchHeadlessTask = async (event) => {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  console.log('[BackgroundFetch] Headless task fired. taskId:', taskId, '| timeout:', isTimeout);

  if (isTimeout) {
    // OS gave us too little time — finish immediately
    console.warn('[BackgroundFetch] Timed out — finishing early');
    BackgroundFetch.finish(taskId);
    return;
  }

  try {
    await sendLocationPing();
  } catch (e) {
    console.warn('[BackgroundFetch] Error in headless task:', e);
  }

  BackgroundFetch.finish(taskId);
};

// Register the headless task — must be done before AppRegistry.registerComponent
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

AppRegistry.registerComponent(appName, () => App);
