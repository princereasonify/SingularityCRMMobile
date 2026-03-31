import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronUp, ChevronDown, Trash2, Plus, Navigation, Save,
  Search, MapPin, CheckCircle, Circle,
} from 'lucide-react-native';
import { routePlanApi } from '../../api/routePlan';
import { schoolsApi } from '../../api/schools';
import { DailyRoutePlan, RouteStop, School } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { ConfirmModal } from '../../components/common/ConfirmModal';

const today = () => new Date().toISOString().split('T')[0];

export const RoutePlannerScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [plan, setPlan] = useState<DailyRoutePlan | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // School picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; index: number }>({ visible: false, index: -1 });

  const loadPlan = useCallback(async () => {
    try {
      const res = await routePlanApi.getToday();
      const data = res.data as DailyRoutePlan;
      setPlan(data);
      setStops(data.stops || []);
    } catch {
      setPlan(null);
      setStops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const loadSchools = useCallback(async (search: string) => {
    setSchoolsLoading(true);
    try {
      const res = await schoolsApi.getAll({ search: search || undefined, pageSize: 30 });
      const items: School[] = (res.data as any)?.items ?? res.data ?? [];
      // Filter out already-added stops
      const addedIds = new Set(stops.map(s => s.schoolId));
      setSchools(items.filter(s => !addedIds.has(s.id)));
    } catch {
      setSchools([]);
    } finally {
      setSchoolsLoading(false);
    }
  }, [stops]);

  useEffect(() => {
    if (showPicker) {
      const timer = setTimeout(() => loadSchools(schoolSearch), 400);
      return () => clearTimeout(timer);
    }
  }, [schoolSearch, showPicker, loadSchools]);

  const openPicker = () => {
    setSchoolSearch('');
    setShowPicker(true);
    loadSchools('');
  };

  const addStop = (school: School) => {
    const newStop: RouteStop = {
      order: stops.length + 1,
      schoolId: school.id,
      schoolName: school.name,
      latitude: school.latitude,
      longitude: school.longitude,
      visited: false,
    };
    setStops(prev => [...prev, newStop]);
    setShowPicker(false);
  };

  const removeStop = (index: number) => {
    setStops(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setStops(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveDown = (index: number) => {
    if (index === stops.length - 1) return;
    setStops(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const savePlan = async () => {
    if (stops.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        planDate: today(),
        stops: stops.map(s => ({ schoolId: s.schoolId, order: s.order })),
      };
      if (plan?.id) {
        await routePlanApi.create(payload); // backend upserts by date
      } else {
        await routePlanApi.create(payload);
      }
      await loadPlan();
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  const markVisited = async (stop: RouteStop, index: number) => {
    if (!plan?.id || stop.visited) return;
    try {
      await routePlanApi.markVisited(plan.id, stop.schoolId);
      setStops(prev => prev.map((s, i) => i === index ? { ...s, visited: true } : s));
    } catch {}
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading route plan..." />;

  const visitedCount = stops.filter(s => s.visited).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Route Planner"
        color={COLOR.primary}
        onMenu={() => navigation.toggleDrawer()}
        rightAction={
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={savePlan} disabled={saving || stops.length === 0}>
            {saving
              ? <ActivityIndicator size="small" color="#FFF" />
              : <><Save size={14} color="#FFF" /><Text style={styles.saveBtnText}>Save</Text></>}
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLOR.primary }]}>{stops.length}</Text>
              <Text style={styles.summaryLabel}>Stops</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{visitedCount}</Text>
              <Text style={styles.summaryLabel}>Visited</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{stops.length - visitedCount}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
          </View>
        </Card>

        {/* Stops List */}
        {stops.map((stop, index) => (
          <View key={`${stop.schoolId}-${index}`} style={[styles.stopCard, stop.visited && styles.stopCardVisited]}>
            <View style={styles.stopOrder}>
              <Text style={[styles.stopOrderText, { color: stop.visited ? '#16A34A' : COLOR.primary }]}>
                {stop.order}
              </Text>
            </View>

            <View style={styles.stopInfo}>
              <Text style={styles.stopName} numberOfLines={1}>{stop.schoolName}</Text>
              {stop.visited && (
                <View style={styles.visitedTag}>
                  <CheckCircle size={11} color="#16A34A" />
                  <Text style={styles.visitedText}>Visited</Text>
                </View>
              )}
            </View>

            <View style={styles.stopActions}>
              {!stop.visited && (
                <>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => markVisited(stop, index)}
                  >
                    <Circle size={18} color="#16A34A" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => moveUp(index)} disabled={index === 0}>
                    <ChevronUp size={18} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => moveDown(index)} disabled={index === stops.length - 1}>
                    <ChevronDown size={18} color={index === stops.length - 1 ? '#D1D5DB' : '#6B7280'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => setConfirmDelete({ visible: true, index })}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                </>
              )}
              {stop.visited && <CheckCircle size={20} color="#16A34A" />}
            </View>
          </View>
        ))}

        {/* Add Stop */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: COLOR.primary }]}
          onPress={openPicker}
        >
          <Plus size={18} color={COLOR.primary} />
          <Text style={[styles.addBtnText, { color: COLOR.primary }]}>Add School Stop</Text>
        </TouchableOpacity>

        {stops.length === 0 && (
          <View style={styles.emptyState}>
            <Navigation size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No route planned</Text>
            <Text style={styles.emptySub}>Add schools to build today's visit route</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* School Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add School</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerSearch}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.pickerInput}
                placeholder="Search schools..."
                placeholderTextColor="#9CA3AF"
                value={schoolSearch}
                onChangeText={setSchoolSearch}
                autoFocus
              />
            </View>
            {schoolsLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={COLOR.primary} />
            ) : (
              <FlatList
                data={schools}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerItem} onPress={() => addStop(item)}>
                    <MapPin size={14} color={COLOR.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{item.name}</Text>
                      <Text style={styles.pickerItemSub}>{item.city}{item.board ? ` • ${item.board}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>No schools found</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Confirm delete */}
      <ConfirmModal
        visible={confirmDelete.visible}
        title="Remove Stop"
        message="Remove this school from the route?"
        confirmText="Remove"
        confirmColor="#DC2626"
        onConfirm={() => {
          removeStop(confirmDelete.index);
          setConfirmDelete({ visible: false, index: -1 });
        }}
        onCancel={() => setConfirmDelete({ visible: false, index: -1 })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  saveBtnText: { color: '#FFF', fontSize: rf(13), fontWeight: '600' },

  summaryCard: { padding: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: rf(24), fontWeight: '800' },
  summaryLabel: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

  stopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  stopCardVisited: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  stopOrder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  stopOrderText: { fontSize: rf(14), fontWeight: '800' },
  stopInfo: { flex: 1 },
  stopName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  visitedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  visitedText: { fontSize: rf(11), color: '#16A34A', fontWeight: '600' },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { padding: 4 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, backgroundColor: '#FFF',
  },
  addBtnText: { fontSize: rf(14), fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: rf(16), fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pickerTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  pickerClose: { fontSize: rf(18), color: '#6B7280', padding: 4 },
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10,
  },
  pickerInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerItemName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  pickerItemSub: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  pickerEmpty: { textAlign: 'center', color: '#9CA3AF', fontSize: rf(14), paddingVertical: 20 },
});
