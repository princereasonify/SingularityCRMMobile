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
