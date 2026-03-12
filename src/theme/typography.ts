import { TextStyle } from 'react-native';
import { rf } from '../utils/responsive';
import { Colors } from './colors';

// ─── Type Scale ───────────────────────────────────────────────────────────────
// Call as functions so rf() runs at runtime (after RN initialises dimensions)
export const Typography = {
  h1:           (): TextStyle => ({ fontSize: rf(24), fontWeight: '700', color: Colors.textPrimary }),
  h2:           (): TextStyle => ({ fontSize: rf(20), fontWeight: '700', color: Colors.textPrimary }),
  h3:           (): TextStyle => ({ fontSize: rf(18), fontWeight: '600', color: Colors.textPrimary }),
  h4:           (): TextStyle => ({ fontSize: rf(16), fontWeight: '600', color: Colors.textPrimary }),
  h5:           (): TextStyle => ({ fontSize: rf(14), fontWeight: '600', color: Colors.textPrimary }),
  body:         (): TextStyle => ({ fontSize: rf(14), fontWeight: '400', color: Colors.textSecondary }),
  bodySmall:    (): TextStyle => ({ fontSize: rf(13), fontWeight: '400', color: Colors.textSecondary }),
  caption:      (): TextStyle => ({ fontSize: rf(12), fontWeight: '400', color: Colors.textTertiary }),
  captionSmall: (): TextStyle => ({ fontSize: rf(11), fontWeight: '500', color: Colors.textTertiary }),
  label:        (): TextStyle => ({ fontSize: rf(13), fontWeight: '500', color: Colors.textSecondary }),
  buttonLg:     (): TextStyle => ({ fontSize: rf(15), fontWeight: '600', color: Colors.textInverse }),
  buttonMd:     (): TextStyle => ({ fontSize: rf(14), fontWeight: '600', color: Colors.textInverse }),
  buttonSm:     (): TextStyle => ({ fontSize: rf(13), fontWeight: '600', color: Colors.textInverse }),
  headerTitle:  (): TextStyle => ({ fontSize: rf(20), fontWeight: '700', color: Colors.textInverse }),
  headerSub:    (): TextStyle => ({ fontSize: rf(13), fontWeight: '400', color: 'rgba(255,255,255,0.75)' }),
};
