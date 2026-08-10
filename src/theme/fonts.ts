import { TextStyle } from 'react-native';

// ─── Typography ───────────────────────────────────────────────────────────────
// Source of truth: SingularityCRM-Components.html → "Typography".
//
//   UI stack : -apple-system, "SF Pro Text", system-ui, sans-serif
//              In React Native that is the PLATFORM SYSTEM FONT (SF Pro on iOS,
//              Roboto on Android), selected by simply OMITTING fontFamily. Weight
//              comes from `fontWeight` — never from a family name.
//   Wordmark : Space Grotesk 500/600/700 (bundled, PostScript names) — used ONLY
//              for the "SingularityCRM" wordmark, never for UI text.

/** Space Grotesk — WORDMARK ONLY. Do not use for UI text. */
export const Wordmark = {
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  bold: 'SpaceGrotesk-Bold',
} as const;

/**
 * @deprecated Space Grotesk is wordmark-only per the component spec. For UI text use
 * `Type` (or a bare `fontWeight`, i.e. the system font). Kept so the wordmark and any
 * not-yet-migrated call sites keep compiling.
 */
export const Fonts = {
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  semibold: 'SpaceGrotesk-Bold',
  bold: 'SpaceGrotesk-Bold',
} as const;

/**
 * The spec's text scale. No fontFamily → system font, exactly as the spec's UI stack
 * requires. Spread into styles: `style={[Type.cardTitle, { color: T.text }]}`.
 *   Display 40/800/-1.5 · Screen title 24/800/-0.5 · Card title 15–17/700
 *   Body 13–14/600 · Caption 11–12/400–500 · Eyebrow 11/700/+0.5 uppercase
 */
export const Type = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

// Sunstone accent (login + brand), per SingularityCRM-Components.html:
//   linear-gradient(135deg, #8C5A2E → #D9A441). In SVG that is a top-left → bottom-right
//   diagonal (x1,y1 = 0,0 → x2,y2 = w,h), which GradientBackground already draws.
//   `deep` is a slightly darker lead-in for extra depth at the top of the hero panel.
//   `soft` is the spec's chip / icon-tile tint: bright @ 13%.
export const Sunstone = {
  from: '#8C5A2E',
  to: '#D9A441',
  deep: '#6E4620',
  soft: 'rgba(217,164,65,0.13)',
} as const;

// B2C green accent gradient — the green analogue of Sunstone, used to tint the B2C
// login hero panel and its primary CTA. Same diagonal (deep → from → to) shape.
export const B2CGreen = {
  from: '#4e9e3a',
  to: '#8fd14f',
  deep: '#37701f',
  soft: 'rgba(143,209,79,0.13)',
} as const;
