/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundFetch from 'react-native-background-fetch';
import { sendLocationPing } from './src/services/locationPingService';
import { captureAndSendB2CPing } from './src/services/b2cLocationPingService';
import { registerBackgroundHandler } from './src/services/pushNotificationService';
import { setTokenRefreshedHandler } from './src/api/client';
import { updateNativeAuthToken } from './src/services/nativeLocationTracking';

// The headless task has no React tree, so it can't read AuthContext — it decides which
// tracking pipeline to use straight from the persisted user's role.
const B2C_ROLES = ['B2CAdmin', 'Agent', 'Counselor'];
const isB2CUser = async () => {
  try {
    const raw = await AsyncStorage.getItem('auth_user');
    return raw ? B2C_ROLES.includes(JSON.parse(raw)?.role) : false;
  } catch {
    return false;
  }
};

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
    // Route to the right pipeline: B2C users hit /b2c/tracking, everyone else B2B.
    if (await isB2CUser()) await captureAndSendB2CPing();
    else await sendLocationPing();
  } catch (e) {
    console.warn('[BackgroundFetch] Error in headless task:', e);
  }

  BackgroundFetch.finish(taskId);
};

// Register the headless task — must be done before AppRegistry.registerComponent
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

AppRegistry.registerComponent(appName, () => App);
