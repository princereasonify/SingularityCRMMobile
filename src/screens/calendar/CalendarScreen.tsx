import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import { calendarApi } from '../../api/calendar';
import { weeklyPlanApi } from '../../api/weeklyPlan';
import { CalendarEvent } from '../../types';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Card, Badge, Chip, SectionLabel } from '../../components/ui';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

// ─── Match web event types exactly ────────────────────────────────────────────
const EVENT_TYPES = ['Meeting', 'Demo', 'FollowUp', 'Visit', 'Onboarding', 'Other'] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_COLORS: Record<EventType, string> = {
  Meeting:    '#7C3AED',
  Demo:       '#2563EB',
  FollowUp:   '#F59E0B',
  Visit:      '#0D9488',
  Onboarding: '#EA580C',
  Other:      '#6B7280',
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const CalendarScreen = (_: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;
  // Constrain content on tablet landscape for breathing room; grid generation is untouched.
  const contentW = twoWide ? Math.min(width, 720) : width;
  // Total horizontal insets: content padding (16*2) + calCard padding (4*2) + grid padding (4*2) = 48
  const cellWidth = Math.floor((contentW - 48) / 7);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<EventType>('Meeting');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Calendar math ──────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Build grid cells: null = blank padding before day 1
  const gridCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  // ── Fetch events for this month + merge approved weekly plan activities ────
  const loadEvents = useCallback(async () => {
    const from = toDateStr(year, month, 1);
    const to = toDateStr(year, month, daysInMonth);
    try {
      const res = await calendarApi.getEvents(from, to);
      const calEvents: CalendarEvent[] = (res.data as any) ?? [];

      // Merge approved weekly plan activities (like web)
      const planEvents: CalendarEvent[] = [];
      try {
        for (let w = -1; w < 5; w++) {
          const ws = new Date(year, month, 1 + w * 7);
          const dow = ws.getDay();
          const monday = new Date(ws);
          monday.setDate(monday.getDate() - ((dow + 6) % 7));
          const weekStart = monday.toISOString().split('T')[0];
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
                  id: `wp-${p.id}-${day.date}-${act.type}` as any,
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
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month, daysInMonth]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Whenever month changes, reset selectedDay to 1 (or today if same month)
  useEffect(() => {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    setSelectedDay(isCurrentMonth ? today.getDate() : 1);
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // Events for a specific day
  const eventsForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = toDateStr(year, month, day);
    return events.filter(e => e.startTime?.startsWith(dateStr));
  };

  // Events for selected day
  const selectedDateStr = toDateStr(year, month, selectedDay);
  const selectedEvents = events.filter(e => e.startTime?.startsWith(selectedDateStr));

  // ── Create event ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim() || !newStart) return;
    setSaving(true);
    try {
      const endTime = newEnd || newStart;
      await calendarApi.create({
        eventType: newType,
        title: newTitle.trim(),
        description: newDesc || undefined,
        startTime: `${selectedDateStr}T${newStart}:00`,
        endTime: `${selectedDateStr}T${endTime}:00`,
      });
      setShowModal(false);
      setNewTitle(''); setNewType('Meeting'); setNewStart(''); setNewEnd(''); setNewDesc('');
      loadEvents();
    } catch {}
    finally { setSaving(false); }
  };

  const handleMarkComplete = async (id: number) => {
    try {
      await calendarApi.markComplete(id);
      loadEvents();
    } catch {}
  };

  const isToday = (day: number | null) =>
    !!day && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* ── Sunstone hero header ──────────────────────────────────────── */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <DrawerMenuButton />
            <Text style={styles.headerTitle}>Calendar</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Plus size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth}>
            <ChevronLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth}>
            <ChevronRight size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadEvents(); }}
            tintColor={T.accent}
          />
        }
      >
        <View style={[styles.contentInner, twoWide && { maxWidth: 720, alignSelf: 'center', width: '100%' }]}>
          {/* ── Monthly grid card ────────────────────────────────────────── */}
          <Card style={styles.calCard} padded={false}>
            {/* Day-of-week headers */}
            <View style={styles.dayHeaderRow}>
              {DAY_HEADERS.map(d => (
                <Text key={d} style={[styles.dayHeader, { width: cellWidth, color: T.dim }]}>{d}</Text>
              ))}
            </View>

            {/* Grid cells */}
            <View style={styles.grid}>
              {gridCells.map((day, idx) => {
                const dayEvs = eventsForDay(day);
                const selected = day === selectedDay;
                const todayCell = isToday(day);
                const highlight = todayCell || (selected && day != null);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.cell,
                      { width: cellWidth, minHeight: cellWidth + 12, borderColor: T.line },
                      todayCell && { borderWidth: 2, borderColor: T.accent, backgroundColor: T.accentSoft },
                      selected && !todayCell && { backgroundColor: T.cardAlt },
                    ]}
                    onPress={() => day && setSelectedDay(day)}
                    activeOpacity={day ? 0.7 : 1}
                  >
                    {day != null && (
                      <>
                        <View style={[styles.dayNumWrap, highlight && { backgroundColor: T.accent }]}>
                          <Text style={[styles.cellDay, { color: highlight ? T.onAccent : T.sub }]}>
                            {day}
                          </Text>
                        </View>
                        {/* Up to 3 event pills per day */}
                        {dayEvs.slice(0, 3).map(ev => (
                          <View
                            key={ev.id}
                            style={[styles.eventPill, { backgroundColor: (TYPE_COLORS[ev.eventType as EventType] || TYPE_COLORS.Other) + '22' }]}
                          >
                            <Text
                              style={[styles.eventPillText, { color: TYPE_COLORS[ev.eventType as EventType] || TYPE_COLORS.Other }]}
                              numberOfLines={1}
                            >
                              {ev.title}
                            </Text>
                          </View>
                        ))}
                        {dayEvs.length > 3 && (
                          <Text style={[styles.moreText, { color: T.dim }]}>+{dayEvs.length - 3}</Text>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Event type legend */}
            <View style={[styles.legend, { borderTopColor: T.line }]}>
              {EVENT_TYPES.map(t => (
                <View key={t} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: TYPE_COLORS[t] }]} />
                  <Text style={[styles.legendText, { color: T.sub }]}>{t}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* ── Selected day events ──────────────────────────────────────── */}
          <SectionLabel style={styles.daySectionLabel}>
            {new Date(year, month, selectedDay).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </SectionLabel>

          {loading ? (
            <LoadingSpinner color={T.accent} />
          ) : selectedEvents.length === 0 ? (
            <EmptyState title="No events" subtitle="Tap + to add an event" icon="📅" />
          ) : (
            <View style={[styles.eventList, twoWide && styles.eventListTwoCol]}>
              {selectedEvents.map(ev => (
                <Card key={ev.id} style={[styles.eventCard, twoWide && styles.eventCardTwoCol]} padded={false}>
                  <View style={[styles.eventBar, { backgroundColor: TYPE_COLORS[ev.eventType as EventType] || TYPE_COLORS.Other }]} />
                  <View style={styles.eventBody}>
                    <View style={styles.eventTopRow}>
                      <Text
                        style={[styles.eventTitle, { color: T.text }, ev.isCompleted && { color: T.dim, textDecorationLine: 'line-through' }]}
                        numberOfLines={1}
                      >
                        {ev.title}
                      </Text>
                      <Badge label={ev.eventType} color={TYPE_COLORS[ev.eventType as EventType] || TYPE_COLORS.Other} />
                    </View>
                    <Text style={[styles.eventTime, { color: T.sub }]}>
                      {formatTime(ev.startTime)} – {formatTime(ev.endTime)}
                    </Text>
                    {ev.schoolName && <Text style={[styles.eventSchool, { color: T.dim }]}>🏫 {ev.schoolName}</Text>}
                    {ev.description && <Text style={[styles.eventDesc, { color: T.sub }]}>{ev.description}</Text>}
                  </View>
                  {!ev.isCompleted ? (
                    <TouchableOpacity
                      style={[styles.checkBtn, { borderColor: T.success }]}
                      onPress={() => handleMarkComplete(ev.id)}
                    >
                      <Check size={15} color={T.success} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.doneBtn, { backgroundColor: T.success }]}>
                      <Check size={14} color={T.onAccent} />
                    </View>
                  )}
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Create Event Modal ───────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>New Event</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={20} color={T.sub} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.formLabel, { color: T.sub }]}>Event Type</Text>
            <View style={styles.chipRow}>
              {EVENT_TYPES.map(t => (
                <Chip
                  key={t}
                  label={t}
                  color={TYPE_COLORS[t]}
                  active={newType === t}
                  onPress={() => setNewType(t)}
                />
              ))}
            </View>

            <Text style={[styles.formLabel, { color: T.sub }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={T.dim}
            />

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: T.sub }]}>Start (HH:MM) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
                  value={newStart}
                  onChangeText={setNewStart}
                  placeholder="09:00"
                  placeholderTextColor={T.dim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: T.sub }]}>End (HH:MM)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
                  value={newEnd}
                  onChangeText={setNewEnd}
                  placeholder="10:00"
                  placeholderTextColor={T.dim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={[styles.formLabel, { color: T.sub }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Optional description"
              placeholderTextColor={T.dim}
              multiline
            />

            <GradientButton
              label={saving ? 'Creating…' : 'Create Event'}
              onPress={handleCreate}
              loading={saving}
              disabled={saving || !newTitle.trim() || !newStart}
              style={styles.createBtn}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hero header
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  monthTitle: { fontFamily: Fonts.bold, fontSize: rf(17), color: '#FFF', letterSpacing: -0.3 },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  contentInner: { gap: 14 },

  // Calendar card
  calCard: { paddingVertical: 14, paddingHorizontal: 4 },

  dayHeaderRow: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 4 },
  dayHeader: { textAlign: 'center', fontFamily: Fonts.bold, fontSize: rf(11), paddingVertical: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: {
    borderWidth: 1, borderRadius: 8,
    padding: 3, alignItems: 'flex-start',
  },
  dayNumWrap: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2 },
  cellDay: { fontFamily: Fonts.medium, fontSize: rf(12) },

  eventPill: {
    borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1,
    marginBottom: 1, width: '100%',
  },
  eventPillText: { fontFamily: Fonts.medium, fontSize: 9 },
  moreText: { fontFamily: Fonts.regular, fontSize: 9, paddingLeft: 2 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Fonts.regular, fontSize: rf(11) },

  // Day section
  daySectionLabel: { marginBottom: 0, paddingHorizontal: 4 },

  // Event list
  eventList: { gap: 10 },
  eventListTwoCol: { flexDirection: 'row', flexWrap: 'wrap' },
  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12,
  },
  eventCardTwoCol: { width: '48.5%' },
  eventBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  eventBody: { flex: 1 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  eventTitle: { fontFamily: Fonts.bold, fontSize: rf(14), flex: 1 },
  eventTime: { fontFamily: Fonts.regular, fontSize: rf(12), marginBottom: 2 },
  eventSchool: { fontFamily: Fonts.regular, fontSize: rf(12) },
  eventDesc: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 3 },
  checkBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: rf(18) },
  formLabel: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: Fonts.regular, fontSize: rf(14), marginBottom: 12,
  },
  inputMulti: { height: 64, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 10 },
  createBtn: { marginTop: 4 },
});
