import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, ChevronLeft, ChevronRight, Check, CalendarDays, WifiOff, TriangleAlert,
} from 'lucide-react-native';

import { calendarApi } from '../../api/calendar';
import { weeklyPlanApi } from '../../api/weeklyPlan';
import { CalendarEvent } from '../../types';
import { useOffline } from '../../context/OfflineContext';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import { GradientBackground } from '../../components/common/GradientBackground';
import {
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge, ListCard, FormModal, Pagination,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Types offered by the create form — the `CalendarEventType` C# enum VERBATIM
 * (SalesCRM.Core/Enums/CalendarEventType.cs: Meeting, Demo, FollowUp, Visit,
 * Onboarding, Other).
 *
 * Web's <select> also offers `Call`, but `Call` is not in that enum, and
 * CalendarService.CreateEventAsync does `Enum.TryParse<CalendarEventType>(request.EventType,
 * true, out var eventType)` — on failure `eventType` stays default(enum) = Meeting. So on
 * web, picking "Call" silently saves a Meeting. That web bug is not reproduced here.
 */
const CREATE_TYPES = ['Meeting', 'Demo', 'FollowUp', 'Visit', 'Onboarding', 'Other'] as const;
type CreateType = typeof CREATE_TYPES[number];

/**
 * Legend / colour keys — web parity (Calendar.jsx `typeColors`, same order, incl. `Call`).
 * `Call` earns its colour because approved weekly-plan activities are merged into the grid
 * as pseudo-events and `Call` is a valid WeeklyActivity type. It can be displayed, never created.
 */
const LEGEND_TYPES = ['Meeting', 'Demo', 'FollowUp', 'Visit', 'Onboarding', 'Call', 'Other'] as const;

/**
 * House page size for the selected-day agenda, which is paged CLIENT-SIDE.
 *
 * CalendarController exposes exactly one read route:
 *   [HttpGet] … GetEvents([FromQuery] string from, [FromQuery] string to)
 * `from` and `to` are the ONLY bound query parameters — there is no `page`, `limit` or
 * `pageSize` binding, and the response is `ApiResponse<List<CalendarEventDto>>` (a bare
 * list, not a PaginatedResult). The whole month therefore arrives in one payload, and the
 * agenda's approved weekly-plan pseudo-events are synthesised on the client anyway, so
 * server-side paging is not available to us here.
 *
 * The month grid itself is NOT paged: it is a calendar, not a record list.
 */
const PAGE_SIZE = 10;

const DASH = '—';

/**
 * Event-type colours resolved from the theme so light and dark both stay on-palette.
 * Web maps Call and Other to one and the same gray — mirrored here with the `sub` token.
 * Tint through withAlpha(): `sub` is an rgba() token and would break `c + '26'`.
 */
const typeColors = (T: AppTheme): Record<string, string> => ({
  Meeting: T.success,
  Demo: T.info,
  FollowUp: T.warning,
  Visit: T.accent,
  Onboarding: T.danger,
  Call: T.sub,
  Other: T.sub,
});

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Accepts H:MM / HH:MM and returns a zero-padded HH:MM, or null when unparseable. */
const normTime = (v: string): string | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${pad2(h)}:${pad2(mi)}`;
};

/**
 * Render the stored time as-is instead of converting it.
 *
 * CalendarService writes `DateTime.SpecifyKind(request.StartTime, DateTimeKind.Utc)` — it
 * RE-LABELS the wall clock we sent as UTC rather than converting it, so the stored value IS
 * the intended wall clock. `new Date(iso).toLocaleTimeString()` would then shift it by the
 * device offset (type 09:00, read back "2:30 PM" in IST). Read the ISO's own HH:MM instead.
 * This also keeps real events consistent with merged plan events (`${date}T09:00`).
 */
const formatTime = (iso?: string) => {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Full "date + time" label for the event-details modal (web parity: Calendar.jsx
 * renders `new Date(startTime).toLocaleString('en-IN')` for both Start and End).
 *
 * Built from the ISO string's OWN Y-M-D and H:M for the same reason formatTime is —
 * the server re-labels the wall clock as UTC rather than converting it, so handing the
 * string to `new Date()` and formatting it would shift every event by the device offset.
 * Only the date half goes through Date(), and it is constructed from the parsed parts
 * as a LOCAL date so no offset can move it across midnight.
 */
const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const datePart = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return m[4] ? `${datePart}, ${formatTime(iso)}` : datePart;
};

const isPlanEvent = (ev: CalendarEvent) => !!(ev as any).isWeeklyPlan;

export const CalendarScreen = (_: any) => {
  const T = useAppTheme();
  const TYPE_COLORS = useMemo(() => typeColors(T), [T]);
  const { isOnline } = useOffline();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the real agenda table — never a card stack. Phones get list rows. */
  const table = isTabletDevice;

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [agendaPage, setAgendaPage] = useState(1);

  /**
   * The grid's width is MEASURED, never derived from useWindowDimensions(): the permanent
   * iPad sidebar (240 / 76 rail) and the day panel beside the grid mean the window is not
   * the grid's content box. Same fix as PipelineScreen's onCanvasLayout.
   */
  const [gridW, setGridW] = useState(0);
  const onGridLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width;
    setGridW(prev => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  // 7 cells always fit: floor() can only ever leave a sub-pixel remainder, never overflow.
  const cellW = gridW > 0 ? Math.floor(gridW / 7) : 0;
  // Cells FLEX — this is only a floor. Rows stretch to their tallest cell (alignItems:'stretch').
  const cellMinH = Math.round(Math.max(46, Math.min(cellW * 1.05, 92)));

  // Event-details modal — opened by tapping a pill in the month grid (web parity:
  // Calendar.jsx's pills are <button onClick={() => setSelectedEvent(ev)}>).
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CreateType>('Meeting');
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // ── Calendar math ──────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const gridCells: (number | null)[] = useMemo(() => {
    const cells: (number | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayOfWeek, daysInMonth]);

  // ── Fetch events for this month + merge approved weekly-plan activities (web parity) ──
  const loadEvents = useCallback(async (silent = false) => {
    // Web parity: fetchEvents() shows the loading state on every month change.
    if (!silent) setLoading(true);
    const from = toDateStr(year, month, 1);
    const to = toDateStr(year, month, daysInMonth);
    try {
      // GET /api/calendar?from=&to= → ApiResponse<List<CalendarEventDto>>; apiClient
      // unwraps the envelope, so res.data is the bare array. (CalendarController.GetEvents)
      const res = await calendarApi.getEvents(from, to);
      const calEvents: CalendarEvent[] = (res.data as any) ?? [];

      const planEvents: CalendarEvent[] = [];
      try {
        for (let w = -1; w < 5; w++) {
          const ws = new Date(year, month, 1 + w * 7);
          const dow = ws.getDay();
          const monday = new Date(ws);
          monday.setDate(monday.getDate() - ((dow + 6) % 7));
          const weekStart = toDateStr(monday.getFullYear(), monday.getMonth(), monday.getDate());
          const planRes = await weeklyPlanApi.getMy(weekStart);
          const p: any = planRes.data;
          if (p && (p.status === 'Approved' || p.status === 'EditedByManager')) {
            let days: any[] = [];
            try {
              const raw = p.managerEdits || p.planData;
              days = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
            } catch {}
            days.forEach((day: any) => {
              (day.activities || []).forEach((act: any) => {
                planEvents.push({
                  id: `wp-${p.id}-${day.date}-${act.type}`,
                  title: `${act.type}: ${act.schoolName || act.notes || ''}`,
                  eventType: act.type,
                  startTime: `${day.date}T09:00`,
                  endTime: `${day.date}T10:00`,
                  isCompleted: false,
                  isWeeklyPlan: true,
                } as any);
              });
            });
          }
        }
      } catch {}

      setEvents([...calEvents, ...planEvents]);
      setError(null);
    } catch {
      setEvents([]);
      setError('We could not load your calendar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month, daysInMonth]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Landing on a new month selects today when it's the current month, else day 1.
  useEffect(() => {
    const current = year === today.getFullYear() && month === today.getMonth();
    setSelectedDay(current ? today.getDate() : 1);
  }, [year, month, today]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  /**
   * Bucket once by the ISO string's own YYYY-MM-DD prefix rather than re-filtering all
   * events for each of the 42 cells. Identical to web's `startTime.startsWith(dateStr)`,
   * because toDateStr() is exactly the 10-char prefix of an ISO timestamp.
   */
  const byDay = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      const k = e.startTime?.slice(0, 10);
      if (!k) return;
      if (!m[k]) m[k] = [];
      m[k].push(e);
    });
    return m;
  }, [events]);

  const eventsForDay = useCallback(
    (day: number | null) => (day ? byDay[toDateStr(year, month, day)] ?? [] : []),
    [byDay, year, month],
  );

  const selectedDateStr = toDateStr(year, month, selectedDay);
  const selectedEvents = byDay[selectedDateStr] ?? [];

  // Client-side agenda paging (see PAGE_SIZE). Picking another day — or a refetch that
  // rewrites `events` — resets to page 1, so a page-2 view can never render empty.
  useEffect(() => { setAgendaPage(1); }, [selectedDateStr, events]);

  const agendaPageCount = Math.max(1, Math.ceil(selectedEvents.length / PAGE_SIZE));
  const pagedEvents = selectedEvents.slice((agendaPage - 1) * PAGE_SIZE, agendaPage * PAGE_SIZE);
  const agendaFrom = selectedEvents.length === 0 ? 0 : (agendaPage - 1) * PAGE_SIZE + 1;
  const agendaTo = Math.min(agendaPage * PAGE_SIZE, selectedEvents.length);

  const isToday = (day: number | null) =>
    !!day && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // ── Create ─────────────────────────────────────────────────────────────────
  const openModal = () => {
    setNewTitle(''); setNewType('Meeting'); setNewDate(selectedDateStr);
    setNewStart(''); setNewEnd(''); setNewDesc('');
    setTypeOpen(false); setSaveErr(null); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setTypeOpen(false); };

  const startOk = normTime(newStart);
  const canSave = !!newTitle.trim() && !!newDate && !!startOk;

  const handleCreate = async () => {
    const st = normTime(newStart);
    if (!newTitle.trim() || !newDate || !st) return;
    const en = newEnd.trim() ? normTime(newEnd) : st; // web: endTime || startTime
    if (!en) { setSaveErr('End time must look like HH:MM.'); return; }
    setSaving(true); setSaveErr(null);
    try {
      // POST /api/calendar → CreateCalendarEventRequest { EventType, Title, Description,
      // StartTime, EndTime, ... } (CalendarController.CreateEvent).
      await calendarApi.create({
        eventType: newType,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        startTime: `${newDate}T${st}:00`,
        endTime: `${newDate}T${en}:00`,
      });
      closeModal();
      flash('Event created');
      loadEvents();
    } catch (e: any) {
      setSaveErr(e?.response?.data?.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * BUG FIX — endpoint verified against the controller.
   * `calendarApi.markComplete()` PATCHes `/calendar/{id}/complete`, a route
   * CalendarController does not declare (it exposes only GET /, POST /, PUT /{id},
   * DELETE /{id}). Every "mark done" 404'd straight into an empty catch and silently
   * did nothing. PUT /{id} binds UpdateCalendarEventRequest, which HAS `IsCompleted`.
   * (api/calendar.ts is outside this task's file scope — reported to the lead.)
   */
  const handleMarkComplete = async (ev: CalendarEvent) => {
    if (isPlanEvent(ev)) return; // plan pseudo-events have no calendar row to update
    try {
      await calendarApi.update(ev.id, { isCompleted: true } as any);
      flash('Marked complete');
      loadEvents();
    } catch {
      setError('Could not update that event.');
    }
  };

  // ── Banners ────────────────────────────────────────────────────────────────
  const banner = (
    tone: string, icon: React.ReactNode, text: string, key: string,
  ) => (
    <View key={key} style={[s.banner, { backgroundColor: withAlpha(tone, SOFT_TINT), borderColor: withAlpha(tone, 0.3) }]}>
      {icon}
      <Text style={[s.bannerTxt, { color: tone }]}>{text}</Text>
    </View>
  );

  // ── Month grid ─────────────────────────────────────────────────────────────
  const renderGrid = () => (
    <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={s.monthNav}>
        <IconBtn kind="view" label="Previous month" onPress={prevMonth}>
          <ChevronLeft size={15} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <Text style={[s.monthTitle, { color: T.text }]}>{MONTH_NAMES[month]} {year}</Text>
        <IconBtn kind="view" label="Next month" onPress={nextMonth}>
          <ChevronRight size={15} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
      </View>

      <View onLayout={onGridLayout}>
        {cellW > 0 && (
          <View>
            <View style={s.dayHeaderRow}>
              {DAY_HEADERS.map(d => (
                // alignItems does nothing to <Text> content — center with textAlign.
                <Text key={d} style={[s.dayHeader, { width: cellW, color: T.dim }]}>{d}</Text>
              ))}
            </View>

            <View style={s.grid}>
              {gridCells.map((day, idx) => {
                const dayEvs = eventsForDay(day);
                const todayCell = isToday(day);
                const selected = day != null && day === selectedDay;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.cell, { width: cellW }]}
                    onPress={() => day && setSelectedDay(day)}
                    activeOpacity={0.7}
                    disabled={!day}
                    accessibilityLabel={day ? `${day} ${MONTH_NAMES[month]}` : undefined}
                  >
                    <View
                      style={[
                        s.cellInner,
                        { minHeight: cellMinH, borderColor: T.line, backgroundColor: T.card },
                        !day && { backgroundColor: T.cardAlt, borderColor: 'transparent' },
                        todayCell && { borderColor: T.accent, borderWidth: 1.5 },
                        selected && !todayCell && { borderColor: withAlpha(T.accent, 0.4) },
                      ]}
                    >
                      {day != null && (
                        <View style={{ flex: 1 }}>
                          {/* CRUD spec date picker: "selected day = gradient" */}
                          <View style={s.dayNum}>
                            {selected && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
                            <Text
                              style={[
                                s.dayNumTxt,
                                { color: selected ? '#FFF' : todayCell ? T.accent : T.sub },
                              ]}
                            >
                              {day}
                            </Text>
                          </View>

                          {dayEvs.slice(0, 3).map(ev => {
                            const c = TYPE_COLORS[ev.eventType] || TYPE_COLORS.Other;
                            return (
                              <TouchableOpacity
                                key={String(ev.id)}
                                // Tapping a pill selects its day AND opens the details
                                // modal, so the day panel below stays in sync with it.
                                onPress={() => { if (day) setSelectedDay(day); setSelectedEvent(ev); }}
                                activeOpacity={0.7}
                                accessibilityLabel={`${ev.title} — event details`}
                                style={[
                                  s.pill,
                                  { backgroundColor: withAlpha(c, SOFT_TINT) },
                                  // web parity: weekly-plan events carry a left rule
                                  isPlanEvent(ev) && { borderLeftWidth: 2, borderLeftColor: c },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.pillTxt,
                                    { color: c },
                                    ev.isCompleted && { textDecorationLine: 'line-through' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {ev.isCompleted ? '✓ ' : ''}{ev.title}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          {dayEvs.length > 3 && (
                            <Text style={[s.more, { color: T.dim }]} numberOfLines={1}>
                              +{dayEvs.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={[s.legend, { borderTopColor: T.line }]}>
        {LEGEND_TYPES.map(t => (
          <View key={t} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: TYPE_COLORS[t] }]} />
            <Text style={[s.legendTxt, { color: T.sub }]}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Selected-day agenda ────────────────────────────────────────────────────
  /** Shared completion control so the table cell and the phone row cannot drift. */
  const doneCtl = (ev: CalendarEvent) =>
    ev.isCompleted ? (
      <View style={[s.done, { backgroundColor: T.success }]}>
        <Check size={14} color="#FFF" strokeWidth={3} />
      </View>
    ) : (
      <TouchableOpacity
        accessibilityLabel="Mark complete"
        style={[s.todo, { borderColor: T.lineStrong }]}
        onPress={() => handleMarkComplete(ev)}
      >
        <Check size={14} color={T.dim} strokeWidth={3} />
      </TouchableOpacity>
    );

  /** iPad: a real table. Header and body share the c* column constants verbatim. */
  const renderAgendaTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cTime]}>Time</Text>
        <Text style={[s.th, { color: T.dim }, s.cEvent]}>Event</Text>
        <Text style={[s.th, { color: T.dim }, s.cType]}>Type</Text>
        <Text style={[s.th, { color: T.dim }, s.cDone]}>Done</Text>
      </View>

      {pagedEvents.map(ev => {
        const c = TYPE_COLORS[ev.eventType] || TYPE_COLORS.Other;
        const plan = isPlanEvent(ev);
        const sub = [ev.schoolName, ev.description].filter(Boolean).join(' • ');
        return (
          <TouchableOpacity
            key={String(ev.id)}
            activeOpacity={0.75}
            onPress={() => setSelectedEvent(ev)}
            style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
          >
            <Text style={[s.td, { color: T.sub }, s.cTime]} numberOfLines={1}>
              {formatTime(ev.startTime) || DASH}
            </Text>
            <View style={s.cEvent}>
              <Text
                style={[
                  s.tdName,
                  { color: T.text },
                  ev.isCompleted && { color: T.dim, textDecorationLine: 'line-through' },
                ]}
                numberOfLines={1}
              >
                {ev.title}
              </Text>
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                {sub || (plan ? 'Weekly plan activity' : DASH)}
              </Text>
            </View>
            <View style={s.cType}>
              <StatusBadge label={ev.eventType} color={c} />
            </View>
            {/* Plan pseudo-events have no calendar row to update — no control at all. */}
            <View style={s.cDone}>{plan ? null : doneCtl(ev)}</View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /** Phone: ListCard rows from the kit — a list, never a card grid. */
  const renderAgendaRows = () => (
    <View style={{ gap: 8 }}>
      {pagedEvents.map(ev => {
        const c = TYPE_COLORS[ev.eventType] || TYPE_COLORS.Other;
        const plan = isPlanEvent(ev);
        return (
          <ListCard key={String(ev.id)} style={s.evCard} onPress={() => setSelectedEvent(ev)}>
            <View style={[s.evBar, { backgroundColor: c }]} />
            <View style={s.flexMin}>
              <Text
                style={[
                  s.evTitle,
                  { color: T.text },
                  ev.isCompleted && { color: T.dim, textDecorationLine: 'line-through' },
                ]}
                numberOfLines={2}
              >
                {ev.title}
              </Text>
              <Text style={[s.evTime, { color: T.sub }]} numberOfLines={1}>
                {formatTime(ev.startTime)} – {formatTime(ev.endTime)}
              </Text>
              {!!ev.schoolName && (
                <Text style={[s.evMeta, { color: T.dim }]} numberOfLines={1}>{ev.schoolName}</Text>
              )}
              {!!ev.description && (
                <Text style={[s.evMeta, { color: T.sub }]} numberOfLines={2}>{ev.description}</Text>
              )}
              <View style={s.evBadges}>
                <StatusBadge label={ev.eventType} color={c} />
                {plan && <StatusBadge label="Weekly Plan" color={T.info} />}
              </View>
            </View>
            {!plan && doneCtl(ev)}
          </ListCard>
        );
      })}
    </View>
  );

  const renderDayPanel = () => (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <Text style={[s.panelTitle, { color: T.text }]}>
          {new Date(year, month, selectedDay).toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>
        <Text style={[s.panelSub, { color: T.dim }]}>
          {loading
            ? 'Loading…'
            : `${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      {loading ? (
        <View style={{ gap: 8 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.skel, { backgroundColor: T.cardAlt, borderColor: T.line }]} />
          ))}
        </View>
      ) : selectedEvents.length === 0 ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <CalendarDays size={30} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.emptyTitle, { color: T.text }]}>Nothing scheduled</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            Tap New Event to add something to this day.
          </Text>
        </View>
      ) : (
        <>
          {table ? renderAgendaTable() : renderAgendaRows()}
          {agendaPageCount > 1 && (
            <View style={s.pgRow}>
              <Text style={[s.count, { color: T.dim }]}>
                Showing {agendaFrom}{DASH}{agendaTo} of {selectedEvents.length}
              </Text>
              <Pagination page={agendaPage} pageCount={agendaPageCount} onChange={setAgendaPage} />
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadEvents(true); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* No in-page title or hamburger — the topbar (native drawer header for
            RH/SH/SCA) already names the screen and carries the menu. Just the action. */}
        <View style={s.actionBar}>
          <Btn
            label="New Event"
            small
            onPress={openModal}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        {!isOnline && banner(T.warning, <WifiOff size={14} color={T.warning} strokeWidth={ICON_STROKE} />, 'You are offline. Showing the last loaded schedule.', 'off')}
        {!!error && banner(T.danger, <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />, error, 'err')}
        {!!notice && banner(T.success, <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />, notice, 'ok')}

        {wide ? (
          <View style={s.two}>
            <View style={s.gridCol}>{renderGrid()}</View>
            <View style={s.panelCol}>{renderDayPanel()}</View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {renderGrid()}
            {renderDayPanel()}
          </View>
        )}
      </ScrollView>

      {/* ── Event details (web parity: Calendar.jsx's selectedEvent modal) ──
          The day panel already shows title, type, description and the HH:MM range;
          what only lives here is the fully formatted START and END datetime, which the
          panel's bare "9:00 AM – 10:00 AM" omits the date half of. */}
      {!!selectedEvent && (() => {
        const ev = selectedEvent;
        const c = TYPE_COLORS[ev.eventType] || TYPE_COLORS.Other;
        const plan = isPlanEvent(ev);
        return (
          <FormModal
            visible
            wide={wide}
            title="Event Details"
            onClose={() => setSelectedEvent(null)}
            footer={
              <>
                <View style={{ flex: 1 }} />
                <Btn label="Close" variant="secondary" onPress={() => setSelectedEvent(null)} small />
                {!plan && !ev.isCompleted && (
                  <Btn
                    label="Mark complete"
                    small
                    icon={<Check size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                    onPress={() => { handleMarkComplete(ev); setSelectedEvent(null); }}
                  />
                )}
              </>
            }
          >
            <View style={s.detail}>
              <View style={s.detailBadges}>
                <StatusBadge label={ev.eventType} color={c} />
                {plan && <StatusBadge label="Weekly Plan" color={T.info} />}
                {ev.isCompleted && <StatusBadge label="Completed" color={T.success} />}
              </View>

              <Text
                style={[
                  s.detailTitle,
                  { color: T.text },
                  ev.isCompleted && { color: T.dim, textDecorationLine: 'line-through' },
                ]}
              >
                {ev.title}
              </Text>

              {!!ev.schoolName && (
                <Text style={[s.detailBody, { color: T.dim }]}>{ev.schoolName}</Text>
              )}
              {!!ev.description && (
                <Text style={[s.detailBody, { color: T.sub }]}>{ev.description}</Text>
              )}

              <View style={s.detailTimes}>
                <View style={s.flex}>
                  <Text style={[s.detailLabel, { color: T.dim }]}>Start</Text>
                  <Text style={[s.detailValue, { color: T.text }]}>{formatDateTime(ev.startTime)}</Text>
                </View>
                <View style={s.flex}>
                  <Text style={[s.detailLabel, { color: T.dim }]}>End</Text>
                  <Text style={[s.detailValue, { color: T.text }]}>{formatDateTime(ev.endTime)}</Text>
                </View>
              </View>

              {plan && (
                <Text style={[s.detailNote, { color: T.dim }]}>
                  This is a weekly plan activity and cannot be completed from the calendar.
                </Text>
              )}
            </View>
          </FormModal>
        );
      })()}

      {showModal && (
        <FormModal
          visible
          wide={wide}
          title="New Event"
          onClose={closeModal}
          footer={
            <>
              <View style={{ flex: 1 }} />
              <Btn label="Cancel" variant="secondary" onPress={closeModal} small />
              <Btn label="Create" onPress={handleCreate} loading={saving} disabled={!canSave} small />
            </>
          }
        >
          <View style={s.form}>
            {!!saveErr && <Text style={[s.formErr, { color: T.danger }]}>{saveErr}</Text>}

            {/* Spec: dropdown opens 8px below its <Trigger open>. Floated (not inline-flow)
                so a 6-row panel cannot push this non-scrolling modal past a small screen. */}
            <Field label="Event Type" style={s.zTop}>
              <Trigger label={newType} open={typeOpen} onPress={() => setTypeOpen(v => !v)} />
              {typeOpen && (
                <View style={s.ddFloat}>
                  <Dropdown<CreateType>
                    style={{ width: '100%' }}
                    maxHeight={168}
                    value={newType}
                    options={CREATE_TYPES.map(t => ({ label: t, value: t }))}
                    onSelect={v => { setNewType(v); setTypeOpen(false); }}
                  />
                </View>
              )}
            </Field>

            <Input label="Title *" value={newTitle} onChangeText={setNewTitle} placeholder="Event title" />

            <Field label="Date *">
              <DateInput value={newDate} onChange={setNewDate} accentColor={T.accent} />
            </Field>

            <View style={s.row2}>
              <Input
                label="Start (HH:MM) *"
                value={newStart}
                onChangeText={setNewStart}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="End (HH:MM)"
                value={newEnd}
                onChangeText={setNewEnd}
                placeholder="10:00"
                keyboardType="numbers-and-punctuation"
                containerStyle={{ flex: 1 }}
              />
            </View>

            {/* Kit Input hard-codes height 46 — multiline needs Field + a themed TextInput. */}
            <Field label="Description">
              <TextInput
                style={[s.textarea, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Optional description"
                placeholderTextColor={T.dim}
                multiline
                textAlignVertical="top"
              />
            </Field>
          </View>
        </FormModal>
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from useAppTheme(), inline) ─────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  /** Just the primary action, right-aligned, now the title/subtitle are gone. */
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12,
  },
  bannerTxt: { flex: 1, fontSize: rf(12.5), fontWeight: '600' },

  // Two-pane on iPad landscape — uses the horizontal room instead of leaving it empty.
  // Both columns are FLEX FRACTIONS of the row, never a slice of useWindowDimensions():
  // the permanent 240pt sidebar means the window is wider than this row's content box,
  // so any `width * n` here would push the grid's last column off screen.
  two: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  gridCol: { flex: 1.35, flexShrink: 1, minWidth: 0 },
  panelCol: { flex: 1, flexShrink: 1, minWidth: 0 },

  card: { borderRadius: 16, borderWidth: 1, padding: 10, gap: 10 },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  monthTitle: { fontSize: rf(15), fontWeight: '800', letterSpacing: -0.3 },

  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { textAlign: 'center', fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.3 },

  // flexWrap + stretch: every cell in a row grows to the tallest cell in that row, so the
  // grid has no fixed height and cannot clip; the page scrolls if the month runs long.
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  cell: { padding: 2 },
  cellInner: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 3, overflow: 'hidden' },

  dayNum: {
    alignSelf: 'flex-start', minWidth: 18, borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1, marginBottom: 2, overflow: 'hidden',
  },
  dayNumTxt: { fontSize: rf(11), fontWeight: '700', textAlign: 'center' },

  pill: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1.5 },
  pillTxt: { fontSize: rf(9), fontWeight: '700' },
  more: { fontSize: rf(9), fontWeight: '600', paddingLeft: 3 },

  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: rf(11), fontWeight: '600' },

  panel: { gap: 10 },
  panelHead: { gap: 2 },
  panelTitle: { fontSize: rf(15), fontWeight: '800', letterSpacing: -0.3 },
  panelSub: { fontSize: rf(11.5), fontWeight: '600' },

  skel: { height: 66, borderRadius: 14, borderWidth: 1 },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 34, paddingHorizontal: 18, alignItems: 'center', gap: 7 },
  emptyTitle: { fontSize: rf(13.5), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12), fontWeight: '500', textAlign: 'center' },

  // ── Agenda table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line ──
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },

  /* One constant per column, used by BOTH the header cell and the body cell so they can
     never drift. flexShrink defaults to 0 in RN — without it a long event title refuses
     to shrink and shoves Type and Done out of alignment on every other row. minWidth:0
     is what lets that shrink actually bite on a text node. cDone is a fixed width and
     deliberately gets neither. */
  cTime: { flex: 1.1, flexShrink: 1, minWidth: 0 },
  cEvent: { flex: 2.4, flexShrink: 1, minWidth: 0 },
  cType: { flex: 1.2, flexShrink: 1, minWidth: 0 },
  cDone: { width: 44 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  flexMin: { flex: 1, minWidth: 0, gap: 3 },
  evCard: { alignItems: 'flex-start' },
  evBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 38 },
  evTitle: { fontSize: rf(13.5), fontWeight: '700' },
  evTime: { fontSize: rf(12), fontWeight: '600' },
  evMeta: { fontSize: rf(11.5), fontWeight: '500' },
  evBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  todo: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // event-details modal
  flex: { flex: 1 },
  detail: { gap: 9 },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailTitle: { fontSize: rf(15), fontWeight: '800', letterSpacing: -0.3 },
  detailBody: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 18 },
  detailTimes: { flexDirection: 'row', gap: 12, marginTop: 2 },
  detailLabel: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { fontSize: rf(12.5), fontWeight: '700', marginTop: 2 },
  detailNote: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 16, marginTop: 2 },

  // modal form
  form: { gap: 14 },
  formErr: { fontSize: rf(12.5), fontWeight: '600' },
  zTop: { zIndex: 40 },
  ddFloat: { position: 'absolute', top: 67, left: 0, right: 0, zIndex: 40 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  textarea: {
    minHeight: 62, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: rf(14), fontWeight: '500',
  },
});
