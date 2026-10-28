/**
 * Ref. picker: choose one of the saved documents of a type ("number — school"). Mobile twin of
 * web's salesDocs/SalesDocumentEditor.jsx DocumentPicker — backs the Tax Invoice's Ref. Order
 * No. and the Purchase Order's Ref. Quotation No. pickers.
 *
 * Like web's <select>: a "None" row clears the ref (onChange('', null) — the editor's pickOrder /
 * pickQuotation just blank the number and bump their pick sequence, so nothing is fetched or
 * filled and any in-flight fill is discarded), and a saved number that is no longer in the list
 * (deleted, or outside this user's scope) stays visible as its own row instead of vanishing.
 * The list scrolls inside the capped panel (nestedScrollEnabled — the editor is a ScrollView).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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
  /** Which saved documents may be picked (e.g. approved quotations only). */
  filter?: (d: SalesDocumentSummary) => boolean;
  /** Extra text after the school name in each row (e.g. the billing plan). */
  describe?: (d: SalesDocumentSummary) => string;
}

export const DocumentRefPicker = ({ type, label, value, onChange, busy, busyLabel, emptyLabel, placeholder, filter, describe }: Props) => {
  const T = useAppTheme();
  const [docs, setDocs] = useState<SalesDocumentSummary[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    salesDocumentService.list(type)
      .then((res) => { if (alive) setDocs((res.data || []).filter(filter || (() => true))); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Openable once loaded if there is anything to pick — or a saved value to clear.
  const canOpen = !busy && docs !== null && (docs.length > 0 || !!value);
  const toggle = () => { if (canOpen) setOpen((o) => !o); };
  const pick = (number: string, doc: SalesDocumentSummary | null) => { onChange(number, doc); setOpen(false); };

  const statusLabel = busy ? busyLabel : docs === null ? 'Loading…' : docs.length ? placeholder : emptyLabel;
  const known = (docs || []).some((d) => d.documentNumber === value);

  return (
    <View>
      {!!label && <Text style={[styles.label, { color: T.text }]}>{label}</Text>}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.8}
        disabled={!canOpen}
        style={[styles.trigger, { backgroundColor: T.card, borderColor: open ? T.accent : T.line }]}
      >
        <Text style={[styles.triggerTxt, { color: value ? T.text : T.dim }]} numberOfLines={1}>
          {value || statusLabel}
        </Text>
        {busy ? <ActivityIndicator size="small" color={T.dim} /> : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>
      {open && docs && (
        <View style={[styles.dropdown, { backgroundColor: T.card, borderColor: T.line }]}>
          <ScrollView style={styles.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => pick('', null)} activeOpacity={0.7} style={[styles.item, { borderBottomColor: T.line }]}>
              <Text style={[styles.itemMain, { color: T.sub, fontWeight: '500' }]} numberOfLines={1}>None</Text>
            </TouchableOpacity>
            {!!value && !known && (
              <TouchableOpacity onPress={() => pick(value, null)} activeOpacity={0.7}
                style={[styles.item, { borderBottomColor: T.line, backgroundColor: T.accentSoft }]}>
                <Text style={[styles.itemMain, { color: T.accent }]} numberOfLines={1}>{value}</Text>
                <Text style={[styles.itemSub, { color: T.sub }]} numberOfLines={1}>Saved on this document</Text>
              </TouchableOpacity>
            )}
            {docs.map((d) => {
              const on = d.documentNumber === value;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => pick(d.documentNumber, d)}
                  activeOpacity={0.7}
                  style={[styles.item, { borderBottomColor: T.line }, on && { backgroundColor: T.accentSoft }]}
                >
                  <Text style={[styles.itemMain, { color: on ? T.accent : T.text }]} numberOfLines={1}>{d.documentNumber}</Text>
                  <Text style={[styles.itemSub, { color: T.sub }]} numberOfLines={1}>{d.schoolName || 'School'}{describe ? describe(d) : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
    marginTop: 6, borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  scroll: { maxHeight: 220 },
  item: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  itemMain: { fontSize: rf(12.5), fontWeight: '700' },
  itemSub: { fontSize: rf(11), fontWeight: '500' },
});

export default DocumentRefPicker;
