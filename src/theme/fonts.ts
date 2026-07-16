// ─── Font Family Tokens ───────────────────────────────────────────────────────
// Space Grotesk is bundled (src/assets/fonts) and linked via react-native-asset.
// On both iOS and Android the family name is the PostScript name of each static
// weight, so weights are selected by NAME (not by fontWeight) for consistent
// rendering across platforms.
//
// Only Regular / Medium / Bold static weights ship, so SemiBold maps to Bold.
export const Fonts = {
  regular:  'SpaceGrotesk-Regular',
  medium:   'SpaceGrotesk-Medium',
  semibold: 'SpaceGrotesk-Bold',
  bold:     'SpaceGrotesk-Bold',
} as const;

// Sunstone accent (login + brand), matching SingularityCRM-DesignSpec.html:
// gradient deep #8C5A2E → bright #D9A441 (120deg). `deep` is a slightly darker
// lead-in for extra depth at the top of the hero panel.
export const Sunstone = {
  from:  '#8C5A2E',
  to:    '#D9A441',
  deep:  '#6E4620',
  soft:  'rgba(217,164,65,0.22)',
} as const;
