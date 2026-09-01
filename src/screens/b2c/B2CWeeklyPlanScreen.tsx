import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react-native';
import { Screen, Card, Badge } from '../../components/ui';
import { Btn, SearchBar, ListCard, StatusBadge, FormModal } from '../../components/crud';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadListDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { useToast } from '../../context/ToastContext';
import { isoDate, todayStr, timeOnly, isSameLocalDay } from '../../utils/dates';
import { label } from '../../utils/labels';

/**
 * B2CWeeklyPlanScreen — mobile mirror of the web B2CWeeklyPlan page: seven day columns,
 * each listing the visits planned for it, with a quick "mark done" and an add-visit sheet.
 *
 * The web lays the seven days out in one row; a phone gets one column, a tablet two and a
 * landscape iPad four, because seven 150pt columns clip the day header they carry.
 */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Monday-based start of the week containing `d` (mirrors the web page). */
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const dayMonth = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;

// Mirrors web statusTag { Planned: accent, Done: positive, Skipped: neutral }.
const statusColor = (status: string, T: AppTheme) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.dim : T.accent;

interface PlannedVisit {
  id: number;
  leadId: number;
  studentName?: string;
  status: string;
  plannedDate: string;
  /** When a family agreed a specific slot — the plan row shows the promised time. */
  appointmentAt?: string | null;
}

export const B2CWeeklyPlanScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const r = useResponsive();

  // Seven day columns never fit a phone; two on a tablet, four when the iPad is landscape.
  const columns = r.isWide ? 4 : r.isTablet ? 2 : 1;
  const colWidth = columns === 1 ? '100%' : `${(100 - (columns - 1) * 2) / columns}%`;

  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
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
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      return d;
    }),
    [anchor],
  );
  const from = isoDate(days[0]);
  const to = isoDate(days[6]);

  const load = useCallback(async () => {
    try {
      const res = await b2cPlannerService.get(from, to);
      setVisits(((res.data as any) ?? []) as PlannedVisit[]);
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

  // Keyed off the LOCAL calendar day, so a visit never lands in yesterday's column.
  const visitsOn = (d: Date) => visits.filter(v => isoDate(v.plannedDate) === isoDate(d));

  const shiftWeek = (n: number) => {
    const x = new Date(anchor);
    x.setDate(anchor.getDate() + n * 7);
    setAnchor(x);
  };

  const openAdd = (d: Date) => { setModalDate(d); setLeadId(null); setLeadSearch(''); };

  const addVisit = async () => {
    if (!leadId || !modalDate) return;
    setSaving(true);
    try {
      await b2cPlannerService.create({
        leadId: Number(leadId),
        plannedDate: isoDate(modalDate),
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

  const weekLabel = `${dayMonth(days[0])} – ${dayMonth(days[6])} ${days[6].getFullYear()}`;

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return q ? leads.filter(l => (l.studentName || '').toLowerCase().includes(q)) : leads;
  }, [leads, leadSearch]);

  const s = useMemo(() => makeStyles(r, T, colWidth), [r, T, colWidth]);

  const renderDay = (d: Date, i: number) => {
    const dayVisits = visitsOn(d);
    const isToday = isoDate(d) === todayStr();
    return (
      <View key={i} style={s.dayCol}>
        <View style={[s.dayHead, { borderBottomColor: isToday ? T.accent : T.line }]}>
          <View style={s.dayHeadLeft}>
            <Text style={[s.dayName, { color: isToday ? T.accent : T.text }]}>{DAY_NAMES[i]}</Text>
            <Text style={[s.dayDate, { color: T.dim }]}>{dayMonth(d)}</Text>
            {isToday && <Badge label="Today" color={T.accent} />}
          </View>
          <TouchableOpacity
            onPress={() => openAdd(d)}
            activeOpacity={0.8}
            accessibilityLabel={`Add a visit on ${DAY_NAMES[i]} ${dayMonth(d)}`}
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <Plus size={18} color={T.accent} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {dayVisits.length === 0 ? (
          <Text style={[s.emptyDay, { color: T.dim, borderColor: T.line }]}>No visits planned</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {dayVisits.map(v => (
              <ListCard key={v.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: v.leadId })}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[s.studentName, { color: T.text }]} numberOfLines={1}>
                    {/* A promised slot is the most load-bearing thing on the row. */}
                    {isSameLocalDay(v.appointmentAt, isoDate(d)) && (
                      <Text style={{ color: T.accent }}>{timeOnly(v.appointmentAt as string)}  </Text>
                    )}
                    {v.studentName || `Lead #${v.leadId}`}
                  </Text>
                  <View style={s.badgeRow}>
                    <StatusBadge label={label(v.status)} color={statusColor(v.status, T)} />
                  </View>
                </View>
                {v.status !== 'Done' && (
                  <TouchableOpacity
                    onPress={() => markDone(v)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Mark ${v.studentName || 'visit'} done`}
                    style={[s.tapBtn, { backgroundColor: T.success + '1F' }]}
                  >
                    <Check size={18} color={T.success} strokeWidth={2.6} />
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
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      contentStyle={r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } : undefined}
    >
      <Text style={[s.subtitle, { color: T.sub }]}>Plan your visits across the week</Text>

      {/* Week navigator */}
      <Card style={{ marginTop: 12 }} padded={false}>
        <View style={s.weekNav}>
          <TouchableOpacity
            onPress={() => shiftWeek(-1)}
            activeOpacity={0.8}
            accessibilityLabel="Previous week"
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <ChevronLeft size={20} color={T.accent} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[s.weekLabel, { color: T.text }]} numberOfLines={1}>{weekLabel}</Text>
          <TouchableOpacity
            onPress={() => shiftWeek(1)}
            activeOpacity={0.8}
            accessibilityLabel="Next week"
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <ChevronRight size={20} color={T.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        <View style={[s.todayRow, { borderTopColor: T.line }]}>
          <Text style={[s.weekCount, { color: T.dim }]}>
            {visits.length} visit{visits.length === 1 ? '' : 's'} this week
          </Text>
          <Btn label="Today" variant="secondary" small onPress={() => setAnchor(startOfWeek(new Date()))} />
        </View>
      </Card>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <View style={s.grid}>{days.map(renderDay)}</View>
      )}

      {/* Add-visit modal */}
      <FormModal
        visible={!!modalDate}
        title={modalDate
          ? `Plan a visit · ${WD_LONG[modalDate.getDay()]} ${dayMonth(modalDate)}`
          : 'Plan a visit'}
        onClose={() => setModalDate(null)}
        wide={r.isTablet}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setModalDate(null)} disabled={saving} style={{ flex: 1 }} />
            <Btn label={saving ? 'Adding…' : 'Add visit'} onPress={addVisit} loading={saving} disabled={saving || !leadId} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={[s.pickLabel, { color: T.text }]}>Student *</Text>
          <SearchBar value={leadSearch} onChangeText={setLeadSearch} placeholder="Search students…" />
          <View style={{ gap: 8 }}>
            {filteredLeads.length === 0 ? (
              <Text style={[s.noLeads, { color: T.dim }]}>No students found</Text>
            ) : (
              filteredLeads.slice(0, 50).map(l => {
                const on = leadId === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => setLeadId(l.id)}
                    activeOpacity={0.8}
                    style={[s.leadRow, { borderColor: on ? T.accent : T.line, backgroundColor: on ? T.accentSoft : T.card }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.leadName, { color: on ? T.accent : T.text }]} numberOfLines={1}>{l.studentName}</Text>
                      {!!l.city && <Text style={[s.leadCity, { color: T.dim }]} numberOfLines={1}>{l.city}</Text>}
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

const makeStyles = (r: ReturnType<typeof useResponsive>, T: AppTheme, colWidth: string) =>
  StyleSheet.create({
    subtitle: { fontSize: r.rf(12.5), fontWeight: '500' },

    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    },
    weekLabel: { flex: 1, textAlign: 'center', fontSize: r.rf(13.5), fontWeight: '800', letterSpacing: -0.2 },
    todayRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
    },
    weekCount: { fontSize: r.rf(11.5), fontWeight: '600' },

    /** Every touchable is at least the HIG minimum in both dimensions. */
    tapBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap + 2, marginTop: 16 },
    dayCol: { width: colWidth as any, gap: 10 },
    dayHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, paddingBottom: 8, borderBottomWidth: 1,
    },
    dayHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
    dayName: { fontSize: r.rf(14), fontWeight: '800', letterSpacing: -0.2 },
    dayDate: { fontSize: r.rf(12), fontWeight: '600' },
    emptyDay: {
      fontSize: r.rf(12), fontWeight: '500', paddingVertical: 14, textAlign: 'center',
      borderWidth: 1, borderRadius: 12, borderStyle: 'dashed',
    },
    studentName: { fontSize: r.rf(13.5), fontWeight: '700' },
    badgeRow: { flexDirection: 'row' },

    pickLabel: { fontSize: r.rf(12.5), fontWeight: '600' },
    noLeads: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 16 },
    leadRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12,
      paddingHorizontal: 13, minHeight: MIN_TAP + 8, paddingVertical: 9,
    },
    leadName: { fontSize: r.rf(13.5), fontWeight: '600' },
    leadCity: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  });

export default B2CWeeklyPlanScreen;
