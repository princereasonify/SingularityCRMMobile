import { useRef, useCallback } from 'react';
import { Animated, Platform, Vibration } from 'react-native';

/**
 * Press feel for the app's own keyboards (CustomKeyboard, NumField).
 *
 * The app deliberately replaces the system keyboard (`showSoftInputOnFocus={false}`), and in
 * doing so it also gave up everything the OS keyboard does for free: the key that dips under
 * your thumb, and the click. Without them a tap is silent and motionless, and the keyboard
 * reads as unresponsive even when every keystroke registered.
 *
 * ── Animation ──
 * A spring dip to 0.92 on press-in and a springy return on press-out, on the native driver so
 * it never stutters behind a slow JS frame — which matters most here, because a fast typist
 * generates presses faster than JS can lay out a re-render.
 *
 * ── Feedback ──
 * Deliberately a short vibration on Android only, and nothing on iOS. This is not an
 * oversight:
 *
 *   • Android's `Vibration.vibrate(ms)` honours the duration, so 8 ms is a crisp tick that
 *     reads exactly like a keypress.
 *   • iOS ignores the duration entirely and fires a full ~400 ms buzz. On a keyboard that is
 *     not feedback, it is a fault — it would run continuously while typing.
 *
 * React Native's core has no light-impact haptic and no audio API, so a real iOS keyclick
 * (`AudioServicesPlaySystemSound(1104)`) or a light impact generator needs either a native
 * module or a dependency such as react-native-haptic-feedback. `keyTick` is the single seam
 * for that: swap its body and both keyboards get it, with no other file touched.
 */

/** How long the Android tick lasts. Short enough to feel like a key, not a notification. */
const TICK_MS = 8;

export const keyTick = () => {
  // Android only — see the note above on why iOS is intentionally silent here.
  if (Platform.OS === 'android') Vibration.vibrate(TICK_MS);
};

export interface KeyPressAnim {
  scale: Animated.Value;
  pressIn: () => void;
  pressOut: () => void;
}

/**
 * One animated value per key. Called from inside the key component so each key springs
 * independently — a shared value would make the whole row move together.
 */
export const useKeyPress = (): KeyPressAnim => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    keyTick();
    // No bounciness on the way DOWN: a key that overshoots on press feels loose.
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scale]);

  const pressOut = useCallback(() => {
    // A little bounce on the way back is what reads as "springy" rather than "sticky".
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 10,
    }).start();
  }, [scale]);

  return { scale, pressIn, pressOut };
};
