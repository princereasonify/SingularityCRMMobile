import { Platform, ViewStyle } from 'react-native';

// ─── Shadow Presets ───────────────────────────────────────────────────────────
export const Shadows = {
  sm: Platform.select<ViewStyle>({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
    android: { elevation: 1 },
  })!,
  md: Platform.select<ViewStyle>({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    android: { elevation: 3 },
  })!,
  lg: Platform.select<ViewStyle>({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 6 },
  })!,
} as const;
