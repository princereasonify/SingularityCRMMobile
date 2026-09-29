/**
 * Ref. picker: choose one of the saved documents of a type ("number — school"). Mobile twin of
 * web's salesDocs/SalesDocumentEditor.jsx DocumentPicker — backs the Tax Invoice's Ref. Order
 * No. and the Purchase Order's Ref. Quotation No. pickers.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { ICON_STROKE } from '../common/Icon';
import { salesDocumentService, SalesDocumentSummary } from '../../api/salesDocumentService';
import { DocType } from '../../utils/salesDocUtils';

interface Props {
  type: DocType;
  label: string;
  value: string;
  onChange: (number: string, doc: SalesDocumentSummary | null) => void;
  busy?: boolean;
  busyLabel: string;
  emptyLabel: string;
  placeholder: string;
}

export const DocumentRefPicker = ({ type, label, value, onChange, busy, busyLabel, emptyLabel, placeholder }: Props) => {
  const T = useAppTheme();
  const [docs, setDocs] = useState<SalesDocumentSummary[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    salesDocumentService.list(type)
      .then((res) => { if (alive) setDocs(res.data || []); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [type]);

  const toggle = () => { if (!busy && docs && docs.length) setOpen((o) => !o); };

  const statusLabel = busy ? busyLabel : docs === null ? 'Loading…' : docs.length ? placeholder : emptyLabel;

  return (
    <View>
      {!!label && <Text style={[styles.label, { color: T.text }]}>{label}</Text>}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.8}
        disabled={!!busy || docs === null || docs.length === 0}
        style={[styles.trigger, { backgroundColor: T.card, borderColor: open ? T.accent : T.line }]}
      >
        <Text style={[styles.triggerTxt, { color: value ? T.text : T.dim }]} numberOfLines={1}>
          {value || statusLabel}
        </Text>
        {busy ? <ActivityIndicator size="small" color={T.dim} /> : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>
      {open && docs && docs.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: T.card, borderColor: T.line }]}>
          {docs.map((d) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => { onChange(d.documentNumber, d); setOpen(false); }}
              activeOpacity={0.7}
              style={[styles.item, { borderBottomColor: T.line }]}
            >
              <Text style={[styles.itemMain, { color: T.text }]} numberOfLines={1}>{d.documentNumber}</Text>
              <Text style={[styles.itemSub, { color: T.sub }]} numberOfLines={1}>{d.schoolName || 'School'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: rf(11), fontWeight: '600', marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
  },
  triggerTxt: { flex: 1, fontSize: rf(13.5), fontWeight: '500' },
  dropdown: {
    marginTop: 6, borderRadius: 12, borderWidth: 1, maxHeight: 220, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  item: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  itemMain: { fontSize: rf(12.5), fontWeight: '700' },
  itemSub: { fontSize: rf(11), fontWeight: '500' },
});

export default DocumentRefPicker;
