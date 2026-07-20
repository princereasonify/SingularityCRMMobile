// ─── Theme barrel export ──────────────────────────────────────────────────────
// Usage: import { Colors, Typography, Spacing, Radius, Shadows, CS } from '../../theme'

export { Palette, Colors, getScoreColor, getProgressColor, getStatusColor, getTargetStatusColor } from './colors';
export { Typography } from './typography';
export { Spacing, Radius } from './spacing';
export { Fonts, Wordmark, Type, Sunstone } from './fonts';
export { getAuthTheme } from './authTheme';
export type { AuthTheme } from './authTheme';
export { getAppTheme } from './appTheme';
export type { AppTheme } from './appTheme';
export { Shadows } from './shadows';
export { CS } from './components';
export { withAlpha, SOFT_TINT } from './alpha';
