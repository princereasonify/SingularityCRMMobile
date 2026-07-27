import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, Check } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * NumField — a numeric input that opens the app's OWN keypad instead of the OS numpad,
 * so numeric entry looks and feels the same across the whole app (matching the custom
 * keyboard on the login screen). Self-contained: it renders its own themed bottom-sheet
 * keypad in a transparent Modal, so it drops into any screen with no global provider and
 * no per-input focus wiring.
 *
 * Drop-in for a numeric `<Input>`: same value/onChangeText contract.
 *   <NumField value={form.rate} onChangeText={v => set('rate', v)} placeholder="0" />
 */
export const NumField = ({
  value,
  onChangeText,
  placeholder,
  allowDecimal = true,
  allowNegative = false,
  label,
  maxLength = 12,
  style,
  disabled,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  label?: string;
  maxLength?: number;
  style?: any;
  disabled?: boolean;
}) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const push = (ch: string) => {
    onChangeText(applyKey(value, ch, { allowDecimal, allowNegative, maxLength }));
  };
  const backspace = () => onChangeText(value.slice(0, -1));

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [allowDecimal ? '.' : (allowNegative ? '-' : ''), '0', 'back'],
  ];

  return (
    <>
      {/* The field face — a themed input row that shows the value; tapping opens the keypad. */}
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.face, { backgroundColor: T.fieldBg, borderColor: open ? T.accent : T.line }, style]}
      >
        <Text
          numberOfLines={1}
          style={[s.faceTxt, { color: value ? T.text : T.dim }]}
        >
          {value || placeholder || '0'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[s.sheet, { backgroundColor: T.card, borderColor: T.line, paddingBottom: insets.bottom + 10 }]}
          >
            {/* Value display */}
            <View style={s.display}>
              {!!label && <Text numberOfLines={1} style={[s.dispLabel, { color: T.sub }]}>{label}</Text>}
              <Text numberOfLines={1} style={[s.dispValue, { color: value ? T.text : T.dim }]}>
                {value || placeholder || '0'}
              </Text>
            </View>

            {/* Keypad */}
            {keys.map((row, ri) => (
              <View key={ri} style={s.row}>
                {row.map((k, ci) => {
                  if (k === '') return <View key={ci} style={s.keySpacer} />;
                  if (k === 'back') {
                    return (
                      <TouchableOpacity
                        key={ci}
                        activeOpacity={0.6}
                        onPress={backspace}
                        style={[s.key, { backgroundColor: T.cardAlt }]}
                      >
                        <Delete size={22} color={T.text} strokeWidth={1.9} />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={ci}
                      activeOpacity={0.6}
                      onPress={() => push(k)}
                      style={[s.key, { backgroundColor: T.cardAlt }]}
                    >
                      <Text style={[s.keyTxt, { color: T.text }]}>{k}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Done */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(false)} style={[s.done, { backgroundColor: T.accent }]}>
              <Check size={17} color={T.onAccent} strokeWidth={2.6} />
              <Text style={[s.doneTxt, { color: T.onAccent }]}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/** Apply a keypad press to the current string, keeping it a valid number. */
function applyKey(
  cur: string,
  ch: string,
  opts: { allowDecimal: boolean; allowNegative: boolean; maxLength: number },
): string {
  if (ch === '-') {
    if (!opts.allowNegative) return cur;
    return cur.startsWith('-') ? cur.slice(1) : `-${cur}`;
  }
  if (ch === '.') {
    if (!opts.allowDecimal || cur.includes('.')) return cur;
    return cur === '' || cur === '-' ? `${cur}0.` : `${cur}.`;
  }
  // digit
  const next = cur + ch;
  if (next.replace('-', '').replace('.', '').length > opts.maxLength) return cur;
  // strip a leading zero like "05" -> "5" (but keep "0." and "0")
  if (/^-?0\d/.test(next)) return next.replace(/^(-?)0/, '$1');
  return next;
}

const s = StyleSheet.create({
  face: {
    minHeight: 46, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, justifyContent: 'center',
  },
  faceTxt: { fontSize: rf(14), fontWeight: '500' },

  scrim: { flex: 1, backgroundColor: 'rgba(20,15,8,0.42)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingTop: 12,
  },
  display: { paddingHorizontal: 6, paddingBottom: 12, alignItems: 'flex-end' },
  dispLabel: { fontSize: rf(11.5), fontWeight: '600', marginBottom: 2 },
  dispValue: { fontSize: rf(30), fontWeight: '800', letterSpacing: -0.5 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  key: { flex: 1, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keySpacer: { flex: 1 },
  keyTxt: { fontSize: rf(22), fontWeight: '600' },

  done: {
    height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 2,
  },
  doneTxt: { fontSize: rf(15), fontWeight: '700' },
});
