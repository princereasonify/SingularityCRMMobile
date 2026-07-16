import { useTheme } from '../context/ThemeContext';
import { getAppTheme, AppTheme } from './appTheme';

/** The app content theme for the current (user-chosen) light/dark mode. */
export const useAppTheme = (): AppTheme => {
  const { mode } = useTheme();
  return getAppTheme(mode);
};
