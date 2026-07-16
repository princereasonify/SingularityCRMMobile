import { ColorSchemeName } from 'react-native';

// Theme-aware tokens for the auth screens (login / signup), taken verbatim from
// SingularityCRM-DesignSpec.html. The gradient hero panel stays Sunstone gold in
// both themes; only the form side flips light ↔ dark.
export interface AuthTheme {
  isDark: boolean;
  panelBg: string;   // form-side background
  card: string;      // input / secondary-button surface
  text: string;      // primary text
  sub: string;       // secondary text
  dim: string;       // placeholder / muted
  line: string;      // hairline border
  lineStrong: string;
  fieldBg: string;   // input background
  accentText: string; // label / link accent (readable on the form side)
  danger: string;
}

const LIGHT: AuthTheme = {
  isDark: false,
  panelBg: '#F8F5EF',
  card: '#FFFFFF',
  text: '#221C14',
  sub: 'rgba(34,28,20,0.55)',
  dim: 'rgba(34,28,20,0.45)',
  line: 'rgba(34,28,20,0.10)',
  lineStrong: 'rgba(34,28,20,0.16)',
  fieldBg: '#FFFFFF',
  accentText: '#8C5A2E',
  danger: '#C24E3A',
};

const DARK: AuthTheme = {
  isDark: true,
  panelBg: '#171412',
  card: '#221E1B',
  text: '#F5EFE8',
  sub: 'rgba(245,239,232,0.55)',
  dim: 'rgba(245,239,232,0.45)',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.20)',
  fieldBg: '#221E1B',
  accentText: '#D9A441',
  danger: '#E0725C',
};

export const getAuthTheme = (scheme: ColorSchemeName): AuthTheme =>
  scheme === 'dark' ? DARK : LIGHT;
