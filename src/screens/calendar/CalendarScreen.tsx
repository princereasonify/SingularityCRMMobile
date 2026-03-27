import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import { calendarApi } from '../../api/calendar';
import { CalendarEvent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const cellWidth = Math.floor((width - 32) / 7);

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

  // ── Fetch events for this month ────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    const from = toDateStr(year, month, 1);
    const to = toDateStr(year, month, daysInMonth);
    try {
      const res = await calendarApi.getEvents(from, to);
      setEvents((res.data as any) ?? []);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Calendar"
        color={COLOR.primary}
        rightAction={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => setShowModal(true)}
          >
            <Plus size={18} color="#FFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadEvents(); }}
            colors={[COLOR.primary]}
          />
        }
      >
        {/* ── Monthly grid card ────────────────────────────────────────── */}
        <View style={styles.calCard}>
          {/* Month navigation header */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth}>
              <ChevronLeft size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth}>
              <ChevronRight size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_HEADERS.map(d => (
              <Text key={d} style={[styles.dayHeader, { width: cellWidth }]}>{d}</Text>
            ))}
          </View>

          {/* Grid cells */}
          <View style={styles.grid}>
            {gridCells.map((day, idx) => {
              const dayEvs = eventsForDay(day);
              const selected = day === selectedDay;
              const todayCell = isToday(day);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.cell,
                    { width: cellWidth, minHeight: cellWidth + 12 },
                    todayCell && [styles.cellToday, { borderColor: COLOR.primary }],
                    selected && !todayCell && styles.cellSelected,
                  ]}
                  onPress={() => day && setSelectedDay(day)}
                  activeOpacity={day ? 0.7 : 1}
                >
                  {day != null && (
                    <>
                      <Text style={[
                        styles.cellDay,
                        todayCell && [styles.cellDayToday, { color: COLOR.primary }],
                        selected && !todayCell && styles.cellDaySelected,
                      ]}>
                        {day}
                      </Text>
                      {/* Up to 3 event pills per day */}
                      {dayEvs.slice(0, 3).map(ev => (
                        <View
                          key={ev.id}
                          style={[styles.eventPill, { backgroundColor: (TYPE_COLORS[ev.eventType as EventType] || '#6B7280') + '22' }]}
                        >
                          <Text
                            style={[styles.eventPillText, { color: TYPE_COLORS[ev.eventType as EventType] || '#6B7280' }]}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                        </View>
                      ))}
                      {dayEvs.length > 3 && (
                        <Text style={styles.moreText}>+{dayEvs.length - 3}</Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Event type legend */}
          <View style={styles.legend}>
            {EVENT_TYPES.map(t => (
              <View key={t} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TYPE_COLORS[t] }]} />
                <Text style={styles.legendText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Selected day events ──────────────────────────────────────── */}
        <View style={styles.daySection}>
          <Text style={styles.daySectionTitle}>
            {new Date(year, month, selectedDay).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
        </View>

        {loading ? (
          <LoadingSpinner color={COLOR.primary} />
        ) : selectedEvents.length === 0 ? (
          <EmptyState title="No events" subtitle="Tap + to add an event" icon="📅" />
        ) : (
          <View style={styles.eventList}>
            {selectedEvents.map(ev => (
              <View key={ev.id} style={styles.eventCard}>
                <View style={[styles.eventBar, { backgroundColor: TYPE_COLORS[ev.eventType as EventType] || '#6B7280' }]} />
                <View style={styles.eventBody}>
                  <View style={styles.eventTopRow}>
                    <Text style={[styles.eventTitle, ev.isCompleted && styles.eventTitleDone]} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    <Badge label={ev.eventType} color={TYPE_COLORS[ev.eventType as EventType] || '#6B7280'} />
                  </View>
                  <Text style={styles.eventTime}>
                    {formatTime(ev.startTime)} – {formatTime(ev.endTime)}
                  </Text>
                  {ev.schoolName && <Text style={styles.eventSchool}>🏫 {ev.schoolName}</Text>}
                  {ev.description && <Text style={styles.eventDesc}>{ev.description}</Text>}
                </View>
                {!ev.isCompleted ? (
                  <TouchableOpacity style={styles.checkBtn} onPress={() => handleMarkComplete(ev.id)}>
                    <Check size={15} color="#16A34A" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.doneBtn}>
                    <Check size={14} color="#FFF" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Create Event Modal ───────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Event Type</Text>
            <View style={styles.chipRow}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, newType === t && { backgroundColor: TYPE_COLORS[t] }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.chipText, newType === t && { color: '#FFF' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Start (HH:MM) *</Text>
                <TextInput
                  style={styles.input}
                  value={newStart}
                  onChangeText={setNewStart}
                  placeholder="09:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>End (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={newEnd}
                  onChangeText={setNewEnd}
                  placeholder="10:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Optional description"
              placeholderTextColor="#9CA3AF"
              multiline
            />

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: COLOR.primary }, saving && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={saving || !newTitle.trim() || !newStart}
            >
              <Text style={styles.createBtnText}>{saving ? 'Creating…' : 'Create Event'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Calendar card
  calCard: {
    backgroundColor: '#FFF', borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 },
  monthNavBtn: { padding: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  monthTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827' },

  dayHeaderRow: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 4 },
  dayHeader: { textAlign: 'center', fontSize: rf(11), fontWeight: '600', color: '#9CA3AF', paddingVertical: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: {
    borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 8,
    padding: 3, alignItems: 'flex-start',
  },
  cellToday: { borderWidth: 2, borderRadius: 8 },
  cellSelected: { backgroundColor: '#F3F4F6' },
  cellDay: { fontSize: rf(12), fontWeight: '500', color: '#6B7280', marginBottom: 2, paddingLeft: 2 },
  cellDayToday: { fontWeight: '800' },
  cellDaySelected: { color: '#111827', fontWeight: '700' },

  eventPill: {
    borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1,
    marginBottom: 1, width: '100%',
  },
  eventPillText: { fontSize: 9, fontWeight: '600' },
  moreText: { fontSize: 9, color: '#9CA3AF', paddingLeft: 2 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: rf(11), color: '#6B7280' },

  // Day section
  daySection: { paddingHorizontal: 4 },
  daySectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },

  // Event list
  eventList: { gap: 10 },
  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  eventBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  eventBody: { flex: 1 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  eventTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', flex: 1 },
  eventTitleDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  eventTime: { fontSize: rf(12), color: '#6B7280', marginBottom: 2 },
  eventSchool: { fontSize: rf(12), color: '#9CA3AF' },
  eventDesc: { fontSize: rf(12), color: '#374151', marginTop: 3 },
  checkBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  formLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(12), color: '#374151', fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', marginBottom: 12,
  },
  inputMulti: { height: 64, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 10 },
  createBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  createBtnText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
});
