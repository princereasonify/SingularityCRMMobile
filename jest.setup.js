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
