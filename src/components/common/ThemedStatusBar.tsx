import React from 'react';
import { StatusBar, Platform } from 'react-native';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * App-wide status/notification bar. Mounted once inside ThemeProvider so it can react
 * to the user's light/dark choice — the previous root <StatusBar> was hardcoded to
 * `light-content`, which rendered white icons over the light theme's pale background
 * (effectively invisible). Icons are now dark on light, light on dark.
 *
 * The bar stays translucent with a transparent background so the app draws edge-to-edge
 * behind the Dynamic Island / notch; screens pad by useSafeAreaInsets().top so no content
 * hides under it.
 */
export default function ThemedStatusBar() {
  const T = useAppTheme();
  return (
    <StatusBar
      barStyle={T.isDark ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent
      {...(Platform.OS === 'android' ? { animated: true } : null)}
    />
  );
}
