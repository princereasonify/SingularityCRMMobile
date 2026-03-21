/**
 * iOS shim for react-native-background-actions.
 * On iOS the native module may not initialize correctly with RN New Architecture.
 * Background tracking on iOS is handled via react-native-background-fetch instead.
 * All methods are no-ops so the screen compiles and runs without crashing.
 */
const BackgroundServiceShim = {
  start: async () => {},
  stop: async () => {},
  isRunning: () => false,
  updateNotification: async () => {},
};

export default BackgroundServiceShim;
