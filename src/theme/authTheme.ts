import { ColorSchemeName } from 'react-native';

// Theme-aware tokens for the auth screens (login / signup / delete-account).
// Values are the SAME neutrals as appTheme, taken verbatim from
// SingularityCRM-Components.html ("Neutrals — light & dark", "Status colors").
// The gradient hero panel stays Sunstone gold in both themes; only the form side
// flips light ↔ dark.
export interface AuthTheme {
  isDark: boolean;
  panelBg: string;    // form-side background  (spec: bg)
  card: string;       // input / secondary-button surface (spec: card)
  cardAlt: string;    // subtle fill (spec: card-alt)
  text: string;       // primary text
  sub: string;        // secondary text (.55)
  dim: string;        // placeholder / muted (.40)
  line: string;       // hairline border (.09)
  lineStrong: string; // .16 — secondary-button border
  fieldBg: string;    // input background
  accentText: string; // label / link / focus accent
  success: string;
  danger: string;
}

const LIGHT: AuthTheme = {
  isDark: false,
  panelBg: '#F4F0E8',
  card: '#FFFFFF',
  cardAlt: '#F7F3EC',
  text: '#211B12',
  sub: 'rgba(33,27,18,0.55)',
  dim: 'rgba(33,27,18,0.40)',
  line: 'rgba(33,27,18,0.09)',
  lineStrong: 'rgba(33,27,18,0.16)',
  fieldBg: '#FFFFFF',
  accentText: '#8C5A2E',
  success: '#4C8C5C',
  danger: '#C2492D',
};

const DARK: AuthTheme = {
  isDark: true,
  panelBg: '#131009',
  card: '#1D1811',
  cardAlt: '#241E15',
  text: '#F4EEE2',
  sub: 'rgba(244,238,226,0.55)',
  dim: 'rgba(244,238,226,0.40)',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.16)',
  fieldBg: '#1D1811',
  accentText: '#E0B057', // spec: accent (dark mode)
  success: '#5FA06F',    // spec success lifted for contrast on dark
  danger: '#E0725C',     // spec error lifted for contrast on dark surfaces
};

export const getAuthTheme = (scheme: ColorSchemeName): AuthTheme =>
  scheme === 'dark' ? DARK : LIGHT;

// ─── B2C (student enrollment) — GREEN family ──────────────────────────────────
// Same neutral scaffolding as the B2B/default theme, only the surfaces are tinted
// green and the accent/success flip from Sunstone gold to the B2C green. This is
// DESIGN ONLY — the login logic reads every colour through `T`, so re-pointing the
// theme is all that turns the B2C login green.
const B2C_LIGHT: AuthTheme = {
  ...LIGHT,
  panelBg: '#eef3ea',
  card: '#FFFFFF',
  fieldBg: '#FFFFFF',
  accentText: '#5aa832',
  success: '#5aa832',
};

const B2C_DARK: AuthTheme = {
  ...DARK,
  panelBg: '#0f140c',
  card: '#141a10',
  cardAlt: '#161d12',
  fieldBg: '#141a10',
  accentText: '#8fd14f',
  success: '#8fd14f',
};

/**
 * Family-aware auth theme selector. `b2c` → the green theme above; anything else
 * (default `b2b`) falls through to the unchanged Sunstone `getAuthTheme`.
 */
export const getAuthThemeFor = (
  family: 'b2b' | 'b2c',
  scheme: ColorSchemeName,
): AuthTheme =>
  family === 'b2c' ? (scheme === 'dark' ? B2C_DARK : B2C_LIGHT) : getAuthTheme(scheme);
