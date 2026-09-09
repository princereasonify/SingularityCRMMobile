import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, StyleProp, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, ArrowBigUp, Check } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * KeyField — a full alphanumeric text field that opens the app's OWN keyboard instead of
 * the OS one, so text entry looks and feels the same everywhere (matching the login screen's
 * keyboard and the numeric NumField). Self-contained like NumField: renders its own themed
 * bottom-sheet keyboard in a transparent Modal, so it drops into any screen with no global
 * provider and no per-input focus wiring. The sheet does mount a real <TextInput> (see the
 * caret note below), but it is inside the sheet the component owns — callers still wire
 * nothing, and the field face itself is never focusable.
 *
 * Editing is CARET-AWARE. The sheet holds a real, focused <TextInput> (with the OS keyboard
 * suppressed via showSoftInputOnFocus), so it blinks a cursor and accepts tap/drag to move
 * that cursor — the two things a text field must do, and the two things this component used
 * to lack: it rendered the value as a <Text>, which can neither show a caret nor be tapped
 * into, so an edit could only ever append or delete at the end.
 *
 * Keeping the caret honest on RN needs three pieces, and it fails if any one is missing:
 *   1. `selection` must NOT be permanently controlled — a selection prop supplied on every
 *      render re-asserts itself the instant the user drags, snapping the caret back.
 *   2. But after WE change the text, the platform puts the caret at the end on its own, so
 *      it is forced for exactly one render after our own edit and then released.
 *   3. The live value and caret are read from REFS, so a burst of key presses can't act on
 *      a value that a pending parent re-render has not delivered yet.
 *
 * Long text (multiline notes/address/bio) should stay on the OS keyboard; this is for short,
 * single-line fields (names, emails, mobiles, search terms, etc.).
 *
 * Drop-in for a single-line `<Input>`: same value/onChangeText/label/error/left contract.
 *   <KeyField value={form.name} onChangeText={v => set('name', v)} placeholder="Full name" />
 */

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

type Caret = { start: number; end: number };

interface KeyFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  secureTextEntry?: boolean;
  /** Opens straight to the 123 tab — for phone/number-ish fields entered through the full
   *  keyboard (e.g. a mobile number where @/symbols might still be needed). */
  numericFirst?: boolean;
  maxLength?: number;
  disabled?: boolean;
  /** Opens the keyboard as soon as this field mounts — e.g. a "name this" modal that
   *  should be ready to type into immediately, matching a native TextInput's autoFocus. */
  autoFocus?: boolean;
  /** Live content (e.g. a search-suggestions list) rendered INSIDE the keyboard sheet,
   *  between the value display and the keys — so a typeahead field still shows its
   *  results while the keyboard is open, instead of them being hidden behind the sheet.
   *  Give it its own maxHeight/scrolling (e.g. Dropdown's `maxHeight` prop) so a long
   *  list can't push the keyboard rows off-screen. */
  belowValue?: React.ReactNode;
}

export const KeyField = ({
  value, onChangeText, label, error, placeholder, left, right, containerStyle,
  secureTextEntry, numericFirst, maxLength, disabled, autoFocus, belowValue,
}: KeyFieldProps) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'letters' | 'symbols'>(numericFirst ? 'symbols' : 'letters');
  const [shift, setShift] = useState(false);

  const inputRef = useRef<TextInput>(null);
  // The value as the PARENT last gave it. `value` is a prop, so a burst of key presses can
  // outrun the re-render that delivers the previous one; reading this instead means each
  // press builds on the last, not on whatever React has committed so far.
  const valueRef = useRef(value);
  valueRef.current = value;
  const caret = useRef<Caret>({ start: value.length, end: value.length });
  // Forced for exactly one render after our own edit, then released — see the header note.
  const [sel, setSel] = useState<Caret | undefined>(undefined);
  useEffect(() => { if (sel) setSel(undefined); }, [sel]);

  useEffect(() => {
    if (autoFocus && !disabled) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A caret that is always inside the text, however it was last reported. */
  const clampCaret = (c: Caret, len: number): Caret => {
    const start = Math.max(0, Math.min(c.start, len));
    const end = Math.max(0, Math.min(c.end, len));
    return start <= end ? { start, end } : { start: end, end: start };
  };

  /** Applies an edit at the caret and puts the caret where the edit left it. */
  const edit = (mutate: (v: string, c: Caret) => { value: string; caret: number }) => {
    const current = valueRef.current;
    const { value: next, caret: pos } = mutate(current, clampCaret(caret.current, current.length));
    if (typeof maxLength === 'number' && next.length > maxLength) return;
    valueRef.current = next;
    caret.current = { start: pos, end: pos };
    setSel({ start: pos, end: pos });
    onChangeText(next);
  };

  // Insert replaces the selection when there is one, so typing over highlighted text behaves
  // like any other field rather than appending beside it.
  const push = (ch: string) => {
    const c = shift && mode === 'letters' ? ch.toUpperCase() : ch;
    edit((v, at) => ({
      value: v.slice(0, at.start) + c + v.slice(at.end),
      caret: at.start + c.length,
    }));
    if (shift) setShift(false);
  };

  // Backspace deletes the SELECTION when there is one, otherwise the character before the
  // caret. At position 0 with nothing selected there is nothing to delete.
  const backspace = () => edit((v, at) => {
    if (at.start !== at.end) return { value: v.slice(0, at.start) + v.slice(at.end), caret: at.start };
    if (at.start === 0) return { value: v, caret: 0 };
    return { value: v.slice(0, at.start - 1) + v.slice(at.start), caret: at.start - 1 };
  });

  const rows = mode === 'letters' ? LETTERS : SYMBOLS;
  const shown = secureTextEntry ? '•'.repeat(value.length) : value;

  return (
    <View style={[s.field, containerStyle]}>
      {!!label && <Text style={[s.flabel, { color: T.text }]}>{label}</Text>}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => {
          caret.current = { start: value.length, end: value.length };
          setSel({ start: value.length, end: value.length });
          setOpen(true);
        }}
        style={[
          s.face,
          { backgroundColor: T.fieldBg, borderColor: error ? T.danger : open ? T.accent : T.line },
          open && !error && { shadowColor: T.accent, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
        ]}
      >
        {left}
        <Text numberOfLines={1} style={[s.faceTxt, { color: value ? T.text : T.dim }]}>
          {shown || placeholder || ''}
        </Text>
        {right}
      </TouchableOpacity>
      {!!error && <Text style={[s.err, { color: T.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[s.sheet, { backgroundColor: T.card, borderColor: T.line, paddingBottom: insets.bottom + 10 }]}
          >
            <View style={s.display}>
              {!!label && <Text numberOfLines={1} style={[s.dispLabel, { color: T.sub }]}>{label}</Text>}
              {/* A REAL TextInput, focused, with the OS keyboard suppressed rather than the
                  field blurred. Blurring is what costs a field its caret and its tap/drag —
                  an unfocused input draws no cursor and ignores touches on the text. */}
              <TextInput
                ref={inputRef}
                value={value}
                // Keeps the mirrors true when text arrives from outside our keyboard —
                // an autofill, a paste, or a hardware keyboard on an iPad.
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
                secureTextEntry={secureTextEntry}
                placeholder={placeholder}
                placeholderTextColor={T.dim}
                autoCapitalize="none"
                autoCorrect={false}
                numberOfLines={1}
                style={[s.dispValue, { color: T.text }]}
              />
            </View>

            {!!belowValue && <View style={s.below}>{belowValue}</View>}

            <View style={s.toolbar}>
              <View style={[s.segment, { backgroundColor: T.cardAlt }]}>
                {(['letters', 'symbols'] as const).map(m => {
                  const on = mode === m;
                  return (
                    <TouchableOpacity key={m} onPress={() => setMode(m)} style={[s.segBtn, on && { backgroundColor: T.accent }]}>
                      <Text style={[s.segTxt, { color: on ? T.onAccent : T.sub }]}>{m === 'letters' ? 'ABC' : '123'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(false)} style={[s.done, { backgroundColor: T.accent }]}>
                <Check size={15} color={T.onAccent} strokeWidth={2.6} />
                <Text style={[s.doneTxt, { color: T.onAccent }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {rows.map((row, ri) => (
              <View key={ri} style={s.row}>
                {ri === 2 && (
                  <Key flexAmt={1.5} bg={shift && mode === 'letters' ? T.accent : T.cardAlt} onPress={() => setShift(v => !v)}>
                    <ArrowBigUp size={18} color={shift && mode === 'letters' ? T.onAccent : T.text} fill={shift && mode === 'letters' ? T.onAccent : 'transparent'} />
                  </Key>
                )}
                {row.map(ch => (
                  <Key key={ch} bg={T.card} border={T.line} onPress={() => push(ch)}>
                    <Text style={[s.keyTxt, { color: T.text }]}>{shift && mode === 'letters' ? ch.toUpperCase() : ch}</Text>
                  </Key>
                ))}
                {ri === 2 && (
                  <Key flexAmt={1.5} bg={T.cardAlt} onPress={backspace}>
                    <Delete size={18} color={T.text} />
                  </Key>
                )}
              </View>
            ))}

            <View style={s.row}>
              <Key bg={T.card} border={T.line} onPress={() => push('@')}><Text style={[s.keyTxt, { color: T.text }]}>@</Text></Key>
              <Key flexAmt={5} bg={T.card} border={T.line} onPress={() => push(' ')}>
                <Text style={[s.spaceTxt, { color: T.sub }]}>space</Text>
              </Key>
              <Key bg={T.card} border={T.line} onPress={() => push('.')}><Text style={[s.keyTxt, { color: T.text }]}>.</Text></Key>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const Key = ({
  children, onPress, bg, border, flexAmt = 1,
}: {
  children: React.ReactNode; onPress: () => void; bg: string; border?: string; flexAmt?: number;
}) => (
  <TouchableOpacity
    activeOpacity={0.6}
    onPress={onPress}
    style={[s.key, { backgroundColor: bg, borderColor: border ?? 'transparent', flex: flexAmt }]}
  >
    {children}
  </TouchableOpacity>
);

const s = StyleSheet.create({
  field: { gap: 7 },
  flabel: { fontSize: rf(12.5), fontWeight: '600' },
  face: {
    height: 46, borderRadius: 13, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14,
  },
  faceTxt: { flex: 1, fontSize: rf(14), fontWeight: '500' },
  err: { fontSize: rf(11.5), fontWeight: '400' },

  scrim: { flex: 1, backgroundColor: 'rgba(20,15,8,0.42)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8, paddingTop: 12,
  },
  display: { paddingHorizontal: 10, paddingBottom: 10, alignItems: 'flex-start' },
  dispLabel: { fontSize: rf(11), fontWeight: '600', marginBottom: 2 },
  dispValue: { fontSize: rf(20), fontWeight: '700' },
  below: { paddingHorizontal: 10, marginBottom: 10 },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8, gap: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segTxt: { fontWeight: '700', fontSize: 12.5, letterSpacing: 0.3 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9 },
  doneTxt: { fontSize: rf(12.5), fontWeight: '700' },

  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 3.5, paddingHorizontal: 2 },
  key: {
    marginHorizontal: 3, height: 44, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
  },
  keyTxt: { fontWeight: '500', fontSize: rf(19) },
  spaceTxt: { fontWeight: '600', fontSize: rf(13.5) },
});
