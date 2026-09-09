import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, Check } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { useKeyPress } from './useKeyPress';

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
  error,
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
  /** Validation message shown under the field. Same contract as KeyField, so a numeric field
   *  can report a bad value instead of silently clamping it. */
  error?: string;
  maxLength?: number;
  style?: any;
  disabled?: boolean;
}) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  // Caret plumbing, identical in shape to KeyField's — the sheet holds a real focused
  // TextInput so a number can be corrected in the middle instead of only at its end.
  const valueRef = useRef(value);
  valueRef.current = value;
  const caret = useRef<Caret>({ start: value.length, end: value.length });
  const [sel, setSel] = useState<Caret | undefined>(undefined);
  useEffect(() => { if (sel) setSel(undefined); }, [sel]);

  const clampCaret = (c: Caret, len: number): Caret => {
    const start = Math.max(0, Math.min(c.start, len));
    const end = Math.max(0, Math.min(c.end, len));
    return start <= end ? { start, end } : { start: end, end: start };
  };

  const edit = (mutate: (v: string, c: Caret) => { value: string; caret: number }) => {
    const current = valueRef.current;
    const { value: next, caret: pos } = mutate(current, clampCaret(caret.current, current.length));
    if (next === current) return;
    valueRef.current = next;
    caret.current = { start: pos, end: pos };
    setSel({ start: pos, end: pos });
    onChangeText(next);
  };

  const push = (ch: string) => edit((v, at) => {
    const next = applyKeyAt(v, at, ch, { allowDecimal, allowNegative, maxLength });
    return next;
  });

  const backspace = () => edit((v, at) => {
    if (at.start !== at.end) return { value: v.slice(0, at.start) + v.slice(at.end), caret: at.start };
    if (at.start === 0) return { value: v, caret: 0 };
    return { value: v.slice(0, at.start - 1) + v.slice(at.start), caret: at.start - 1 };
  });

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
        onPress={() => {
          caret.current = { start: value.length, end: value.length };
          setSel({ start: value.length, end: value.length });
          setOpen(true);
        }}
        style={[s.face, { backgroundColor: T.fieldBg, borderColor: error ? T.danger : open ? T.accent : T.line }, style]}
      >
        <Text
          numberOfLines={1}
          style={[s.faceTxt, { color: value ? T.text : T.dim }]}
        >
          {value || placeholder || '0'}
        </Text>
      </TouchableOpacity>
      {!!error && <Text style={[s.err, { color: T.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[s.sheet, { backgroundColor: T.card, borderColor: T.line, paddingBottom: insets.bottom + 10 }]}
          >
            {/* Value display */}
            <View style={s.display}>
              {!!label && <Text numberOfLines={1} style={[s.dispLabel, { color: T.sub }]}>{label}</Text>}
              {/* Focused, with the OS numpad suppressed — a blurred input shows no caret and
                  cannot be tapped into, which is what limited edits to the end of the number. */}
              <TextInput
                value={value}
                onChangeText={v => {
                  valueRef.current = v;
                  caret.current = clampCaret(caret.current, v.length);
                  onChangeText(v);
                }}
                selection={sel}
                onSelectionChange={e => { caret.current = e.nativeEvent.selection; }}
                showSoftInputOnFocus={false}
                caretHidden={false}
                autoFocus
                placeholder={placeholder || '0'}
                placeholderTextColor={T.dim}
                numberOfLines={1}
                style={[s.dispValue, { color: T.text }]}
              />
            </View>

            {/* Keypad */}
            {keys.map((row, ri) => (
              <View key={ri} style={s.row}>
                {row.map((k, ci) => {
                  if (k === '') return <View key={ci} style={s.keySpacer} />;
                  return (
                    <PadKey
                      key={ci}
                      bg={T.cardAlt}
                      onPress={k === 'back' ? backspace : () => push(k)}
                    >
                      {k === 'back'
                        ? <Delete size={22} color={T.text} strokeWidth={1.9} />
                        : <Text style={[s.keyTxt, { color: T.text }]}>{k}</Text>}
                    </PadKey>
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

/**
 * One keypad key, with the same dip-and-tick as the app's full keyboard — the two are the
 * only places the app draws its own keys, and a numpad that felt different from the keyboard
 * would read as a different app.
 */
const PadKey = ({ children, onPress, bg }: {
  children: React.ReactNode; onPress: () => void; bg: string;
}) => {
  const { scale, pressIn, pressOut } = useKeyPress();
  return (
    // The wrapper holds the flex; the animated child holds the face, so a press never makes
    // the key fight its row for width.
    <View style={s.keyCell}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={[s.key, { backgroundColor: bg }]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

type Caret = { start: number; end: number };

/**
 * Apply a keypad press AT THE CARET, keeping the result a valid number.
 *
 * The sign and decimal-point rules are properties of the whole string, not of the position
 * being typed at, so they are still checked against the whole result — a second '.' is
 * refused wherever it was typed, and '-' still toggles the sign rather than inserting a
 * character mid-number.
 */
function applyKeyAt(
  cur: string,
  at: Caret,
  ch: string,
  opts: { allowDecimal: boolean; allowNegative: boolean; maxLength: number },
): { value: string; caret: number } {
  const head = cur.slice(0, at.start);
  const tail = cur.slice(at.end);

  if (ch === '-') {
    // A sign belongs to the number, not to a position in it. Toggling keeps the caret where
    // it was, shifted by the character that appeared or vanished in front of it.
    if (!opts.allowNegative) return { value: cur, caret: at.start };
    if (cur.startsWith('-')) return { value: cur.slice(1), caret: Math.max(0, at.start - 1) };
    return { value: `-${cur}`, caret: at.start + 1 };
  }

  if (ch === '.') {
    if (!opts.allowDecimal) return { value: cur, caret: at.start };
    // Only refuse a second point if the one already there SURVIVES this edit — typing over a
    // selection that contains the existing point is a legitimate way to move it.
    if ((head + tail).includes('.')) return { value: cur, caret: at.start };
    const body = head + tail;
    if (body === '' || body === '-') return { value: `${head}0.${tail}`, caret: at.start + 2 };
    return { value: `${head}.${tail}`, caret: at.start + 1 };
  }

  // digit
  const next = head + ch + tail;
  if (next.replace('-', '').replace('.', '').length > opts.maxLength) {
    return { value: cur, caret: at.start };
  }
  // Strip a leading zero like "05" -> "5" (but keep "0." and "0"). Only meaningful when the
  // edit was at the front; the caret moves back with the character that was removed.
  if (/^-?0\d/.test(next)) {
    const stripped = next.replace(/^(-?)0/, '$1');
    return { value: stripped, caret: Math.max(0, at.start + ch.length - 1) };
  }
  return { value: next, caret: at.start + ch.length };
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
  // The CELL owns the flex so a row still divides evenly; the KEY is the face that scales
  // on press. Leaving flex on the face made the key resize its own column mid-animation.
  keyCell: { flex: 1 },
  key: { height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keySpacer: { flex: 1 },
  keyTxt: { fontSize: rf(22), fontWeight: '600' },
  err: { fontSize: rf(11.5), fontWeight: '400', marginTop: 4 },

  done: {
    height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 2,
  },
  doneTxt: { fontSize: rf(15), fontWeight: '700' },
});
