import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronUp, ChevronDown, Trash2, Plus, Navigation, Save,
  Search, MapPin, CheckCircle, Circle, Menu,
} from 'lucide-react-native';
import { routePlanApi } from '../../api/routePlan';
import { schoolsApi } from '../../api/schools';
import { DailyRoutePlan, RouteStop, School } from '../../types';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

const today = () => new Date().toISOString().split('T')[0];

export const RoutePlannerScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

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

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading route plan..." />;

  const visitedCount = stops.filter(s => s.visited).length;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.toggleDrawer()}>
            <Menu size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>Route Planner</Text>
            <Text style={styles.headerSub} numberOfLines={1}>Plan today's visit route</Text>
          </View>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={savePlan}
            disabled={saving || stops.length === 0}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFF" />
              : <><Save size={14} color="#FFF" /><Text style={styles.saveBtnText}>Save</Text></>}
          </TouchableOpacity>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={twoWide ? styles.centeredWide : undefined}>
          {/* Summary */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: T.accent }]}>{stops.length}</Text>
                <Text style={[styles.summaryLabel, { color: T.sub }]}>Stops</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: T.line }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: T.success }]}>{visitedCount}</Text>
                <Text style={[styles.summaryLabel, { color: T.sub }]}>Visited</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: T.line }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: T.warning }]}>{stops.length - visitedCount}</Text>
                <Text style={[styles.summaryLabel, { color: T.sub }]}>Pending</Text>
              </View>
            </View>
          </Card>

          {/* Stops List */}
          {stops.map((stop, index) => (
            <Card
              key={`${stop.schoolId}-${index}`}
              padded={false}
              style={[
                styles.stopCard,
                stop.visited && { backgroundColor: T.success + '14', borderColor: T.success + '55' },
              ]}
            >
              <View style={[styles.stopOrder, { backgroundColor: stop.visited ? T.success + '22' : T.accentSoft }]}>
                <Text style={[styles.stopOrderText, { color: stop.visited ? T.success : T.accent }]}>
                  {stop.order}
                </Text>
              </View>

              <View style={styles.stopInfo}>
                <Text style={[styles.stopName, { color: T.text }]} numberOfLines={1}>{stop.schoolName}</Text>
                {stop.visited && (
                  <View style={styles.visitedTag}>
                    <CheckCircle size={11} color={T.success} />
                    <Text style={[styles.visitedText, { color: T.success }]}>Visited</Text>
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
                      <Circle size={18} color={T.success} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => moveUp(index)} disabled={index === 0}>
                      <ChevronUp size={18} color={index === 0 ? T.line : T.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => moveDown(index)} disabled={index === stops.length - 1}>
                      <ChevronDown size={18} color={index === stops.length - 1 ? T.line : T.sub} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => setConfirmDelete({ visible: true, index })}
                    >
                      <Trash2 size={16} color={T.danger} />
                    </TouchableOpacity>
                  </>
                )}
                {stop.visited && <CheckCircle size={20} color={T.success} />}
              </View>
            </Card>
          ))}

          {/* Add Stop */}
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: T.accent, backgroundColor: T.card }]}
            onPress={openPicker}
          >
            <Plus size={18} color={T.accent} />
            <Text style={[styles.addBtnText, { color: T.accent }]}>Add School Stop</Text>
          </TouchableOpacity>

          {stops.length === 0 && (
            <View style={styles.emptyState}>
              <Navigation size={40} color={T.dim} />
              <Text style={[styles.emptyTitle, { color: T.text }]}>No route planned</Text>
              <Text style={[styles.emptySub, { color: T.sub }]}>Add schools to build today's visit route</Text>
            </View>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* School Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: T.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: T.text }]}>Add School</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={[styles.pickerClose, { color: T.sub }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.pickerSearch, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <Search size={16} color={T.dim} />
              <TextInput
                style={[styles.pickerInput, { color: T.text }]}
                placeholder="Search schools..."
                placeholderTextColor={T.dim}
                value={schoolSearch}
                onChangeText={setSchoolSearch}
                autoFocus
              />
            </View>
            {schoolsLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={T.accent} />
            ) : (
              <FlatList
                data={schools}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: T.line }]} onPress={() => addStop(item)}>
                    <MapPin size={14} color={T.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemName, { color: T.text }]}>{item.name}</Text>
                      <Text style={[styles.pickerItemSub, { color: T.sub }]}>{item.city}{item.board ? ` • ${item.board}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text style={[styles.pickerEmpty, { color: T.sub }]}>No schools found</Text>
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
        confirmColor={T.danger}
        onConfirm={() => {
          removeStop(confirmDelete.index);
          setConfirmDelete({ visible: false, index: -1 });
        }}
        onCancel={() => setConfirmDelete({ visible: false, index: -1 })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.4 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12), color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  saveBtnText: { color: '#FFF', fontSize: rf(13), fontFamily: Fonts.bold },

  scroll: { flex: 1 },
  centeredWide: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 10 },

  summaryCard: { padding: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: rf(24), fontFamily: Fonts.bold },
  summaryLabel: { fontSize: rf(12), fontFamily: Fonts.medium, marginTop: 2 },
  divider: { width: 1, height: 32 },

  stopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  stopOrder: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  stopOrderText: { fontSize: rf(14), fontFamily: Fonts.bold },
  stopInfo: { flex: 1 },
  stopName: { fontSize: rf(14), fontFamily: Fonts.medium },
  visitedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  visitedText: { fontSize: rf(11), fontFamily: Fonts.medium },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { padding: 4 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18,
    paddingVertical: 14,
  },
  addBtnText: { fontSize: rf(14), fontFamily: Fonts.bold },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: rf(16), fontFamily: Fonts.bold },
  emptySub: { fontSize: rf(13), fontFamily: Fonts.regular, textAlign: 'center' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pickerTitle: { fontSize: rf(17), fontFamily: Fonts.bold },
  pickerClose: { fontSize: rf(18), padding: 4 },
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, marginBottom: 10,
  },
  pickerInput: { flex: 1, fontSize: rf(14), fontFamily: Fonts.regular },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerItemName: { fontSize: rf(14), fontFamily: Fonts.medium },
  pickerItemSub: { fontSize: rf(12), fontFamily: Fonts.regular, marginTop: 2 },
  pickerEmpty: { textAlign: 'center', fontSize: rf(14), fontFamily: Fonts.regular, paddingVertical: 20 },
});
