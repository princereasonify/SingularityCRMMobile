import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { rf } from '../../utils/responsive';

interface DateInputProps {
  label?: string;
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  accentColor?: string;
  error?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export const DateInput = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  accentColor = '#0d9488',
  error,
}: DateInputProps) => {
  const [open, setOpen] = useState(false);

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

  const confirm = () => {
    const maxDay = daysInMonth(year, month);
    const finalDay = Math.min(day, maxDay);
    onChange(`${year}-${pad(month + 1)}-${pad(finalDay)}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

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
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.trigger, error && { borderColor: '#EF4444' }]}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <Calendar size={16} color="#9CA3AF" />
        <Text style={[styles.triggerText, !displayValue && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
        <ChevronDown size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            {/* Month/Year Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={prevMonth} hitSlop={12}>
                <ChevronLeft size={20} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={12}>
                <ChevronRight size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Year Quick Select */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll} contentContainerStyle={styles.yearRow}>
              {Array.from({ length: 7 }, (_, i) => today.getFullYear() - 1 + i).map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, year === y && { backgroundColor: accentColor }]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearChipText, year === y && { color: '#FFF' }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Day Names */}
            <View style={styles.dayNamesRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={styles.dayName}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((d, di) => (
                  <TouchableOpacity
                    key={di}
                    style={[styles.dayCell, d === day && { backgroundColor: accentColor, borderRadius: 20 }]}
                    onPress={() => d && setDay(d)}
                    disabled={!d}
                  >
                    <Text style={[styles.dayText, d === day && { color: '#FFF', fontWeight: '700' }, !d && { color: 'transparent' }]}>
                      {d ?? ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: accentColor }]} onPress={confirm}>
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
  label: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  triggerText: { flex: 1, fontSize: rf(14), color: '#111827' },
  placeholder: { color: '#9CA3AF' },
  errorText: { fontSize: rf(11), color: '#EF4444', marginTop: 4 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  yearScroll: { marginBottom: 12, flexGrow: 0 },
  yearRow: { flexDirection: 'row', gap: 6 },
  yearChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 100, backgroundColor: '#F3F4F6',
  },
  yearChipText: { fontSize: rf(12), fontWeight: '600', color: '#6B7280' },
  dayNamesRow: { flexDirection: 'row', marginBottom: 4 },
  dayName: {
    flex: 1, textAlign: 'center',
    fontSize: rf(11), fontWeight: '700', color: '#9CA3AF',
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
  },
  dayText: { fontSize: rf(14), color: '#374151' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  confirmText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});
