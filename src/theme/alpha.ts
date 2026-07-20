/**
 * Tint any theme colour at a given alpha.
 *
 * The spec's status pattern is "colour @ 15% background, solid colour text", which is
 * usually written `c + '26'`. That only works when `c` is #RRGGBB — the neutral tokens
 * (sub/dim/line) are already `rgba(...)`, and appending hex to them yields an invalid
 * colour that fails silently. Always tint through this helper instead.
 */
export const withAlpha = (color: string, alpha: number): string => {
  const a = Math.min(1, Math.max(0, alpha));

  if (color.startsWith('#')) {
    // #RRGGBB → #RRGGBBAA (RN accepts 8-digit hex)
    if (color.length === 7) {
      return color + Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
    }
    return color; // already has alpha, or shorthand — leave it alone
  }

  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(',').map(s => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return color; // named colour — nothing sensible to do
};

/** The spec's status-tint strength: colour @ 15%. */
export const SOFT_TINT = 0.15;
