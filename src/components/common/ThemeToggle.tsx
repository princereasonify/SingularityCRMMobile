import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { getAuthTheme } from '../../theme';

/**
 * Floating light/dark switch, pinned top-right. Shows a sun in dark mode (tap → light)
 * and a moon in light mode (tap → dark). Sits above both the gold hero and the form.
 */
export const ThemeToggle = () => {
  const { mode, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const T = getAuthTheme(mode);

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.btn,
        { top: insets.top + 10, backgroundColor: T.card, borderColor: T.line },
      ]}
    >
      {mode === 'dark' ? (
        <Sun size={20} color={T.accentText} strokeWidth={2.2} />
      ) : (
        <Moon size={20} color={T.accentText} strokeWidth={2.2} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
