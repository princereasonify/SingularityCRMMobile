import { normalizeUserName, sanitizeUserNameInput, userNameFormatError } from '../src/utils/b2cUserName';
import { userNameBlocksSave } from '../src/components/b2c/UsernameField';

// Mirrors Reasonify's UserNameGenerator.GetFormatError and the SalesCRM backend's B2CUserName.
describe('b2c username rule', () => {
  it.each(['abc', 'virajshah12', 'aarav.sharma', 'a_b-c', 'riya123', 'A1b'])('accepts %s', v => {
    expect(userNameFormatError(v)).toBeNull();
  });

  it('treats blank as "not an error" (the field is optional)', () => {
    expect(userNameFormatError('')).toBeNull();
    expect(userNameFormatError('   ')).toBeNull();
    expect(userNameFormatError(undefined)).toBeNull();
  });

  it.each([
    ['ab', /at least 3/],
    ['a'.repeat(31), /at most 30/],
    ['aarav@123', /cannot contain @/],
    ['.abc', /Use only letters/],
    ['abc.', /Use only letters/],
    ['ab cd', /Use only letters/],
    ['ab#cd', /Use only letters/],
  ])('rejects %s', (v, msg) => {
    expect(userNameFormatError(v)).toMatch(msg);
  });

  it('accepts exactly 30 characters', () => {
    expect(userNameFormatError('a'.repeat(30))).toBeNull();
  });

  it('normalises and sanitises like the web box', () => {
    expect(normalizeUserName('  ViRaj12 ')).toBe('viraj12');
    expect(normalizeUserName(null)).toBe('');
    expect(sanitizeUserNameInput('Vi Raj\t12')).toBe('viraj12');
  });

  it('holds Save back only for checking / taken / invalid', () => {
    expect(['checking', 'taken', 'invalid'].every(s => userNameBlocksSave(s as any))).toBe(true);
    expect(['idle', 'ok', 'unverified'].some(s => userNameBlocksSave(s as any))).toBe(false);
  });
});
