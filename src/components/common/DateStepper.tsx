import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { ICON_STROKE } from './Icon';
import { rf } from '../../utils/responsive';
import { formatDate } from '../../utils/formatting';

/**
 * ‹ Today › day picker over a fixed list of allowed dates (newest first).
 *
 * Replaces the sideways-scrolling strips of date chips: on a phone only the first three or
 * four chips were visible and nothing said the rest were off to the right. Here the arrows
 * step one day older/newer, and tapping the date opens every allowed day as a grid that
 * WRAPS — so any day is still one tap away and nothing ever scrolls sideways.
 */
export const DateStepper = ({ dates, value, onChange, style }: {
  /** Allowed yyyy-mm-dd dates, newest first (index 0 = today). */
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  style?: any;
}) => {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);
  const idx = Math.max(0, dates.indexOf(value));
  const labelFor = (d: string, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d));

  const canOlder = idx < dates.length - 1;
  const canNewer = idx > 0;

  const arrow = (enabled: boolean, onPress: () => void, label: string, icon: React.ReactNode) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel={label}
      hitSlop={6}
      style={[s.arrow, { borderColor: T.line, backgroundColor: T.card, opacity: enabled ? 1 : 0.35 }]}
    >
      {icon}
    </TouchableOpacity>
  );

  return (
    <View style={[s.row, style]}>
      {arrow(canOlder, () => onChange(dates[idx + 1]), 'Previous day',
        <ChevronLeft size={18} color={T.text} strokeWidth={ICON_STROKE} />)}

      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel={`Selected ${labelFor(dates[idx], idx)}. Choose another day`}
        style={[s.label, { borderColor: T.line, backgroundColor: T.card }]}
      >
        <CalendarDays size={14} color={T.accent} strokeWidth={ICON_STROKE} />
        <Text style={[s.labelTxt, { color: T.text }]} numberOfLines={1}>{labelFor(dates[idx], idx)}</Text>
      </TouchableOpacity>

      {arrow(canNewer, () => onChange(dates[idx - 1]), 'Next day',
        <ChevronRight size={18} color={T.text} strokeWidth={ICON_STROKE} />)}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: T.card, borderColor: T.line }]} onPress={() => {}}>
            <Text style={[s.sheetTitle, { color: T.text }]}>Choose a day</Text>
            <View style={s.grid}>
              {dates.map((d, i) => {
                const on = d === value;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => { setOpen(false); onChange(d); }}
                    style={[
                      s.chip,
                      { backgroundColor: on ? T.accentSoft : T.cardAlt, borderColor: on ? T.accent : T.line },
                    ]}
                  >
                    <Text style={[s.chipTxt, { color: on ? T.accent : T.sub }]}>{labelFor(d, i)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    flex: 1, height: 40, borderRadius: 12, borderWidth: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10,
  },
  labelTxt: { fontSize: rf(13.5), fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 18, borderWidth: 1, padding: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  sheetTitle: { fontSize: rf(15), fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  chipTxt: { fontSize: rf(12), fontWeight: '600' },
});
