import { UserRole } from '../../types';

/**
 * Role splash palettes and copy — ported verbatim from SingularitySplash.html.
 *
 * These colours are deliberately NOT the app theme tokens: the splash is a
 * full-bleed cinematic moment with its own per-role identity, shown once at
 * login and then replaced by the themed app. Changing them here changes the
 * splash only.
 */
export interface RoleSplashTheme {
  key: UserRole;
  /** Two-letter chip shown around the lockup ring. */
  short: string;
  name: string;
  /** Darkest mesh stop — also the "unlit" fill of the name gradient. */
  dark: string;
  /** The role's signature hue: mesh mid-stop, glow, ring accents. */
  base: string;
  /** Lightest mesh stop — hairlines, ornament, wordmark, active ring label. */
  bright: string;
  /** Name gradient's base colour, so the glint reads as light sweeping over metal. */
  ink: string;
  quote: string;
}

export const ROLE_SPLASH: Record<UserRole, RoleSplashTheme> = {
  FO: {
    key: 'FO', short: 'FO', name: 'Field Officer',
    dark: '#3a2410', base: '#C8892F', bright: '#FFE6A8', ink: '#2a1806',
    quote: 'The ground is won on foot. Move with intent.',
  },
  ZH: {
    key: 'ZH', short: 'ZH', name: 'Zonal Head',
    dark: '#0f322a', base: '#2F9E8F', bright: '#CFF3E9', ink: '#06231b',
    quote: 'Command the zone. Let belief lead the map.',
  },
  RH: {
    key: 'RH', short: 'RH', name: 'Regional Head',
    dark: '#182533', base: '#8CA0B8', bright: '#EAF2FF', ink: '#0e1620',
    quote: 'Regions rise when vision travels far.',
  },
  SH: {
    key: 'SH', short: 'SH', name: 'Sales Head',
    dark: '#291640', base: '#9A6FE0', bright: '#E9D8FF', ink: '#190f2c',
    quote: 'Numbers bow to conviction. Set the pace.',
  },
  SCA: {
    key: 'SCA', short: 'SA', name: 'Super Sale Admin',
    dark: '#3a1c18', base: '#D98A6E', bright: '#FFE0CF', ink: '#250f0b',
    quote: 'Master the system. Make winning inevitable.',
  },
};

/** Ring order around the lockup — matches the source's ROLES array order. */
export const RING_ORDER: UserRole[] = ['FO', 'ZH', 'RH', 'SH', 'SCA'];

/**
 * Scene boundaries in ms, verbatim from the source timeline:
 *   0 → name · 2600 → quote · 4700 → lockup · 6600 → hand off.
 */
export const SPLASH_TIMELINE = {
  quoteAt: 2600,
  lockupAt: 4700,
  doneAt: 6600,
  /** Matches the source's `.sp-splash{transition:opacity .7s}`. */
  fadeMs: 700,
} as const;

/** [xPct, yPct, size, twinkleDur, delay, driftDur] — verbatim from SPARKS. */
export const SPARKS: [number, number, number, number, number, number][] = [
  [14, 22, 5, 3.2, 0.2, 9],
  [78, 18, 4, 2.6, 0.9, 11],
  [32, 70, 6, 3.6, 0.5, 8],
  [64, 64, 4, 2.9, 1.4, 10],
  [88, 48, 5, 3.1, 0.7, 12],
  [20, 52, 3, 2.4, 1.1, 9.5],
  [50, 30, 4, 3.4, 1.8, 10.5],
  [8, 82, 5, 3, 0.3, 8.5],
];

/** rgba() from a #rrggbb + alpha — the source's hexA(). */
export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
