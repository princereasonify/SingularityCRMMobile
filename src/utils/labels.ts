/**
 * Turns the API's PascalCase enum names into readable labels.
 *
 * Mirrors the web's `src/utils/labels.js` so a stage reads "Counseling Done" and a source reads
 * "WhatsApp" identically on both platforms. A naive `replace(/([A-Z])/g, ' $1')` splits EVERY
 * capital, which mangles acronyms and turns "WhatsApp" into "Whats App" — hence the overrides
 * and the acronym-aware scan below.
 */

const OVERRIDES: Record<string, string> = {
  WhatsApp: 'WhatsApp',
  Immediate: 'Immediate',
  OneToThreeMonths: '1–3 Months',
  ThreeToSixMonths: '3–6 Months',
  SixPlusMonths: '6+ Months',
  Aadhaar: 'Aadhaar',
  PAN: 'PAN',
  AI: 'AI',
};

/**
 * "CounselingDone" → "Counseling Done", "NotInterested" → "Not Interested",
 * "GoogleAds" → "Google Ads", "AIBrief" → "AI Brief", "WhatsApp" → "WhatsApp".
 */
export function label(value?: string | null): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (!raw) return '';
  if (OVERRIDES[raw]) return OVERRIDES[raw];

  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const prev = raw[i - 1];
    const next = raw[i + 1];
    const isUpper = c >= 'A' && c <= 'Z';
    // Start a new word at a capital that follows a lowercase/digit, or at the capital that
    // ends an acronym run and is followed by a lowercase ("AIBrief" → "AI Brief").
    const startsWord =
      i > 0 && isUpper &&
      (!(prev >= 'A' && prev <= 'Z') || (!!next && next >= 'a' && next <= 'z'));
    if (startsWord) out += ' ';
    out += c;
  }
  return out.trim();
}

/** Same as `label`, but shows a dash for empty values — handy in detail rows. */
export const labelOrDash = (value?: string | null): string => label(value) || '—';

export default label;
