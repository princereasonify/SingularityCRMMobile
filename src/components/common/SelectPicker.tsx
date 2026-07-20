import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react-native';
import { rf } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';

/**
 * Themed select. Every surface used to be hardcoded light — `#F9FAFB` trigger,
 * `#FFF` sheet, `#111827` text, and a `#0d9488` teal accent left over from the
 * pre-Sunstone palette. Because those lived here rather than in the screens, the
 * per-screen palette sweep never saw them, and in dark mode tapping any select
 * opened a white sheet with teal highlights. All colours now come from
 * useAppTheme(); metrics follow the CRUD kit's field spec (46 tall, radius 13,
 * 1.5px border when open).
 *
 * `accentColor` is kept for call-site overrides but now defaults to the theme
 * accent instead of teal, so the ~5 callers that omit it inherit correctly.
 */

interface Option {
  label: string;
  value: string | number;
}

interface SelectPickerProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  value?: string | number;
  onChange: (value: string | number) => void;
  containerStyle?: ViewStyle;
  accentColor?: string;
  error?: string;
}

export const SelectPicker = ({
  label,
  placeholder = 'Select...',
  options,
  value,
  onChange,
  containerStyle,
  accentColor,
  error,
}: SelectPickerProps) => {
  const T = useAppTheme();
  const accent = accentColor || T.accent;
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: T.sub }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          { backgroundColor: T.fieldBg, borderColor: T.line },
          open && { borderColor: accent, borderWidth: 1.5 },
          !!error && { borderColor: T.danger },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {/* flexShrink:1 + minWidth:0 — RN defaults flexShrink to 0, so a long
            label would lay out at full width and paint over the chevron. */}
        <Text
          style={[styles.triggerText, { color: selected ? T.text : T.dim }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color={T.dim} />
      </TouchableOpacity>
      {!!error && <Text style={[styles.error, { color: T.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: T.card }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: T.line }]}>
              <Text style={[styles.sheetTitle, { color: T.text }]}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <X size={20} color={T.sub} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      // withAlpha, not `accent + '11'`: the concat form silently
                      // produces an invalid colour when accent is an rgba token.
                      on && { backgroundColor: withAlpha(accent, SOFT_TINT) },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: on ? accent : T.text, fontWeight: on ? '600' : '400' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {on && <Check size={16} color={accent} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: rf(13), fontWeight: '600', marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerText: { fontSize: rf(14), flex: 1, flexShrink: 1, minWidth: 0 },
  error: { fontSize: rf(12), marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: rf(16), fontWeight: '700' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionText: { fontSize: rf(15), flex: 1, flexShrink: 1, minWidth: 0 },
});
