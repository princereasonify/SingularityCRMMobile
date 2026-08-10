import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Plus, ChevronLeft, ChevronRight, ShieldCheck, Filter, CalendarDays } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen, Card, SectionLabel } from '../../components/ui';
import {
  Btn, IconBtn, Field, Trigger, Dropdown, StatusBadge, ListCard, Avatar, FormModal,
} from '../../components/crud';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * B2CCalendarScreen — mobile mirror of the web B2CCalendar page. The web shows a full
 * month grid; on phone/tablet we adapt to a week-by-week day list (planned visits grouped
 * under each day), which reads far better than a 42-cell grid on a narrow screen.
 *
 * Role-gating matches the web: B2CAdmin can filter by agent and must pick an agent when
 * scheduling; Counselors get a read-only view (booking-driven, no scheduling); Agents see
 * and schedule their own planned & admin-assigned visits.
 */

const pad = (n: number) => String(n).padStart(2, '0');
/** Local-component YYYY-MM-DD (avoids the UTC day-shift that toISOString() causes in +05:30). */
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A visit's day, taken straight from the string so no timezone maths can move it. */
const visitDay = (v: any) => String(v.plannedDate ?? '').split('T')[0];

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
  return x;
};

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const statusColor = (status: string, T: any) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.dim : T.accent;

export const B2CCalendarScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const role = user?.role;
  const isAdmin = role === 'B2CAdmin';
  const isCounselor = role === 'Counselor'; // read-only, booking-driven calendar

  const [cursor, setCursor] = useState(() => new Date());
  const [visits, setVisits] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);   // completed activities ("done")
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [agents, setAgents] = useState<{ agentId: number; agentName: string }[]>([]);
  const [agentFilter, setAgentFilter] = useState(''); // agentId as string, '' = all
  const [openFilter, setOpenFilter] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  // Add-visit modal
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [form, setForm] = useState({ leadId: '', agentId: '' });
  const [saving, setSaving] = useState(false);
  const [openFormAgent, setOpenFormAgent] = useState(false);
  const [openFormStudent, setOpenFormStudent] = useState(false);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = iso(days[0]);
  const to = iso(days[6]);

  const fetchVisits = useCallback(async () => {
    try {
      const res = await b2cPlannerService.get(from, to, isAdmin && agentFilter ? Number(agentFilter) : undefined);
      setVisits(res.data ?? []);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Overlay completed activities ("what was done"). getMyActivities is Agent/Counselor-only;
    // admins have no team-wide activity feed, so this populates for agents/counselors.
    if (!isAdmin) {
      try {
        const ar = await b2cActivityService.getMyActivities({ page: 1, pageSize: 500, from, to } as any);
        setActivities((ar.data as any)?.items ?? []);
      } catch { setActivities([]); }
    } else {
      setActivities([]);
    }
  }, [from, to, isAdmin, agentFilter]);

  useEffect(() => { setLoading(true); fetchVisits(); }, [fetchVisits]);

  useEffect(() => {
    b2cLeadService.getLeads({ page: 1, pageSize: 200 })
      .then(r => setLeads((r.data as any)?.items ?? []))
      .catch(() => setLeads([]));
    if (isAdmin) {
      b2cDashboardService.getAdminDashboard()
        .then(r => setAgents((r.data as any)?.agentPerformance ?? []))
        .catch(() => setAgents([]));
    }
  }, [isAdmin]);

  const shiftWeek = (n: number) => setCursor(c => addDays(startOfWeek(c), n * 7));
  const visitsOn = (d: Date) => visits.filter(v => visitDay(v) === iso(d));
  const activitiesOn = (d: Date) => activities.filter(a => a.createdAt && iso(new Date(a.createdAt)) === iso(d));

  const openAdd = (d: Date) => {
    setAddDate(d);
    setForm({ leadId: '', agentId: agentFilter || '' });
    setOpenFormAgent(false);
    setOpenFormStudent(false);
  };

  const addVisit = async () => {
    if (!addDate || !form.leadId) return;
    if (isAdmin && !form.agentId) { Alert.alert('Select an agent', 'Please choose an agent for this visit.'); return; }
    setSaving(true);
    try {
      await b2cPlannerService.create({
        leadId: Number(form.leadId),
        plannedDate: iso(addDate),
        agentId: isAdmin ? Number(form.agentId) : undefined,
        sortOrder: visitsOn(addDate).length,
      });
      setAddDate(null);
      toast.success('Visit planned');
      fetchVisits();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to schedule visit');
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const totalThisWeek = visits.length;

  const agentName = agents.find(a => String(a.agentId) === agentFilter)?.agentName;
  const selectedAgent = agents.find(a => String(a.agentId) === form.agentId)?.agentName;
  const selectedLead = leads.find(l => String(l.id) === form.leadId);

  const agentOptions = [{ label: 'All agents', value: '' }, ...agents.map(a => ({ label: a.agentName, value: String(a.agentId) }))];
  const formAgentOptions = agents.map(a => ({ label: a.agentName, value: String(a.agentId) }));
  const leadOptions = leads.map(l => ({ label: `${l.studentName}${l.city ? ` · ${l.city}` : ''}`, value: String(l.id) }));

  const formValid = !!form.leadId && (!isAdmin || !!form.agentId);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVisits(); }}>
      <Text style={[st.title, { color: T.text }]}>Calendar</Text>
      <Text style={[st.subtitle, { color: T.sub }]}>
        {isCounselor ? 'Your booked visits' : isAdmin ? 'Planned & assigned visits across the team' : 'Your planned & admin-assigned visits'}
      </Text>

      {/* Week navigation + admin agent filter */}
      <Card style={{ marginTop: 16, gap: 10 }}>
        <View style={st.navRow}>
          <IconBtn kind="view" onPress={() => shiftWeek(-1)} label="Previous week">
            <ChevronLeft size={18} color={T.accent} strokeWidth={2.2} />
          </IconBtn>
          <Text style={[st.weekLabel, { color: T.text }]} numberOfLines={1}>{weekLabel}</Text>
          <IconBtn kind="view" onPress={() => shiftWeek(1)} label="Next week">
            <ChevronRight size={18} color={T.accent} strokeWidth={2.2} />
          </IconBtn>
        </View>
        <Text style={[st.count, { color: T.dim }]}>{totalThisWeek} visit{totalThisWeek === 1 ? '' : 's'} this week</Text>

        {isAdmin && (
          <>
            <Trigger
              label={agentName || 'All agents'}
              open={openFilter}
              onPress={() => setOpenFilter(v => !v)}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
            {openFilter && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={260}
                value={agentFilter}
                onSelect={v => { setAgentFilter(v); setOpenFilter(false); }}
                options={agentOptions}
              />
            )}
          </>
        )}
      </Card>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <View style={{ gap: 18, marginTop: 18 }}>
          {days.map(day => {
            const dv = visitsOn(day);
            const da = activitiesOn(day);
            const today = iso(day) === iso(new Date());
            return (
              <View key={iso(day)} style={{ gap: 8 }}>
                <View style={st.dayHead}>
                  <View style={[st.dayBadge, { backgroundColor: today ? T.accent : T.cardAlt, borderColor: today ? T.accent : T.line }]}>
                    <Text style={[st.dayNum, { color: today ? '#FFF' : T.text }]}>{day.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.dayName, { color: T.text }]}>
                      {day.toLocaleDateString('en-IN', { weekday: 'long' })}{today ? ' · Today' : ''}
                    </Text>
                    <Text style={[st.daySub, { color: T.dim }]}>
                      {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {da.length > 0 ? ` · ${da.length} done` : ''} · {dv.length} planned
                    </Text>
                  </View>
                  {!isCounselor && (
                    <IconBtn kind="view" onPress={() => openAdd(day)} label="Schedule visit">
                      <Plus size={16} color={T.accent} strokeWidth={2.4} />
                    </IconBtn>
                  )}
                </View>

                {/* Done — completed activities */}
                {da.map(a => (
                  <ListCard key={`a${a.id}`} onPress={() => nav.navigate('B2CLeadDetail', { leadId: a.leadId })} style={{ alignItems: 'flex-start' }}>
                    <Avatar initials={initialsOf(a.studentName)} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={st.rowTop}>
                        <Text style={[st.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{a.studentName}</Text>
                        <StatusBadge label={`✓ ${a.type}`} color={T.success} />
                      </View>
                      {!!a.notes && <Text style={[st.sub, { color: T.dim }]} numberOfLines={1}>{a.notes}</Text>}
                    </View>
                  </ListCard>
                ))}

                {dv.length === 0 && da.length === 0 ? (
                  <Text style={[st.emptyDay, { color: T.dim }]}>Nothing on this day</Text>
                ) : (
                  dv.map(v => (
                    <ListCard key={v.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: v.leadId })} style={{ alignItems: 'flex-start' }}>
                      <Avatar initials={initialsOf(v.studentName)} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={st.rowTop}>
                          <Text style={[st.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{v.studentName}</Text>
                          {v.assignedByAdmin && <ShieldCheck size={13} color={T.info} strokeWidth={2.2} />}
                          <StatusBadge label={v.status} color={statusColor(v.status, T)} />
                        </View>
                        <Text style={[st.sub, { color: T.dim }]} numberOfLines={1}>
                          {v.city || '—'}
                          {isAdmin && v.agentName ? ` · ${v.agentName}` : ''}
                          {v.assignedByAdmin ? ' · assigned' : ''}
                        </Text>
                      </View>
                    </ListCard>
                  ))
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Schedule-visit modal */}
      <FormModal
        visible={!!addDate}
        title="Schedule a visit"
        onClose={() => setAddDate(null)}
        wide={width >= 720}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setAddDate(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Schedule'} onPress={addVisit} loading={saving} disabled={!formValid || saving} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="Date">
            <View style={[st.readonly, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
              <CalendarDays size={15} color={T.sub} strokeWidth={ICON_STROKE} />
              <Text style={[st.readonlyTxt, { color: T.text }]}>
                {addDate ? addDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </Text>
            </View>
          </Field>

          {isAdmin && (
            <Field label="Agent *">
              <Trigger
                label={selectedAgent || 'Select an agent'}
                open={openFormAgent}
                onPress={() => { setOpenFormAgent(v => !v); setOpenFormStudent(false); }}
              />
              {openFormAgent && (
                <Dropdown
                  style={{ width: '100%' }}
                  maxHeight={220}
                  value={form.agentId}
                  onSelect={v => { setForm(f => ({ ...f, agentId: v })); setOpenFormAgent(false); }}
                  options={formAgentOptions}
                />
              )}
            </Field>
          )}

          <Field label="Student *">
            <Trigger
              label={selectedLead ? `${selectedLead.studentName}${selectedLead.city ? ` · ${selectedLead.city}` : ''}` : 'Select a student'}
              open={openFormStudent}
              onPress={() => { setOpenFormStudent(v => !v); setOpenFormAgent(false); }}
            />
            {openFormStudent && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={240}
                value={form.leadId}
                onSelect={v => { setForm(f => ({ ...f, leadId: v })); setOpenFormStudent(false); }}
                options={leadOptions}
              />
            )}
          </Field>
        </View>
      </FormModal>
    </Screen>
  );
};

const st = StyleSheet.create({
  title: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 3 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: rf(14.5), fontWeight: '700', letterSpacing: -0.3 },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: rf(16), fontWeight: '800' },
  dayName: { fontSize: rf(13.5), fontWeight: '700' },
  daySub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  emptyDay: { fontSize: rf(12), fontWeight: '500', paddingLeft: 54, paddingVertical: 2 },

  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },

  readonly: { height: 46, borderRadius: 13, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 },
  readonlyTxt: { flex: 1, fontSize: rf(13.5), fontWeight: '500' },
});

export default B2CCalendarScreen;
