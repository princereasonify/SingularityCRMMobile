/**
 * Place of Supply: type a state ("guj") and pick it; fills "Gujarat (24)" — the state with its
 * GST code, the way place of supply is written on GST documents. Free text is still accepted.
 * Mobile twin of web's salesDocs/StateField.jsx.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Input } from '../crud';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { GST_STATE_CODES } from '../../utils/salesDocUtils';

const STATES = Object.entries(GST_STATE_CODES)
  .map(([name, code]) => ({ name, code }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}

export const StatePicker = ({ value, onChange, placeholder = 'Type a state', label }: Props) => {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = (value || '').replace(/\s*\(\d{2}\)\s*$/, '').trim().toLowerCase();
    if (!q) return STATES;
    const starts = STATES.filter((s) => s.name.toLowerCase().startsWith(q) || s.code === q);
    const contains = STATES.filter((s) => !starts.includes(s) && s.name.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [value]);

  const pick = (s: { name: string; code: string }) => {
    onChange(`${s.name} (${s.code})`);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        value={value}
        onChangeText={(t: string) => { onChange(t); setOpen(true); }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: T.card, borderColor: T.line }]}>
          {matches.slice(0, 8).map((s) => (
            <TouchableOpacity
              key={s.code}
              onPress={() => pick(s)}
              activeOpacity={0.7}
              style={[styles.item, { borderBottomColor: T.line }]}
            >
              <Text style={[styles.itemName, { color: T.text }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.itemCode, { color: T.dim }]}>{s.code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 20 },
  dropdown: {
    position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, borderRadius: 12, borderWidth: 1,
    maxHeight: 240, zIndex: 30, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  item: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: rf(12.5), fontWeight: '500', flex: 1 },
  itemCode: { fontSize: rf(12), fontWeight: '600' },
});

export default StatePicker;
