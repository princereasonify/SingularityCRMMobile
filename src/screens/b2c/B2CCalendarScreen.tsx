import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Plus, ChevronLeft, ChevronRight, ShieldCheck, Filter, CalendarDays,
  Users, CalendarClock, PhoneCall, CheckCircle2, Plane,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen, Card } from '../../components/ui';
import { Btn, Field, Trigger, Dropdown, StatusBadge, FormModal } from '../../components/crud';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cObjectionService } from '../../api/b2c/b2cObjectionService';
import { b2cLeaveService } from '../../api/b2c/b2cLeaveService';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha } from '../../theme';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { isoDate, todayStr, timeOnly } from '../../utils/dates';

/**
 * B2CCalendarScreen — mobile mirror of the web B2CCalendar page.
 *
 * The calendar is ONE full-day agenda, not a visit list: counseling sessions, planned
 * visits/appointments, follow-ups the agent promised, what they already did, and the days
 * they are on leave all land in the same map keyed by LOCAL day. A day the user is not
 * working is the single most useful thing a planning calendar can say, and a follow-up due
 * on a day is the thing that actually chases them.
 *
 * Role gating mirrors the web, because the endpoints enforce it:
 *   /objections/queue  → B2CAdmin + Counselor  (403 for Agent)
 *   /activities/mine   → Agent + Counselor     (admins have no team-wide feed)
 *   /leaves/mine       → Agent + Counselor     (an admin files no leave here)
 *
 * Layout: a month grid plus the selected day's agenda. On a phone the agenda sits under the
 * grid; on a wide tablet the two sit side by side, because a 1194pt landscape iPad has the
 * room and a stretched phone layout wastes it.
 */

// ─── Kinds ────────────────────────────────────────────────────────────────────
type Kind = 'session' | 'visit' | 'followup' | 'done' | 'leave';

// The order a day is actually worked: what a promise fixed first, then what you chose to
// plan, then what is chasing you, then what is behind you.
const KIND_ORDER: Kind[] = ['session', 'visit', 'followup', 'done', 'leave'];

/**
 * Colour alone cannot carry this. In the B2C palette the accent (#5aa832) and success
 * (#3f9a2f) are both green, so a session, a visit and a completed activity would be three
 * indistinguishable chips. The mark is what tells them apart in any theme — and it survives
 * the colour-blind case the palette does not.
 */
const KIND_META: Record<Kind, { mark: string; text: string }> = {
  session:  { mark: '◆', text: 'Counseling session' },
  visit:    { mark: '▸', text: 'Visit' },
  followup: { mark: '!',      text: 'Follow-up due' },
  done:     { mark: '✓', text: 'Completed' },
  leave:    { mark: '–', text: 'Leave' },
};

// Session takes `info` rather than the web's accent: on mobile the two would otherwise be
// the same green as a visit, and a tint that repeats is not a tint.
const kindTint = (k: Kind, T: AppTheme) =>
  k === 'session' ? T.info
    : k === 'visit' ? T.accent
      : k === 'followup' ? T.warning
        : k === 'done' ? T.success
          : T.dim;

const KIND_ICON: Record<Kind, React.ComponentType<any>> = {
  session: Users, visit: CalendarClock, followup: PhoneCall, done: CheckCircle2, leave: Plane,
};

interface DayEvent {
  kind: Kind;
  key: string;
  /** The instant, when the item has a clock time. Null for all-day items like leave. */
  at?: string | null;
  title: string;
  leadId?: number | null;
  subtitle?: string;
  tag?: string;
  tagColor?: string;
  assigned?: boolean;
}

// ─── Local date helpers ───────────────────────────────────────────────────────
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Six Monday-first weeks covering `month` — the shape every month grid has. */
const monthGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

/** A stored `yyyy-mm-dd` (with or without a time part) read as the calendar day it names. */
const parseDayLocal = (v: string): Date => {
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

/** Every local day a leave covers, so a three-day leave marks three cells. */
const leaveDays = (from: string, to: string): string[] => {
  const out: string[] = [];
  const cur = parseDayLocal(from);
  const end = parseDayLocal(to);
  // Guard a bad range rather than spinning: a reversed or absurd span is data, not a loop.
  for (let i = 0; cur <= end && i < 400; i++) {
    out.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

/** "CourseContent" → "Course Content". The API speaks enum; the calendar speaks English. */
const words = (v?: string | null) =>
  (v || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();

const longDate = (dateStr: string) => {
  const d = parseDayLocal(dateStr);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const statusTint = (status: string | undefined, T: AppTheme) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.dim : T.accent;

export const B2CCalendarScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const r = useResponsive();

  const role = user?.role;
  const isAdmin = role === 'B2CAdmin';
  const isCounselor = role === 'Counselor'; // booking-driven calendar, no scheduling

  // A chip can carry a name once the cell is wide enough for one; below that it would be an
  // ellipsis, so the cell falls back to per-kind marks and the agenda carries the detail.
  const [gridW, setGridW] = useState(0);
  const cellW = gridW / 7;
  // 72pt is where a truncated name still reads as a name. A landscape iPad's grid pane lands
  // at ~82pt per cell, a portrait one at ~112; a phone at ~52, which is why it gets marks.
  const showChipText = cellW >= 72;
  const cellH = r.isTablet ? (r.isLandscape ? 104 : 120) : 66;
  const maxChips = r.isTablet ? (r.isLandscape ? 3 : 4) : 2;

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string>(todayStr());

  const [visits, setVisits] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [agents, setAgents] = useState<{ agentId: number; agentName: string }[]>([]);
  const [agentFilter, setAgentFilter] = useState('');
  const [openFilter, setOpenFilter] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  // Add-visit modal
  const [addDate, setAddDate] = useState<string | null>(null);
  const [form, setForm] = useState({ leadId: '', agentId: '' });
  const [saving, setSaving] = useState(false);
  const [openFormAgent, setOpenFormAgent] = useState(false);
  const [openFormStudent, setOpenFormStudent] = useState(false);

  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const from = isoDate(cells[0]);
  const to = isoDate(cells[41]);

  // ─── Load every source the day is made of ───────────────────────────────────
  const load = useCallback(async () => {
    const planner = b2cPlannerService
      .get(from, to, isAdmin && agentFilter ? Number(agentFilter) : undefined)
      .then(res => setVisits((res.data as any) ?? []))
      .catch(() => setVisits([]));

    // The caller's own log — the source of BOTH "what I did" and "what I promised to chase".
    const mine = !isAdmin
      ? b2cActivityService.getMyActivities({ page: 1, pageSize: 500, from, to })
        .then(res => setActivities(((res.data as any)?.items ?? res.data ?? []) as any[]))
        .catch(() => setActivities([]))
      : Promise.resolve(setActivities([]));

    const queue = (isAdmin || isCounselor)
      ? b2cObjectionService.getQueue({ status: 'all', page: 1, pageSize: 300 })
        .then(res => setSessions(((res.data as any)?.items ?? res.data ?? []) as any[]))
        .catch(() => setSessions([]))
      : Promise.resolve(setSessions([]));

    const leave = !isAdmin
      ? b2cLeaveService.getMine({ page: 1, pageSize: 200 })
        .then(res => setLeaves(((res.data as any)?.items ?? res.data ?? []) as any[]))
        .catch(() => setLeaves([]))
      : Promise.resolve(setLeaves([]));

    await Promise.all([planner, mine, queue, leave]);
    setLoading(false);
    setRefreshing(false);
  }, [from, to, isAdmin, isCounselor, agentFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    b2cLeadService.getLeads({ page: 1, pageSize: 200 })
      .then(res => setLeads(((res.data as any)?.items ?? []) as any[]))
      .catch(() => setLeads([]));
    if (isAdmin) {
      b2cDashboardService.getAdminDashboard()
        .then(res => setAgents(((res.data as any)?.agentPerformance ?? []) as any[]))
        .catch(() => setAgents([]));
    }
  }, [isAdmin]);

  // ─── One agenda, keyed by local day ─────────────────────────────────────────
  // Every source folded into a single shape, so the grid cell, the agenda and the counts
  // cannot disagree about what is on a day.
  const byDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const put = (day: string, ev: DayEvent) => {
      if (!day) return;
      const list = map.get(day);
      if (list) list.push(ev); else map.set(day, [ev]);
    };

    visits.forEach(v => put(isoDate(v.appointmentAt || v.plannedDate), {
      kind: 'visit',
      key: `v${v.id}`,
      at: v.appointmentAt || null,
      title: v.studentName || `Lead #${v.leadId}`,
      leadId: v.leadId,
      subtitle: [v.city, isAdmin ? v.agentName : null, v.assignedByAdmin ? 'assigned' : null]
        .filter(Boolean).join(' · '),
      tag: words(v.status),
      tagColor: statusTint(v.status, T),
      assigned: !!v.assignedByAdmin,
    }));

    sessions.filter(o => o.scheduledAt).forEach(o => put(isoDate(o.scheduledAt), {
      kind: 'session',
      key: `s${o.id}`,
      at: o.scheduledAt,
      title: o.studentName || `Lead #${o.leadId}`,
      leadId: o.leadId,
      subtitle: [words(o.type), isAdmin ? o.counselorName : null].filter(Boolean).join(' · '),
      tag: words(o.status),
      tagColor: o.status === 'Resolved' ? T.success : o.status === 'LostCause' ? T.danger : T.info,
    }));

    activities.forEach(a => {
      put(isoDate(a.createdAt), {
        kind: 'done',
        key: `a${a.id}`,
        at: a.createdAt,
        title: a.studentName || `Lead #${a.leadId}`,
        leadId: a.leadId,
        subtitle: [words(a.type), a.notes].filter(Boolean).join(' · '),
        tag: words(a.type),
        tagColor: T.success,
      });
      // The follow-up the agent committed to when they logged that activity — the "on this
      // day I have to call them back" the calendar never showed.
      if (a.nextFollowUpDate) put(isoDate(a.nextFollowUpDate), {
        kind: 'followup',
        key: `f${a.id}`,
        at: a.nextFollowUpDate,
        title: a.studentName || `Lead #${a.leadId}`,
        leadId: a.leadId,
        subtitle: `Follow-up from ${words(a.type)} on ${parseDayLocal(isoDate(a.createdAt)).getDate()} ${MON_SHORT[parseDayLocal(isoDate(a.createdAt)).getMonth()]}`,
        tag: 'Follow-up',
        tagColor: T.warning,
      });
    });

    leaves.filter(l => l.status !== 'Rejected').forEach(l => {
      leaveDays(l.fromDate, l.toDate).forEach(day => put(day, {
        kind: 'leave',
        key: `l${l.id}-${day}`,
        at: null,
        title: `${words(l.leaveType)} leave`,
        subtitle: l.reason || `${l.days} day${l.days > 1 ? 's' : ''}`,
        tag: words(l.status),
        tagColor: l.status === 'Approved' ? T.success : T.warning,
      }));
    });

    // Fixed times first within a kind; kinds in working order.
    map.forEach(list => list.sort((a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
      || (a.at ? new Date(a.at).getTime() : 0) - (b.at ? new Date(b.at).getTime() : 0)));
    return map;
  }, [visits, sessions, activities, leaves, isAdmin, T]);

  const dayEvents = useMemo(() => byDay.get(selectedDay) ?? [], [byDay, selectedDay]);

  /** The selected day grouped by kind, in the same working order the chips use. */
  const dayGroups = useMemo(() => {
    const groups = new Map<Kind, DayEvent[]>();
    dayEvents.forEach(e => {
      const list = groups.get(e.kind);
      if (list) list.push(e); else groups.set(e.kind, [e]);
    });
    return [...groups.entries()].sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]));
  }, [dayEvents]);

  const shiftMonth = (n: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
    setCursor(next);
    // Keep the agenda pointing at something inside the month now on screen.
    const first = isoDate(next);
    setSelectedDay(todayStr().slice(0, 7) === first.slice(0, 7) ? todayStr() : first);
  };

  const openAdd = (day: string) => {
    setAddDate(day);
    setForm({ leadId: '', agentId: agentFilter || '' });
    setOpenFormAgent(false);
    setOpenFormStudent(false);
  };

  const addVisit = async () => {
    if (!addDate || !form.leadId) return;
    if (isAdmin && !form.agentId) {
      Alert.alert('Select an agent', 'Please choose an agent for this visit.');
      return;
    }
    setSaving(true);
    try {
      await b2cPlannerService.create({
        leadId: Number(form.leadId),
        plannedDate: addDate,
        agentId: isAdmin ? Number(form.agentId) : undefined,
        sortOrder: (byDay.get(addDate) ?? []).filter(e => e.kind === 'visit').length,
      });
      setAddDate(null);
      toast.success('Visit scheduled');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to schedule visit');
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const agentName = agents.find(a => String(a.agentId) === agentFilter)?.agentName;
  const selectedAgent = agents.find(a => String(a.agentId) === form.agentId)?.agentName;
  const selectedLead = leads.find(l => String(l.id) === form.leadId);
  const agentOptions = [{ label: 'All agents', value: '' }, ...agents.map(a => ({ label: a.agentName, value: String(a.agentId) }))];
  const formAgentOptions = agents.map(a => ({ label: a.agentName, value: String(a.agentId) }));
  const leadOptions = leads.map(l => ({ label: `${l.studentName}${l.city ? ` · ${l.city}` : ''}`, value: String(l.id) }));
  const formValid = !!form.leadId && (!isAdmin || !!form.agentId);

  // Styles are built here, not at module scope: a module-level StyleSheet bakes in the
  // launch-time width, so rotating an iPad would leave every size frozen.
  const s = useMemo(() => makeStyles(r, T, cellH), [r, T, cellH]);

  const onGridLayout = (e: LayoutChangeEvent) => setGridW(e.nativeEvent.layout.width);

  const renderCell = (d: Date, i: number) => {
    const day = isoDate(d);
    const inMonth = d.getMonth() === cursor.getMonth();
    const isToday = day === todayStr();
    const isSelected = day === selectedDay;
    const evs = byDay.get(day) ?? [];
    const assigned = evs.some(e => e.assigned);

    // Phone cells are ~52pt wide — a titled chip there is pure ellipsis. Per-kind marks say
    // WHAT is on the day at a glance and the agenda below says the rest.
    const kinds = KIND_ORDER.filter(k => evs.some(e => e.kind === k));
    const shownKinds = kinds.slice(0, 3);
    const hiddenCount = evs.length - shownKinds.length;

    return (
      <TouchableOpacity
        key={i}
        activeOpacity={0.7}
        onPress={() => setSelectedDay(day)}
        accessibilityLabel={`${longDate(day)}, ${evs.length} item${evs.length === 1 ? '' : 's'}`}
        style={[
          s.cell,
          { borderColor: T.line },
          !inMonth && s.cellOut,
          isSelected && { backgroundColor: withAlpha(T.accent, 0.1), borderColor: T.accent },
        ]}
      >
        <View style={s.cellTop}>
          <View style={[s.dayNumWrap, isToday && { backgroundColor: T.accent }]}>
            <Text style={[s.dayNum, { color: isToday ? T.onAccent : T.text }]}>{d.getDate()}</Text>
          </View>
          {assigned && <ShieldCheck size={11} color={T.info} strokeWidth={2.4} />}
        </View>

        {evs.length > 0 && (showChipText ? (
          <View style={s.chipStack}>
            {evs.slice(0, maxChips).map(e => {
              const tint = kindTint(e.kind, T);
              return (
                <View key={e.key} style={[s.chip, { backgroundColor: withAlpha(tint, 0.16), borderLeftColor: tint }]}>
                  <Text style={[s.chipMark, { color: tint }]}>{KIND_META[e.kind].mark}</Text>
                  <Text style={[s.chipTxt, { color: T.text }]} numberOfLines={1}>
                    {e.at ? `${timeOnly(e.at)} ` : ''}{e.title}
                  </Text>
                </View>
              );
            })}
            {evs.length > maxChips && (
              <Text style={[s.moreTxt, { color: T.dim }]}>+{evs.length - maxChips} more</Text>
            )}
          </View>
        ) : (
          <View style={s.markRow}>
            {shownKinds.map(k => {
              const tint = kindTint(k, T);
              return (
                <View key={k} style={[s.markDot, { backgroundColor: withAlpha(tint, 0.2) }]}>
                  <Text style={[s.markTxt, { color: tint }]}>{KIND_META[k].mark}</Text>
                </View>
              );
            })}
            {hiddenCount > 0 && <Text style={[s.moreTxt, { color: T.dim }]}>+{hiddenCount}</Text>}
          </View>
        ))}
      </TouchableOpacity>
    );
  };

  const agenda = (
    <View style={s.agendaPane}>
      <View style={s.agendaHead}>
        <View style={{ flex: 1 }}>
          <Text style={[s.agendaTitle, { color: T.text }]} numberOfLines={1}>{longDate(selectedDay)}</Text>
          <Text style={[s.agendaSub, { color: T.dim }]}>
            {dayEvents.length === 0 ? 'Nothing on this day' : `${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {!isCounselor && (
          <TouchableOpacity
            onPress={() => openAdd(selectedDay)}
            activeOpacity={0.8}
            accessibilityLabel="Schedule a visit"
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <Plus size={18} color={T.accent} strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>

      {dayGroups.length === 0 ? (
        <Card style={s.agendaEmpty}>
          <CalendarDays size={26} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.agendaEmptyTxt, { color: T.dim }]}>
            {isCounselor ? 'No sessions booked for this day.' : 'Nothing planned. Tap + to schedule a visit.'}
          </Text>
        </Card>
      ) : dayGroups.map(([kind, list]) => {
        const tint = kindTint(kind, T);
        const Icon = KIND_ICON[kind];
        return (
          <View key={kind} style={{ gap: 8 }}>
            <View style={s.groupHead}>
              <Icon size={13} color={tint} strokeWidth={2.2} />
              <Text style={[s.groupTitle, { color: tint }]}>
                {KIND_META[kind].text} ({list.length})
              </Text>
            </View>
            {list.map(e => {
              const row = (
                <>
                  <View style={[s.eventMark, { backgroundColor: withAlpha(tint, 0.18) }]}>
                    <Text style={[s.eventMarkTxt, { color: tint }]}>{KIND_META[kind].mark}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[s.eventTitle, { color: T.text }]} numberOfLines={1}>
                      {e.at ? <Text style={{ color: tint }}>{timeOnly(e.at)}  </Text> : null}
                      {e.title}
                    </Text>
                    {!!e.subtitle && (
                      <Text style={[s.eventSub, { color: T.dim }]} numberOfLines={2}>{e.subtitle}</Text>
                    )}
                  </View>
                  {!!e.tag && <StatusBadge label={e.tag} color={e.tagColor} />}
                </>
              );
              return e.leadId ? (
                <TouchableOpacity
                  key={e.key}
                  activeOpacity={0.8}
                  onPress={() => nav.navigate('B2CLeadDetail', { leadId: e.leadId })}
                  style={[s.eventRow, { backgroundColor: T.card, borderColor: T.line }]}
                >
                  {row}
                </TouchableOpacity>
              ) : (
                <View key={e.key} style={[s.eventRow, { backgroundColor: T.card, borderColor: T.line }]}>
                  {row}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      contentStyle={r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } : undefined}
    >
      <Text style={[s.title, { color: T.text }]}>Calendar</Text>
      <Text style={[s.subtitle, { color: T.sub }]}>
        {isAdmin
          ? 'Visits, counseling sessions and leave across the team'
          : 'Everything on your day — visits, sessions, follow-ups and what you have already done'}
      </Text>

      {/* Month navigation + admin agent filter */}
      <Card style={{ marginTop: r.gap, gap: 10, zIndex: 20 }}>
        <View style={s.navRow}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            activeOpacity={0.8}
            accessibilityLabel="Previous month"
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <ChevronLeft size={20} color={T.accent} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[s.monthLabel, { color: T.text }]} numberOfLines={1}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            activeOpacity={0.8}
            accessibilityLabel="Next month"
            style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
          >
            <ChevronRight size={20} color={T.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

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

      {/* A colour on a chip is only information if its meaning is on the same screen. */}
      <View style={s.legend}>
        {KIND_ORDER.map(k => {
          const tint = kindTint(k, T);
          return (
            <View key={k} style={s.legendItem}>
              <View style={[s.markDot, { backgroundColor: withAlpha(tint, 0.2) }]}>
                <Text style={[s.markTxt, { color: tint }]}>{KIND_META[k].mark}</Text>
              </View>
              <Text style={[s.legendTxt, { color: T.sub }]}>{KIND_META[k].text}</Text>
            </View>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <View style={s.panes}>
          <View style={s.gridPane}>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              <View style={[s.weekHead, { borderBottomColor: T.line }]}>
                {DAY_NAMES.map(d => (
                  <Text key={d} style={[s.weekHeadTxt, { color: T.sub }]}>{d}</Text>
                ))}
              </View>
              <View style={s.grid} onLayout={onGridLayout}>
                {cells.map(renderCell)}
              </View>
            </Card>
          </View>
          {agenda}
        </View>
      )}

      {/* Schedule-visit modal */}
      <FormModal
        visible={!!addDate}
        title="Schedule a visit"
        onClose={() => setAddDate(null)}
        wide={r.isTablet}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setAddDate(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Schedule'} onPress={addVisit} loading={saving} disabled={!formValid || saving} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="Date">
            <View style={[s.readonly, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
              <CalendarDays size={15} color={T.sub} strokeWidth={ICON_STROKE} />
              <Text style={[s.readonlyTxt, { color: T.text }]} numberOfLines={1}>
                {addDate ? longDate(addDate) : ''}
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

const makeStyles = (r: ReturnType<typeof useResponsive>, T: AppTheme, cellH: number) =>
  StyleSheet.create({
    title: { fontSize: r.rf(22), fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginTop: 3, lineHeight: r.rf(18) },

    navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    monthLabel: { flex: 1, textAlign: 'center', fontSize: r.rf(15), fontWeight: '800', letterSpacing: -0.3 },
    /** Every touchable is at least the HIG minimum in both dimensions. */
    tapBtn: {
      width: MIN_TAP, height: MIN_TAP, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },

    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendTxt: { fontSize: r.rf(10.5), fontWeight: '600' },

    panes: {
      flexDirection: r.isWide ? 'row' : 'column',
      alignItems: 'flex-start',
      gap: r.gap + 4,
      marginTop: 14,
    },
    gridPane: { flex: r.isWide ? 1.25 : undefined, width: r.isWide ? undefined : '100%' },
    agendaPane: { flex: r.isWide ? 1 : undefined, width: r.isWide ? undefined : '100%', gap: 12, marginTop: r.isWide ? 0 : 18 },

    weekHead: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 7 },
    weekHeadTxt: { width: '14.2857%', textAlign: 'center', fontSize: r.rf(10.5), fontWeight: '800' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: '14.2857%',
      height: cellH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 2,
      paddingTop: 3,
    },
    cellOut: { opacity: 0.38 },
    cellTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
    dayNumWrap: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    dayNum: { fontSize: r.rf(11), fontWeight: '800' },

    chipStack: { marginTop: 2, gap: 2 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      borderRadius: 4, borderLeftWidth: 2, paddingHorizontal: 3, paddingVertical: 1,
    },
    chipMark: { fontSize: r.rf(9), fontWeight: '800' },
    chipTxt: { flex: 1, fontSize: r.rf(9), fontWeight: '600' },
    moreTxt: { fontSize: r.rf(8.5), fontWeight: '700', paddingLeft: 2 },

    markRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3, flexWrap: 'nowrap' },
    markDot: { width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    markTxt: { fontSize: 9, fontWeight: '900', lineHeight: 11 },

    agendaHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    agendaTitle: { fontSize: r.rf(15), fontWeight: '800', letterSpacing: -0.3 },
    agendaSub: { fontSize: r.rf(11.5), fontWeight: '600', marginTop: 2 },
    agendaEmpty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
    agendaEmptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: r.rf(18) },

    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    groupTitle: { fontSize: r.rf(10.5), fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

    eventRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12, paddingVertical: 11, minHeight: MIN_TAP + 8,
    },
    eventMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    eventMarkTxt: { fontSize: r.rf(13), fontWeight: '900' },
    eventTitle: { fontSize: r.rf(13.5), fontWeight: '700' },
    eventSub: { fontSize: r.rf(11.5), fontWeight: '500', lineHeight: r.rf(16) },

    readonly: {
      minHeight: MIN_TAP + 2, borderRadius: 13, borderWidth: 1.5,
      flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14,
    },
    readonlyTxt: { flex: 1, fontSize: r.rf(13), fontWeight: '500' },
  });

export default B2CCalendarScreen;
