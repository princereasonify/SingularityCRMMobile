// Per-device orientation policy — the single source of truth.
//   Phones (iPhone / Android phone)  → portrait everywhere.
//   Tablets (iPad / Android tablet)  → landscape everywhere.
//
// The native plist/manifest declares the ALLOWED set (the ceiling); these helpers
// pick the ACTUAL lock per device at runtime via react-native-orientation-locker.
// Both layers are required — if the plist doesn't allow an orientation, the lock
// call is a silent no-op.
import Orientation from 'react-native-orientation-locker';
import { isTabletDevice } from './responsive';

/** Lock to portrait. */
export const lockPortrait = (): void => {
  try {
    Orientation.lockToPortrait();
  } catch {
    /* no-op if the native module is absent (Jest, fresh install pre-rebuild) */
  }
};

/** Lock to landscape. */
export const lockLandscape = (): void => {
  try {
    Orientation.lockToLandscape();
  } catch {
    /* no-op */
  }
};

/** Allow free rotation (rarely needed — e.g. a fullscreen media viewer). */
export const unlockOrientation = (): void => {
  try {
    Orientation.unlockAllOrientations();
  } catch {
    /* no-op */
  }
};

/** Orientation for the LOGIN / auth flow: tablet → landscape, phone → portrait. */
export const applyLoginOrientation = (): void => {
  if (isTabletDevice) lockLandscape();
  else lockPortrait();
};

/** Orientation for the AUTHENTICATED app: tablet → landscape, phone → portrait. */
export const applyAuthedOrientation = (): void => {
  if (isTabletDevice) lockLandscape();
  else lockPortrait();
};
