import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, ArrowBigUp, X, ArrowRight } from 'lucide-react-native';
import { AuthTheme, Fonts } from '../../theme';

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
  visible, theme, accent = '#C99A3E', onKey, onBackspace, onSubmit, onHide, submitLabel = 'Go',
}: Props) => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'letters' | 'symbols'>('letters');
  const [shift, setShift] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, slide]);

  const rows = mode === 'letters' ? LETTERS : SYMBOLS;

  const press = (ch: string) => {
    onKey(shift && mode === 'letters' ? ch.toUpperCase() : ch);
    if (shift) setShift(false);
  };

  // Theme palette
  const tray = theme.isDark ? '#1C1815' : '#C9BDA8';
  const keyBg = theme.isDark ? '#3A342F' : '#FFFFFF';
  const specialBg = theme.isDark ? '#2A2521' : '#DFD6C6';
  const txt = theme.isDark ? '#F5EFE8' : '#1A150E';
  const subTxt = theme.isDark ? 'rgba(245,239,232,0.6)' : 'rgba(26,21,14,0.55)';

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
                style={[styles.segBtn, on && { backgroundColor: accent }]}
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
            <Key flexAmt={1.5} bg={shift && mode === 'letters' ? accent : specialBg} onPress={() => setShift(s => !s)}>
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
            <Key flexAmt={1.5} bg={specialBg} onPress={onBackspace}>
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
        <Key flexAmt={2} bg={accent} onPress={onSubmit}>
          <Text style={styles.returnTxt}>{submitLabel}</Text>
          <ArrowRight size={16} color="#fff" strokeWidth={2.6} />
        </Key>
      </View>
    </Animated.View>
  );
};

const Key = ({
  children, onPress, bg, flexAmt = 1,
}: { children: React.ReactNode; onPress: () => void; bg: string; flexAmt?: number }) => (
  <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={[styles.key, { backgroundColor: bg, flex: flexAmt }]}>
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
  segTxt: { fontFamily: Fonts.bold, fontSize: 13, letterSpacing: 0.4 },
  closeBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 3.5, paddingHorizontal: 2 },
  key: {
    height: 52,
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
  keyTxt: { fontFamily: Fonts.regular, fontSize: 22 },
  spaceTxt: { fontFamily: Fonts.medium, fontSize: 15 },
  returnTxt: { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
});
