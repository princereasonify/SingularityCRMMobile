import { ColorSchemeName } from 'react-native';
import { Sunstone } from './fonts';

/**
 * App-wide content theme (all screens), taken from SingularityCRM-DesignSpec.html.
 * Light ↔ dark flip with the same Sunstone accent. This is the generalisation of
 * authTheme for the whole app; screens read it via useTheme() → getAppTheme(mode).
 */
export interface AppTheme {
  isDark: boolean;
  // Surfaces
  bg: string;         // screen background
  card: string;       // card / surface
  cardAlt: string;    // secondary surface (map base / subtle fill)
  fieldBg: string;    // input background
  // Text
  text: string;
  sub: string;
  dim: string;
  // Lines
  line: string;
  lineStrong: string;
  // Accent (Sunstone)
  accent: string;      // solid, readable on surfaces
  accentSoft: string;  // 14–16% tint for badges/fills
  accentFrom: string;  // gradient start
  accentTo: string;    // gradient end
  // Status
  success: string;
  warning: string;
  danger: string;
  info: string;
  // On gradient (hero / colored header)
  onAccent: string;
}

const LIGHT: AppTheme = {
  isDark: false,
  bg: '#F8F5EF',
  card: '#FFFFFF',
  cardAlt: '#F1ECE3',
  fieldBg: '#FFFFFF',
  text: '#221C14',
  sub: 'rgba(34,28,20,0.55)',
  dim: 'rgba(34,28,20,0.45)',
  line: 'rgba(34,28,20,0.10)',
  lineStrong: 'rgba(34,28,20,0.16)',
  accent: '#8C5A2E',
  accentSoft: 'rgba(217,164,65,0.16)',
  accentFrom: Sunstone.from,
  accentTo: Sunstone.to,
  success: '#4C8C5C',
  warning: '#C2882B',
  danger: '#C24E3A',
  info: '#5B7FA6',
  onAccent: '#FFFFFF',
};

const DARK: AppTheme = {
  isDark: true,
  bg: '#171412',
  card: '#221E1B',
  cardAlt: '#26221E',
  fieldBg: '#221E1B',
  text: '#F5EFE8',
  sub: 'rgba(245,239,232,0.55)',
  dim: 'rgba(245,239,232,0.45)',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.20)',
  accent: '#D9A441',
  accentSoft: 'rgba(217,164,65,0.16)',
  accentFrom: Sunstone.from,
  accentTo: Sunstone.to,
  success: '#5FA06F',
  warning: '#D6A23E',
  danger: '#E0725C',
  info: '#7396BE',
  onAccent: '#FFFFFF',
};

export const getAppTheme = (scheme: ColorSchemeName | 'light' | 'dark'): AppTheme =>
  scheme === 'dark' ? DARK : LIGHT;
