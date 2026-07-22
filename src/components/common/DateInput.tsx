import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { rf } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * Themed date picker. Like SelectPicker, every surface here was hardcoded light
 * (`#F9FAFB` trigger, `#FFF` modal, `#111827` text) with a pre-Sunstone `#0d9488`
 * teal accent. Those colours lived in this component rather than the screens, so
 * the per-screen palette sweep never caught them — and in dark mode opening a
 * date field produced a white card with teal chips. All colours now derive from
 * useAppTheme(); `accentColor` still overrides, but defaults to the theme accent.
 */

interface DateInputProps {
  label?: string;
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  accentColor?: string;
  error?: string;
  /** Inclusive bounds as 'YYYY-MM-DD'. Days outside are non-selectable. */
  minDate?: string;
  maxDate?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export const DateInput = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  accentColor,
  error,
  minDate,
  maxDate,
}: DateInputProps) => {
  const T = useAppTheme();
  const accent = accentColor || T.accent;
  const [open, setOpen] = useState(false);

  // The stored value is a fixed-width 'YYYY-MM-DD' string, so plain string
  // comparison is a correct (and timezone-proof) date comparison.
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const outOfRange = (y: number, m: number, d: number) => {
    const s = iso(y, m, d);
    return (!!minDate && s < minDate) || (!!maxDate && s > maxDate);
  };

  const today = new Date();
  const parsed = value ? new Date(value) : null;
  const [year, setYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [month, setMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());
  const [day, setDay] = useState(parsed ? parsed.getDate() : today.getDate());

  const openPicker = () => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setYear(d.getFullYear());
        setMonth(d.getMonth());
        setDay(d.getDate());
      }
    }
    setOpen(true);
  };

  const finalDay = Math.min(day, daysInMonth(year, month));
  const confirmDisabled = outOfRange(year, month, finalDay);

  const confirm = () => {
    if (confirmDisabled) return;
    onChange(iso(year, month, finalDay));
    setOpen(false);
  };

  // A whole month lying entirely before min / after max can't hold a valid day,
  // so navigating into it is blocked.
  const prevYM = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextYM = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const prevDisabled = !!minDate && iso(prevYM.y, prevYM.m, daysInMonth(prevYM.y, prevYM.m)) < minDate;
  const nextDisabled = !!maxDate && iso(nextYM.y, nextYM.m, 1) > maxDate;

  const prevMonth = () => { if (!prevDisabled) { setMonth(prevYM.m); setYear(prevYM.y); } };
  const nextMonth = () => { if (!nextDisabled) { setMonth(nextYM.m); setYear(nextYM.y); } };

  const totalDays = daysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(firstDayOfWeek).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const displayValue = value || '';

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: T.sub }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          { backgroundColor: T.fieldBg, borderColor: T.line },
          !!error && { borderColor: T.danger },
        ]}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <Calendar size={16} color={T.dim} />
        <Text style={[styles.triggerText, { color: displayValue ? T.text : T.dim }]}
          numberOfLines={1}>
          {displayValue || placeholder}
        </Text>
        <ChevronDown size={16} color={T.dim} />
      </TouchableOpacity>
      {!!error && <Text style={[styles.errorText, { color: T.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: T.card }]} onPress={() => {}}>
            {/* Month/Year Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={prevMonth} hitSlop={12} disabled={prevDisabled}>
                <ChevronLeft size={20} color={prevDisabled ? T.dim : T.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: T.text }]}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={12} disabled={nextDisabled}>
                <ChevronRight size={20} color={nextDisabled ? T.dim : T.text} />
              </TouchableOpacity>
            </View>

            {/* Year Quick Select */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll} contentContainerStyle={styles.yearRow}>
              {Array.from({ length: 7 }, (_, i) => today.getFullYear() - 1 + i).map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, { backgroundColor: T.cardAlt }, year === y && { backgroundColor: accent }]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearChipText, { color: year === y ? '#FFF' : T.sub }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Day Names */}
            <View style={styles.dayNamesRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={[styles.dayName, { color: T.dim }]}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((d, di) => {
                  const disabled = !d || outOfRange(year, month, d);
                  const selected = d === day && !disabled;
                  return (
                  <TouchableOpacity
                    key={di}
                    style={[styles.dayCell, selected && { backgroundColor: accent, borderRadius: 20 }]}
                    onPress={() => d && setDay(d)}
                    disabled={disabled}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: T.text },
                      selected && { color: '#FFF', fontWeight: '700' },
                      !d && { color: 'transparent' },
                      !!d && disabled && { color: T.dim, opacity: 0.4 },
                    ]}>
                      {d ?? ''}
                    </Text>
                  </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: T.cardAlt }]} onPress={() => setOpen(false)}>
                <Text style={[styles.cancelText, { color: T.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: accent }, confirmDisabled && { opacity: 0.4 }]}
                onPress={confirm}
                disabled={confirmDisabled}
              >
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: rf(13), fontWeight: '600', marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  triggerText: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: rf(14) },
  errorText: { fontSize: rf(11), marginTop: 4 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    borderRadius: 20, padding: 20,
    width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: rf(16), fontWeight: '700' },
  yearScroll: { marginBottom: 12, flexGrow: 0 },
  yearRow: { flexDirection: 'row', gap: 6 },
  yearChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 100,
  },
  yearChipText: { fontSize: rf(12), fontWeight: '600' },
  dayNamesRow: { flexDirection: 'row', marginBottom: 4 },
  dayName: {
    flex: 1, textAlign: 'center',
    fontSize: rf(11), fontWeight: '700',
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
  },
  dayText: { fontSize: rf(14) },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: rf(14), fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  confirmText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});
