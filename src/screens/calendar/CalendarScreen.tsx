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
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge, ListCard, FormModal,
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

const isPlanEvent = (ev: CalendarEvent) => !!(ev as any).isWeeklyPlan;

export const CalendarScreen = (_: any) => {
  const T = useAppTheme();
  const TYPE_COLORS = useMemo(() => typeColors(T), [T]);
  const { isOnline } = useOffline();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today.getDate());

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
                              <View
                                key={String(ev.id)}
                                style={[
                                  s.pill,
                                  { backgroundColor: withAlpha(c, SOFT_TINT) },
                                  // web parity: weekly-plan events carry a left rule
                                  isPlanEvent(ev) && { borderLeftWidth: 2, borderLeftColor: c },
                                ]}
                              >
                                <Text style={[s.pillTxt, { color: c }]} numberOfLines={1}>{ev.title}</Text>
                              </View>
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

  // ── Selected-day detail ────────────────────────────────────────────────────
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
        <View style={{ gap: 8 }}>
          {selectedEvents.map(ev => {
            const c = TYPE_COLORS[ev.eventType] || TYPE_COLORS.Other;
            const plan = isPlanEvent(ev);
            return (
              <ListCard key={String(ev.id)} style={s.evCard}>
                <View style={[s.evBar, { backgroundColor: c }]} />
                <View style={{ flex: 1, gap: 3 }}>
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
                  <Text style={[s.evTime, { color: T.sub }]}>
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
                {!plan && (
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
                  )
                )}
              </ListCard>
            );
          })}
        </View>
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
        {/* House pattern: plain themed title block on T.bg — no gradient hero. */}
        <View style={s.header}>
          <View style={s.titleBlock}>
            <Text style={[s.h1, { color: T.text }]}>Calendar</Text>
            <Text style={[s.h2, { color: T.dim }]}>Your schedule at a glance</Text>
          </View>
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

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  titleBlock: { flex: 1, gap: 2 },
  h1: { fontSize: rf(21), fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontSize: rf(12.5), fontWeight: '500' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12,
  },
  bannerTxt: { flex: 1, fontSize: rf(12.5), fontWeight: '600' },

  // two-pane on iPad landscape — uses the horizontal room instead of leaving it empty
  two: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  gridCol: { flex: 1.55 },
  panelCol: { flex: 1 },

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

  evCard: { alignItems: 'flex-start' },
  evBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 38 },
  evTitle: { fontSize: rf(13.5), fontWeight: '700' },
  evTime: { fontSize: rf(12), fontWeight: '600' },
  evMeta: { fontSize: rf(11.5), fontWeight: '500' },
  evBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  todo: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

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
