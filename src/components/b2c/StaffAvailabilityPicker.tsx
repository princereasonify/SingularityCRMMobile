/**
 * Picks the Agent or Counselor a lead is being handed to, showing how full their day already
 * is. Mobile twin of web's components/b2c/StaffAvailabilityPicker.jsx.
 *
 * The list comes from the staff's OWN records — planned visits, booked appointment times,
 * approved leave, and the agent lead cap — so a caller is never offered someone the assign
 * endpoint is about to refuse.
 *
 * Two things this component is careful about:
 * 1. IDS. `userId` and `counselorId` are different id spaces, and the two assignment endpoints
 *    want different ones (assign → userId, escalate → counselorId). The whole staff row is
 *    handed back through onChange so the caller picks the right field rather than guessing.
 * 2. IT WARNS, IT DOES NOT BLOCK. Someone on leave or at their cap is still listed and still
 *    selectable — only the reason is made impossible to miss.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertTriangle, ChevronDown } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { ICON_STROKE } from '../common/Icon';
import { b2cCallingService, StaffAvailabilityRow } from '../../api/b2c/b2cCallingService';
import { isoDate } from '../../utils/dates';

interface Props {
  kind: 'Agent' | 'Counselor';
  /** The datetime-local string being booked, for clash detection. */
  at: string;
  value?: number;
  onChange: (row: StaffAvailabilityRow | null) => void;
  label: string;
}

const timeOnly = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const describe = (s: StaffAvailabilityRow) => {
  const bits: string[] = [];
  if (s.isManager) bits.push(`manages ${s.teamSize}`);
  bits.push(s.plannedVisits === 1 ? '1 visit that day' : s.plannedVisits ? `${s.plannedVisits} visits that day` : 'no visits that day');
  if (s.activeLeads != null) bits.push(`${s.activeLeads} of ${s.leadCap} leads`);
  if (!s.available) bits.push(`⚠ ${s.unavailableReason}`);
  return `${s.name} — ${bits.join(' · ')}`;
};

export const StaffAvailabilityPicker = ({ kind, at, value, onChange, label }: Props) => {
  const T = useAppTheme();
  const [staff, setStaff] = useState<StaffAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Availability is per-DAY, so only the date part should re-fetch.
  const day = at ? isoDate(new Date(at)) : '';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    b2cCallingService.getAvailability({ kind, date: day || undefined })
      .then((res) => { if (alive) setStaff(res.data?.staff || []); })
      .catch(() => { if (alive) { setStaff([]); setFailed(true); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind, day]);

  const selected = useMemo(() => staff.find((s) => s.userId === value) || null, [staff, value]);
  const [open, setOpen] = useState(false);

  /** A slot within the same hour as one already booked. */
  const clash = useMemo(() => {
    if (!selected || !at) return null;
    const target = new Date(at).getTime();
    return (selected.bookedSlots || []).find((s) => Math.abs(new Date(s).getTime() - target) < 3600000) || null;
  }, [selected, at]);

  const statusLabel = loading ? 'Checking availability…'
    : failed ? 'Unavailable — could not load'
    : `Select a ${kind === 'Agent' ? 'field agent' : 'counsellor'}…`;

  return (
    <View style={{ gap: 8 }}>
      {!!label && <Text style={[styles.label, { color: T.text }]}>{label} *</Text>}
      <View>
        <TouchableOpacity
          onPress={() => { if (!loading && staff.length) setOpen((o) => !o); }}
          activeOpacity={0.8}
          disabled={loading || staff.length === 0}
          style={[styles.trigger, { backgroundColor: T.card, borderColor: open ? T.accent : T.line }]}
        >
          <Text style={[styles.triggerTxt, { color: selected ? T.text : T.dim }]} numberOfLines={1}>
            {selected ? describe(selected) : statusLabel}
          </Text>
          {loading ? <ActivityIndicator size="small" color={T.dim} /> : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
        </TouchableOpacity>
        {open && staff.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: T.card, borderColor: T.line }]}>
            {staff.map((s) => (
              <TouchableOpacity
                key={s.userId}
                onPress={() => { onChange(s); setOpen(false); }}
                activeOpacity={0.7}
                style={[styles.item, { borderBottomColor: T.line }]}
              >
                <Text style={[styles.itemTxt, { color: s.available ? T.text : T.warning }]}>{describe(s)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {!loading && !failed && staff.length === 0 && (
        <Text style={[styles.hint, { color: T.dim }]}>
          No active {kind === 'Agent' ? 'field agents' : 'counsellors'} exist to assign to.
        </Text>
      )}

      {selected && !selected.available && (
        <View style={[styles.alert, { backgroundColor: T.warning + '18', borderColor: T.warning + '40' }]}>
          <AlertTriangle size={14} color={T.warning} strokeWidth={ICON_STROKE} />
          <Text style={[styles.alertTxt, { color: T.text }]}>
            {selected.name} is not free: {selected.unavailableReason}. You can still assign them — the visit will simply land on a day they may not work.
          </Text>
        </View>
      )}

      {clash && selected && (
        <View style={[styles.alert, { backgroundColor: T.warning + '18', borderColor: T.warning + '40' }]}>
          <AlertTriangle size={14} color={T.warning} strokeWidth={ICON_STROKE} />
          <Text style={[styles.alertTxt, { color: T.text }]}>
            {selected.name} already has a visit at {timeOnly(clash)} that day. Pick another time, or go ahead if you know it fits.
          </Text>
        </View>
      )}

      {selected?.available && !clash && (selected.bookedSlots || []).length > 0 && (
        <Text style={[styles.hint, { color: T.dim }]}>
          Already visiting someone at: {(selected.bookedSlots || []).map(timeOnly).join(', ')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: rf(11), fontWeight: '600', marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  triggerTxt: { flex: 1, fontSize: rf(12.5), fontWeight: '500' },
  dropdown: {
    marginTop: 6, borderRadius: 12, borderWidth: 1, maxHeight: 260, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  item: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  itemTxt: { fontSize: rf(12), fontWeight: '500' },
  alert: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'flex-start' },
  alertTxt: { flex: 1, fontSize: rf(11.5), fontWeight: '500', lineHeight: 16 },
  hint: { fontSize: rf(11), fontWeight: '500' },
});

export default StaffAvailabilityPicker;
