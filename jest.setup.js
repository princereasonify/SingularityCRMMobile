/**
 * Jest environment setup.
 *
 * App.tsx pulls in the whole provider tree, so rendering it in a test process means every
 * native module it touches needs a JS stand-in. These are the libraries' own official mocks
 * wherever one is published; only the ones with no published mock are hand-stubbed, and each
 * stub covers just the surface the app actually calls.
 */

// ── Official mocks published by the libraries themselves ──────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock'),
);

// ── Firebase messaging + Notifee (native-only; the app wires them in pushNotificationService) ──
jest.mock('@react-native-firebase/app', () => ({ __esModule: true, default: () => ({}), getApp: () => ({}) }));
jest.mock('@react-native-firebase/messaging', () => {
  const inst = {
    requestPermission: jest.fn().mockResolvedValue(1),
    getToken: jest.fn().mockResolvedValue('test-token'),
    onMessage: jest.fn(() => () => {}),
    onTokenRefresh: jest.fn(() => () => {}),
    onNotificationOpenedApp: jest.fn(() => () => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    setBackgroundMessageHandler: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
    hasPermission: jest.fn().mockResolvedValue(1),
    deleteToken: jest.fn().mockResolvedValue(undefined),
  };
  const fn = () => inst;
  return { __esModule: true, default: fn, getMessaging: fn, AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0, NOT_DETERMINED: -1 } };
});
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('ch'),
    displayNotification: jest.fn().mockResolvedValue('id'),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    setBadgeCount: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  AndroidVisibility: { PUBLIC: 1, PRIVATE: 0, SECRET: -1 },
  EventType: { PRESS: 1, DISMISSED: 0, ACTION_PRESS: 2 },
}));

require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

// ── Remaining native-only libraries: a generic stand-in whose every member is a jest.fn ──
const stub = () => {
  const fn = jest.fn(() => stub());
  return new Proxy(fn, {
    get: (t, k) => (k === '__esModule' ? true : k === 'then' ? undefined : k === 'default' ? stub() : t[k] ?? (t[k] = jest.fn(() => stub()))),
  });
};
[
  'react-native-orientation-locker', '@react-native-community/geolocation', 'react-native-background-actions',
  'react-native-background-fetch', 'react-native-biometrics', 'react-native-keychain', 'react-native-image-picker',
  'react-native-html-to-pdf', 'react-native-share', 'react-native-audio-recorder-player', 'react-native-maps',
  '@react-native-documents/picker', 'react-native-nitro-modules',
].forEach((name) => jest.mock(name, () => stub(), { virtual: false }));
