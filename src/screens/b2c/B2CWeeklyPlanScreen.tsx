import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react-native';
import { Screen, Card, Badge } from '../../components/ui';
import { Btn, IconBtn, SearchBar, ListCard, StatusBadge, FormModal } from '../../components/crud';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadListDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { useToast } from '../../context/ToastContext';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
// Local-component YYYY-MM-DD — avoids the UTC day-shift that toISOString() causes in +05:30.
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// A visit's day straight from the stored string, so no timezone maths can move it.
const visitDay = (v: any) => String(v.plannedDate ?? '').split('T')[0];

// Monday-based start of the week containing `d` (mirrors the web page).
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Mirrors web statusTag { Planned: accent, Done: positive, Skipped: neutral }.
const statusColor = (status: string, T: any) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.sub : T.accent;

interface PlannedVisit {
  id: number;
  leadId: number;
  studentName?: string;
  status: string;
  plannedDate: string;
}

export const B2CWeeklyPlanScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;                // iPad landscape → 2-up day grid
  const dayWidth = isWide ? '48.5%' : '100%';

  const [anchor, setAnchor] = useState(startOfWeek(new Date()));
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add-visit modal
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor); d.setDate(anchor.getDate() + i); return d;
    }),
    [anchor],
  );
  const from = iso(days[0]);
  const to = iso(days[6]);

  const load = useCallback(async () => {
    try {
      const res = await b2cPlannerService.get(from, to);
      setVisits((res.data as PlannedVisit[]) ?? []);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    b2cLeadService.getLeads({ page: 1, pageSize: 200 })
      .then(res => setLeads(res.data?.items ?? []))
      .catch(() => setLeads([]));
  }, []);

  const visitsOn = (d: Date) => visits.filter(v => visitDay(v) === iso(d));

  const shiftWeek = (n: number) => {
    const x = new Date(anchor); x.setDate(anchor.getDate() + n * 7); setAnchor(x);
  };

  const openAdd = (d: Date) => { setModalDate(d); setLeadId(null); setLeadSearch(''); };

  const addVisit = async () => {
    if (!leadId || !modalDate) return;
    setSaving(true);
    try {
      await b2cPlannerService.create({
        leadId: Number(leadId),
        plannedDate: iso(modalDate),
        sortOrder: visitsOn(modalDate).length,
      });
      setModalDate(null); setLeadId(null); setLeadSearch('');
      toast.success('Visit planned');
      setLoading(true); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add visit');
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (v: PlannedVisit) => {
    try {
      await b2cPlannerService.update(v.id, { status: 'Done' });
      toast.success('Marked done');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update visit');
    }
  };

  const openLead = (id: number) => nav.navigate('B2CLeadDetail', { leadId: id });

  const weekLabel = `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const filteredLeads = leads.filter(l =>
    !leadSearch.trim() || (l.studentName || '').toLowerCase().includes(leadSearch.trim().toLowerCase()),
  );

  const renderDay = (d: Date, i: number) => {
    const dayVisits = visitsOn(d);
    const isToday = iso(d) === iso(new Date());
    return (
      <View key={i} style={[st.dayCol, { width: dayWidth }]}>
        {/* Day header */}
        <View style={[st.dayHead, { borderBottomColor: isToday ? T.accent : T.line }]}>
          <View style={st.dayHeadLeft}>
            <Text style={[st.dayName, { color: isToday ? T.accent : T.text }]}>{DAY_NAMES[i]}</Text>
            <Text style={[st.dayDate, { color: T.dim }]}>
              {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
            {isToday && <Badge label="Today" color={T.accent} />}
          </View>
          <IconBtn kind="view" onPress={() => openAdd(d)} label="Add visit">
            <Plus size={16} color={T.accent} strokeWidth={2.4} />
          </IconBtn>
        </View>

        {/* Visits for the day */}
        {dayVisits.length === 0 ? (
          <Text style={[st.emptyDay, { color: T.dim, borderColor: T.line }]}>No visits planned</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {dayVisits.map(v => (
              <ListCard key={v.id} onPress={() => openLead(v.leadId)}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[st.studentName, { color: T.text }]} numberOfLines={1}>{v.studentName || `Lead #${v.leadId}`}</Text>
                  <StatusBadge label={v.status} color={statusColor(v.status, T)} />
                </View>
                {v.status !== 'Done' && (
                  <TouchableOpacity
                    onPress={() => markDone(v)}
                    hitSlop={10}
                    style={[st.doneBtn, { backgroundColor: T.success + '1F' }]}
                    accessibilityLabel="Mark done"
                  >
                    <Check size={16} color={T.success} strokeWidth={2.6} />
                  </TouchableOpacity>
                )}
              </ListCard>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[st.subtitle, { color: T.sub }]}>Plan your visits across the week</Text>

      {/* Week navigator */}
      <Card style={{ marginTop: 12 }} padded={false}>
        <View style={st.weekNav}>
          <IconBtn kind="view" onPress={() => shiftWeek(-1)} label="Previous week">
            <ChevronLeft size={18} color={T.accent} strokeWidth={2.2} />
          </IconBtn>
          <Text style={[st.weekLabel, { color: T.text }]} numberOfLines={1}>{weekLabel}</Text>
          <IconBtn kind="view" onPress={() => shiftWeek(1)} label="Next week">
            <ChevronRight size={18} color={T.accent} strokeWidth={2.2} />
          </IconBtn>
        </View>
        <View style={[st.todayRow, { borderTopColor: T.line }]}>
          <Btn label="Today" variant="secondary" small onPress={() => setAnchor(startOfWeek(new Date()))} />
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <View style={[st.grid, { marginTop: 16 }]}>
          {days.map(renderDay)}
        </View>
      )}

      {/* Add-visit modal */}
      <FormModal
        visible={!!modalDate}
        title={modalDate ? `Plan a visit · ${modalDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Plan a visit'}
        onClose={() => setModalDate(null)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setModalDate(null)} disabled={saving} style={{ flex: 1 }} />
            <Btn label={saving ? 'Adding…' : 'Add visit'} onPress={addVisit} loading={saving} disabled={saving || !leadId} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={[st.pickLabel, { color: T.text }]}>Student *</Text>
          <SearchBar value={leadSearch} onChangeText={setLeadSearch} placeholder="Search students…" />
          <View style={{ gap: 8 }}>
            {filteredLeads.length === 0 ? (
              <Text style={[st.noLeads, { color: T.dim }]}>No students found</Text>
            ) : (
              filteredLeads.slice(0, 50).map(l => {
                const on = leadId === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => setLeadId(l.id)}
                    activeOpacity={0.8}
                    style={[st.leadRow, { borderColor: on ? T.accent : T.line, backgroundColor: on ? T.accentSoft : T.card }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[st.leadName, { color: on ? T.accent : T.text }]} numberOfLines={1}>{l.studentName}</Text>
                      {!!l.city && <Text style={[st.leadCity, { color: T.dim }]} numberOfLines={1}>{l.city}</Text>}
                    </View>
                    {on && <Check size={16} color={T.accent} strokeWidth={2.6} />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </FormModal>
    </Screen>
  );
};

const st = StyleSheet.create({
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: rf(13.5), fontWeight: '700' },
  todayRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dayCol: { gap: 10 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1 },
  dayHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayName: { fontSize: rf(14), fontWeight: '800', letterSpacing: -0.2 },
  dayDate: { fontSize: rf(12), fontWeight: '600' },
  emptyDay: { fontSize: rf(12), fontWeight: '500', paddingVertical: 14, textAlign: 'center', borderWidth: 1, borderRadius: 12, borderStyle: 'dashed' },
  studentName: { fontSize: rf(13.5), fontWeight: '700' },
  doneBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickLabel: { fontSize: rf(12.5), fontWeight: '600' },
  noLeads: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 16 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13 },
  leadName: { fontSize: rf(13.5), fontWeight: '600' },
  leadCity: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
});
