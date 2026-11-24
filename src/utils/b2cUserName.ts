// The student login username rule — a copy of Reasonify's (EducationAPI.Services.UserNameGenerator),
// of the SalesCRM backend's B2CUserName and of the web's utils/b2cUserName.js, so a malformed name is
// flagged while typing with no round trip. Reasonify stays the authority on whether a well-formed
// name is actually free.
//
// 3-30 characters; letters, digits and . _ - only; must start and end with a letter or digit;
// no "@" (Reasonify's login tells an email from a username by the "@"). Stored lower-case.

const FORMAT = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;

/** Trimmed + lower-cased, '' when blank. */
export const normalizeUserName = (v?: string | null): string => (v ?? '').trim().toLowerCase();

/** What the box keeps while typing: lower-cased with every whitespace removed. */
export const sanitizeUserNameInput = (v: string): string => v.toLowerCase().replace(/\s+/g, '');

/** Why the value is not a valid username, or null when it is (or when it is blank). */
export const userNameFormatError = (v?: string | null): string | null => {
  const t = (v ?? '').trim();
  if (!t) return null;
  if (t.length < 3) return 'Username must be at least 3 characters';
  if (t.length > 30) return 'Username can be at most 30 characters';
  if (t.includes('@')) return 'Username cannot contain @';
  if (!FORMAT.test(t)) return 'Use only letters, numbers, dots, underscores or hyphens, starting and ending with a letter or number';
  return null;
};
