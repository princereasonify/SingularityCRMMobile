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
