import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Check } from 'lucide-react-native';
import { calendarApi } from '../../api/calendar';
import { CalendarEvent, CreateCalendarEventRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVENT_TYPES = ['Visit', 'Meeting', 'Demo', 'Task', 'Call', 'Other'];
const EVENT_COLORS: Record<string, string> = {
  Visit: '#0D9488', Meeting: '#2563EB', Demo: '#7C3AED',
  Task: '#F59E0B', Call: '#16A34A', Other: '#9CA3AF',
};

function getWeekDates(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - dow + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export const CalendarScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekDates, setWeekDates] = useState(getWeekDates(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Meeting');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const from = toISO(weekDates[0]);
      const to = toISO(weekDates[6]);
      const res = await calendarApi.getEvents(from, to);
      setEvents((res.data as any) ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekDates]);

  useEffect(() => { loadEvents(); }, [weekDates]);

  const dayEvents = events.filter(e => {
    const d = e.startTime.split('T')[0];
    return d === toISO(selectedDate);
  });

  const handleCreateEvent = async () => {
    if (!newTitle.trim() || !newStart || !newEnd) {
      Alert.alert('Validation', 'Title, start time, and end time are required');
      return;
    }
    setSaving(true);
    try {
      const dateStr = toISO(selectedDate);
      await calendarApi.create({
        eventType: newType,
        title: newTitle.trim(),
        description: newDesc || undefined,
        startTime: `${dateStr}T${newStart}:00`,
        endTime: `${dateStr}T${newEnd}:00`,
      });
      setShowModal(false);
      setNewTitle(''); setNewStart(''); setNewEnd(''); setNewDesc('');
      loadEvents();
    } catch { Alert.alert('Error', 'Failed to create event'); }
    finally { setSaving(false); }
  };

  const handleMarkComplete = async (eventId: number) => {
    try {
      await calendarApi.markComplete(eventId);
      loadEvents();
    } catch { Alert.alert('Error', 'Failed to mark complete'); }
  };

  const goToPrevWeek = () => {
    const prev = new Date(weekDates[0]);
    prev.setDate(prev.getDate() - 7);
    setWeekDates(getWeekDates(prev));
  };

  const goToNextWeek = () => {
    const next = new Date(weekDates[6]);
    next.setDate(next.getDate() + 1);
    setWeekDates(getWeekDates(next));
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Calendar"
        color={COLOR.primary}
        rightAction={
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <Plus size={22} color="#FFF" />
          </TouchableOpacity>
        }
      />

      {/* Week Navigation */}
      <View style={[styles.weekNav, { backgroundColor: COLOR.primary }]}>
        <TouchableOpacity onPress={goToPrevWeek} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.weekStrip}>
          {weekDates.map((d, i) => {
            const isSelected = toISO(d) === toISO(selectedDate);
            const isToday = toISO(d) === toISO(today);
            const hasEvents = events.some(e => e.startTime.split('T')[0] === toISO(d));
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayBox, isSelected && styles.dayBoxSelected]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && !isSelected && { color: '#F59E0B' }]}>
                  {d.getDate()}
                </Text>
                {hasEvents && <View style={[styles.eventDot, isSelected && { backgroundColor: '#FFF' }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={goToNextWeek} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Selected date label */}
      <View style={styles.dateLabelRow}>
        <Text style={styles.dateLabel}>
          {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {loading ? (
        <LoadingSpinner color={COLOR.primary} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEvents(); }} colors={[COLOR.primary]} />}
        >
          {dayEvents.length === 0 ? (
            <EmptyState title="No events" subtitle="Tap + to add an event for this day" icon="📅" />
          ) : (
            dayEvents.map(event => (
              <Card key={event.id}>
                <View style={styles.eventHeader}>
                  <View style={[styles.eventTypeBar, { backgroundColor: EVENT_COLORS[event.eventType] || '#9CA3AF' }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventTitleRow}>
                      <Text style={[styles.eventTitle, event.isCompleted && styles.eventTitleDone]}>
                        {event.title}
                      </Text>
                      <Badge label={event.eventType} color={EVENT_COLORS[event.eventType] || '#9CA3AF'} />
                    </View>
                    <Text style={styles.eventTime}>
                      {formatTime(event.startTime)} – {formatTime(event.endTime)}
                    </Text>
                    {event.schoolName && <Text style={styles.eventSchool}>🏫 {event.schoolName}</Text>}
                    {event.description && <Text style={styles.eventDesc}>{event.description}</Text>}
                  </View>
                  {!event.isCompleted && (
                    <TouchableOpacity style={styles.checkBtn} onPress={() => handleMarkComplete(event.id)}>
                      <Check size={16} color="#16A34A" />
                    </TouchableOpacity>
                  )}
                  {event.isCompleted && (
                    <View style={styles.completedBadge}>
                      <Check size={14} color="#FFF" />
                    </View>
                  )}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Event Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Event Type</Text>
            <View style={styles.chipRow}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, newType === t && { backgroundColor: COLOR.primary }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.chipText, newType === t && { color: '#FFF' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Title *</Text>
            <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="Event title" placeholderTextColor="#9CA3AF" />
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start (HH:MM) *</Text>
                <TextInput style={styles.input} value={newStart} onChangeText={setNewStart} placeholder="09:00" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End (HH:MM) *</Text>
                <TextInput style={styles.input} value={newEnd} onChangeText={setNewEnd} placeholder="10:00" placeholderTextColor="#9CA3AF" />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={newDesc} onChangeText={setNewDesc} placeholder="Optional description" placeholderTextColor="#9CA3AF" multiline />
            <Button title={saving ? 'Creating...' : 'Create Event'} onPress={handleCreateEvent} variant="primary" disabled={saving} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  weekNav: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  navBtn: { padding: 8 },
  navArrow: { fontSize: rf(22), color: '#FFF', fontWeight: '700' },
  weekStrip: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  dayBox: { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 12 },
  dayBoxSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dayLabel: { fontSize: rf(11), color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  dayLabelSelected: { color: '#FFF' },
  dayNum: { fontSize: rf(16), color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: 2 },
  dayNumSelected: { color: '#FFF' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', marginTop: 3 },
  dateLabelRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dateLabel: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  scroll: { flex: 1 },
  content: { padding: 12, gap: 10, paddingBottom: 32 },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventTypeBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  eventContent: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  eventTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', flex: 1 },
  eventTitleDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  eventTime: { fontSize: rf(12), color: '#6B7280', marginBottom: 2 },
  eventSchool: { fontSize: rf(12), color: '#9CA3AF' },
  eventDesc: { fontSize: rf(13), color: '#374151', marginTop: 4 },
  checkBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  completedBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(12), color: '#374151', fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827',
    marginBottom: 10,
  },
  timeRow: { flexDirection: 'row', gap: 10 },
});
