import { ColorSchemeName } from 'react-native';
import { Sunstone } from './fonts';

/**
 * App-wide content theme — values taken VERBATIM from SingularityCRM-Components.html
 * ("Brand gradient & accent", "Neutrals — light & dark", "Status colors").
 * That file is the source of truth; do not drift from it.
 *
 * Light neutrals : bg #F4F0E8 · card #FFFFFF · card-alt #F7F3EC · text #211B12
 * Dark  neutrals : bg #131009 · card #1D1811 · card-alt #241E15 · text #F4EEE2
 * Text hierarchy : primary · secondary .55 · dim .40 · hairline .09 · strong line .16
 * Accent         : #8C5A2E (light) / #E0B057 (dark) · soft tint = bright @ 13%
 */
export interface AppTheme {
  isDark: boolean;
  // Surfaces
  bg: string;         // screen background
  card: string;       // card / surface
  cardAlt: string;    // secondary surface (table header / bar track / subtle fill)
  fieldBg: string;    // input background
  // Text
  text: string;
  sub: string;
  dim: string;
  // Lines
  line: string;       // hairline .09
  lineStrong: string; // .16 — secondary-button borders
  // Accent (Sunstone)
  accent: string;      // solid, readable on surfaces
  accentSoft: string;  // 13% tint for chips / icon tiles
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
  bg: '#F4F0E8',
  card: '#FFFFFF',
  cardAlt: '#F7F3EC',
  fieldBg: '#FFFFFF',
  text: '#211B12',
  sub: 'rgba(33,27,18,0.55)',
  dim: 'rgba(33,27,18,0.40)',
  line: 'rgba(33,27,18,0.09)',
  lineStrong: 'rgba(33,27,18,0.16)',
  accent: '#8C5A2E',
  accentSoft: 'rgba(217,164,65,0.13)',
  accentFrom: Sunstone.from,
  accentTo: Sunstone.to,
  success: '#4C8C5C',
  warning: '#C2882B',
  danger: '#C2492D',
  info: '#5B7FA6',
  onAccent: '#FFFFFF',
};

const DARK: AppTheme = {
  isDark: true,
  bg: '#131009',
  card: '#1D1811',
  cardAlt: '#241E15',
  fieldBg: '#1D1811',
  text: '#F4EEE2',
  sub: 'rgba(244,238,226,0.55)',
  dim: 'rgba(244,238,226,0.40)',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.16)',
  accent: '#E0B057',
  accentSoft: 'rgba(217,164,65,0.13)',
  accentFrom: Sunstone.from,
  accentTo: Sunstone.to,
  // The spec lists one value per status (tuned for the light surfaces). On the dark
  // surfaces those read too dark, so dark mode uses the same hues lifted for contrast.
  success: '#5FA06F',
  warning: '#D6A23E',
  danger: '#E0725C',
  info: '#7396BE',
  onAccent: '#FFFFFF',
};

/**
 * B2C content theme — the iPad "green" palette. Same token shape as Sunstone;
 * only the surfaces / text / accent / status hues change. Everything not listed
 * here is inherited from the Sunstone LIGHT/DARK objects above.
 */
const B2C_LIGHT: AppTheme = {
  ...LIGHT,
  bg: '#eef3ea',
  card: '#ffffff',
  cardAlt: '#f3f7ee',
  fieldBg: '#ffffff',
  text: '#18241a',
  sub: '#6f8168',
  line: '#e2ead9',
  accent: '#5aa832',
  accentSoft: 'rgba(90,168,50,0.12)',
  accentFrom: '#4e9e3a',
  accentTo: '#8fd14f',
  success: '#3f9a2f',
  warning: '#c99a1e',
  danger: '#d9772f',
  onAccent: '#ffffff',
};

const B2C_DARK: AppTheme = {
  ...DARK,
  bg: '#0f140c',
  card: '#1a2215',
  cardAlt: '#161d12',
  fieldBg: '#141a10',
  text: '#e9f2e0',
  sub: '#94a888',
  line: 'rgba(233,242,224,0.13)',
  accent: '#8fd14f',
  accentSoft: 'rgba(143,209,79,0.14)',
  accentFrom: '#4e9e3a',
  accentTo: '#8fd14f',
  success: '#7ec95f',
  warning: '#e3c052',
  danger: '#e8955c',
  onAccent: '#14240c',
};

export const getAppTheme = (scheme: ColorSchemeName | 'light' | 'dark'): AppTheme =>
  scheme === 'dark' ? DARK : LIGHT;

/** Product family that selects which palette the authed UI renders in. */
export type ThemeFamily = 'b2b' | 'b2c';

/**
 * Theme resolver keyed by product family. B2C returns the green palette; every
 * other family falls through to the existing Sunstone resolver, so B2B is
 * byte-for-byte unchanged.
 */
export const getAppThemeFor = (
  family: ThemeFamily,
  scheme: ColorSchemeName | 'light' | 'dark',
): AppTheme => {
  if (family === 'b2c') return scheme === 'dark' ? B2C_DARK : B2C_LIGHT;
  return getAppTheme(scheme);
};
