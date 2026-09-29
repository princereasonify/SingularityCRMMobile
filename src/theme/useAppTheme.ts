import { useTheme } from '../context/ThemeContext';
import { useAuthOptional } from '../context/AuthContext';
import { getAppThemeFor, AppTheme, ThemeFamily } from './appTheme';
import { isB2CRole } from '../types';

/**
 * The signed-in user's product family. B2C roles get the green palette; every
 * other role (and any consumer rendered before/outside the AuthProvider) is B2B,
 * which keeps the Sunstone theme byte-for-byte unchanged.
 *
 * Read through useAuthOptional rather than useAuth-in-a-try: a hook inside a try block is a
 * CONDITIONAL hook call, and React only guarantees hook identity when every render calls the
 * same hooks in the same order. The optional accessor is always called and returns null
 * outside AuthProvider, so a pre-auth consumer still falls back to 'b2b' — same behaviour,
 * without betting on the component never moving across the provider boundary.
 */
const useThemeFamily = (): ThemeFamily => {
  const auth = useAuthOptional();
  const user = auth?.user;
  return isB2CRole(user?.role) ? 'b2c' : 'b2b';
};

/** The app content theme for the current user-chosen light/dark mode + product family. */
export const useAppTheme = (): AppTheme => {
  const { mode } = useTheme();
  const family = useThemeFamily();
  return getAppThemeFor(family, mode);
};
