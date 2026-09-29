/**
 * Address field with Google Places suggestions (India) — mobile twin of web's
 * salesDocs/AddressField.jsx. Typing "A" lists Assam, Ahmedabad, …; picking one hands the
 * parsed address to `onPick` so the form can fill its own fields.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Input } from '../crud';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { placesService, PlacePrediction, PlaceDetailsResult } from '../../api/placesService';
import { parsePlace, ParsedPlace } from '../../utils/addressParse';
import { ICON_STROKE } from '../common/Icon';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onPick: (place: ParsedPlace) => void;
  placeholder?: string;
  error?: string;
  label?: string;
}

export const AddressAutocomplete = ({ value, onChangeText, onPick, placeholder, error, label }: Props) => {
  const T = useAppTheme();
  const [items, setItems] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const search = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    const q = text.trim();
    if (!q) { setItems([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const res = await placesService.autocomplete(q);
        if (id !== reqId.current) return;
        setItems((res.data?.predictions || []).slice(0, 6));
        setOpen(true);
      } catch {
        if (id === reqId.current) setItems([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
  };

  const pick = async (p: PlacePrediction) => {
    setOpen(false);
    setItems([]);
    onChangeText(p.description.replace(/,\s*India$/, ''));
    try {
      const res = await placesService.details(p.place_id);
      const result: PlaceDetailsResult | undefined = res.data?.result;
      onPick(parsePlace(result));
    } catch {
      onPick({ line1: p.description.replace(/,\s*India$/, ''), line2: '', full: p.description, city: '', state: '', stateCode: '', pincode: '' });
    }
  };

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        value={value}
        onChangeText={(t: string) => { onChangeText(t); search(t); }}
        placeholder={placeholder || 'Start typing to search'}
        error={error}
        onFocus={() => { if (items.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        right={loading ? <ActivityIndicator size="small" color={T.dim} /> : undefined}
      />
      {open && items.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: T.card, borderColor: T.line }]}>
          {items.map((p) => (
            <TouchableOpacity
              key={p.place_id}
              onPress={() => pick(p)}
              activeOpacity={0.7}
              style={[styles.item, { borderBottomColor: T.line }]}
            >
              <MapPin size={14} color={T.accent} strokeWidth={ICON_STROKE} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.itemMain, { color: T.text }]} numberOfLines={1}>
                  {p.structured_formatting?.main_text || p.description}
                </Text>
                {!!p.structured_formatting?.secondary_text && (
                  <Text style={[styles.itemSub, { color: T.sub }]} numberOfLines={1}>
                    {p.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <Text style={[styles.poweredBy, { color: T.dim }]}>powered by Google</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 20 },
  dropdown: {
    position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, borderRadius: 12, borderWidth: 1,
    maxHeight: 260, zIndex: 30, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  item: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  itemMain: { fontSize: rf(12.5), fontWeight: '600' },
  itemSub: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  poweredBy: { fontSize: rf(9.5), fontWeight: '500', textAlign: 'right', paddingHorizontal: 10, paddingVertical: 4 },
});

export default AddressAutocomplete;
