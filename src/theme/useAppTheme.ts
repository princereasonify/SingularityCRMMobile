import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getAppThemeFor, AppTheme, ThemeFamily } from './appTheme';
import { UserRole } from '../types';

const B2C_ROLES: readonly UserRole[] = ['B2CAdmin', 'Agent', 'Counselor'];

/**
 * The signed-in user's product family. B2C roles get the green palette; every
 * other role (and any consumer rendered before/outside the AuthProvider) is B2B,
 * which keeps the Sunstone theme byte-for-byte unchanged.
 *
 * useAuth() throws when called outside AuthProvider, so the read is guarded —
 * a pre-auth consumer safely falls back to 'b2b'.
 */
const useThemeFamily = (): ThemeFamily => {
  try {
    const { user } = useAuth();
    if (user && B2C_ROLES.includes(user.role)) return 'b2c';
  } catch {
    // Rendered outside AuthProvider — treat as B2B.
  }
  return 'b2b';
};

/** The app content theme for the current user-chosen light/dark mode + product family. */
export const useAppTheme = (): AppTheme => {
  const { mode } = useTheme();
  const family = useThemeFamily();
  return getAppThemeFor(family, mode);
};
