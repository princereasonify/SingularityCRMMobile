import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, ArrowBigUp, X, ArrowRight } from 'lucide-react-native';
import { AuthTheme } from '../../theme';
import { isTabletDevice } from '../../utils/responsive';

interface Props {
  visible: boolean;
  theme: AuthTheme;
  accent?: string;
  onKey: (ch: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  onHide: () => void;
  submitLabel?: string;
}

const LETTERS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '₹', '&', '_', '-', '+', '(', ')', '/'],
  ['%', '*', '"', "'", ':', ';', '!', '?'],
];

/**
 * In-app keyboard rendered in place of the system keyboard (inputs use
 * showSoftInputOnFocus={false}). A floating, rounded, themed panel with an ABC/123
 * toolbar and a close button — kept clear of the screen edge so no row is ever clipped.
 */
export const CustomKeyboard = ({
  visible, theme, accent, onKey, onBackspace, onSubmit, onHide, submitLabel = 'Go',
}: Props) => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'letters' | 'symbols'>('letters');
  const [shift, setShift] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  // ── Backspace hold-to-repeat ──────────────────────────────────────────────
  // A quick tap deletes exactly one char (onPressIn deletes once, onPressOut
  // clears before the delay fires). Holding kicks off an interval after an
  // initial delay, then accelerates for a natural "keeps deleting" feel.
  const bkDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bkAccel = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopBackspace = () => {
    if (bkDelay.current) { clearTimeout(bkDelay.current); bkDelay.current = null; }
    if (bkAccel.current) { clearTimeout(bkAccel.current); bkAccel.current = null; }
    if (bkInterval.current) { clearInterval(bkInterval.current); bkInterval.current = null; }
  };

  const startBackspace = () => {
    stopBackspace();
    onBackspace(); // immediate delete on press-in → a quick tap removes one char
    bkDelay.current = setTimeout(() => {
      bkInterval.current = setInterval(onBackspace, 70);
      // After ~1s of holding, speed up to a snappier repeat rate.
      bkAccel.current = setTimeout(() => {
        if (bkInterval.current) clearInterval(bkInterval.current);
        bkInterval.current = setInterval(onBackspace, 40);
      }, 1000);
    }, 350);
  };

  // Clear any pending timers on unmount so a held backspace can't outlive the panel.
  useEffect(() => stopBackspace, []);

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, slide]);

  const rows = mode === 'letters' ? LETTERS : SYMBOLS;

  const press = (ch: string) => {
    onKey(shift && mode === 'letters' ? ch.toUpperCase() : ch);
    if (shift) setShift(false);
  };

  // Palette — spec tokens only (SingularityCRM-Components.html neutrals).
  // Keys must read as RAISED above the tray, so the tray takes the recessed surface
  // and the keys the lighter one, in both themes.
  const tray = theme.isDark ? theme.card : theme.cardAlt;      // #1D1811 / #F7F3EC
  const keyBg = theme.isDark ? theme.cardAlt : theme.card;     // #241E15 / #FFFFFF
  const specialBg = theme.isDark ? theme.panelBg : theme.lineStrong; // recessed keys
  const txt = theme.text;
  const subTxt = theme.sub;
  const accentColor = accent ?? theme.accentText;              // #8C5A2E / #E0B057

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.panel,
        {
          // Sit flush on the bottom edge (no gap that showed the page behind as a
          // white strip). The home-indicator inset is absorbed as padding INSIDE the
          // tray, so keys still clear the indicator while the tray fills to the edge.
          bottom: 0,
          paddingBottom: insets.bottom + 10,
          backgroundColor: tray,
          transform: [{ translateY }],
          opacity: slide,
        },
      ]}
    >
      {/* Toolbar: ABC / 123 segmented + close */}
      <View style={styles.toolbar}>
        <View style={[styles.segment, { backgroundColor: specialBg }]}>
          {(['letters', 'symbols'] as const).map(m => {
            const on = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.segBtn, on && { backgroundColor: accentColor }]}
              >
                <Text style={[styles.segTxt, { color: on ? '#fff' : subTxt }]}>
                  {m === 'letters' ? 'ABC' : '123'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={onHide} style={[styles.closeBtn, { backgroundColor: specialBg }]}>
          <X size={18} color={txt} />
        </TouchableOpacity>
      </View>

      {/* Key rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {ri === 2 && (
            <Key flexAmt={1.5} bg={shift && mode === 'letters' ? accentColor : specialBg} onPress={() => setShift(s => !s)}>
              <ArrowBigUp size={20} color={shift && mode === 'letters' ? '#fff' : txt} fill={shift && mode === 'letters' ? '#fff' : 'transparent'} />
            </Key>
          )}
          {row.map(ch => (
            <Key key={ch} bg={keyBg} onPress={() => press(ch)}>
              <Text style={[styles.keyTxt, { color: txt }]}>
                {shift && mode === 'letters' ? ch.toUpperCase() : ch}
              </Text>
            </Key>
          ))}
          {ri === 2 && (
            <Key flexAmt={1.5} bg={specialBg} onPressIn={startBackspace} onPressOut={stopBackspace}>
              <Delete size={20} color={txt} />
            </Key>
          )}
        </View>
      ))}

      {/* Bottom row */}
      <View style={styles.row}>
        <Key bg={keyBg} onPress={() => onKey('@')}><Text style={[styles.keyTxt, { color: txt }]}>@</Text></Key>
        <Key flexAmt={5} bg={keyBg} onPress={() => onKey(' ')}>
          <Text style={[styles.spaceTxt, { color: subTxt }]}>space</Text>
        </Key>
        <Key bg={keyBg} onPress={() => onKey('.')}><Text style={[styles.keyTxt, { color: txt }]}>.</Text></Key>
        <Key flexAmt={2} bg={accentColor} onPress={onSubmit}>
          <Text style={styles.returnTxt}>{submitLabel}</Text>
          <ArrowRight size={16} color="#fff" strokeWidth={2.6} />
        </Key>
      </View>
    </Animated.View>
  );
};

/**
 * Key height: tablets get a roomy 52; phones use 44 (the spec's min tap target) so the
 * whole keyboard stays ~1/3 of a small screen instead of swallowing half of it.
 */
const KEY_H = isTabletDevice ? 52 : 44;

/**
 * Exact height of the panel, EXCLUDING the bottom safe-area inset (callers add
 * insets.bottom). Screens use this to pad their scroll view by precisely the
 * keyboard's height — a hardcoded guess either leaves a dead gap or over-scrolls
 * the form under the status bar.
 *   paddingTop 8 + toolbar (38 + 8 margin) + 4 rows × (KEY_H + 7 margins) + paddingBottom 10
 */
export const KEYBOARD_PANEL_H = 8 + 46 + 4 * (KEY_H + 7) + 10;

const Key = ({
  children, onPress, onPressIn, onPressOut, bg, flexAmt = 1,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  bg: string;
  flexAmt?: number;
}) => (
  <TouchableOpacity
    activeOpacity={0.6}
    onPress={onPress}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    style={[styles.key, { backgroundColor: bg, flex: flexAmt, height: KEY_H }]}
  >
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 6,
    right: 6,
    // Rounded top only — the bottom now meets the screen edge, so square it off
    // to avoid the page peeking through rounded corners.
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 6,
    paddingTop: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segTxt: { fontWeight: '700', fontSize: 13, letterSpacing: 0.4 },
  closeBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 3.5, paddingHorizontal: 2 },
  key: {
    marginHorizontal: 3,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 1,
    elevation: 1,
  },
  keyTxt: { fontWeight: '400', fontSize: 22 },
  spaceTxt: { fontWeight: '600', fontSize: 15 },
  returnTxt: { fontWeight: '700', fontSize: 15, color: '#fff' },
});
