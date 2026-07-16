import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, Calendar, Clock } from 'lucide-react-native';
import { demosApi } from '../../api/demos';
import { DemoAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Chip } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

const FILTERS = ['All', 'Requested', 'Approved', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'];

export const DemoListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const [demos, setDemos] = useState<DemoAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const PURPLE = '#8B5CF6';
  const statusColor = (status: string): string => ({
    Requested: T.warning, Approved: T.info, Scheduled: T.accent,
    InProgress: T.warning, Completed: T.success, Cancelled: T.dim, Rescheduled: PURPLE,
  } as Record<string, string>)[status] || T.dim;
  const modeColor = (mode: string): string => ({
    Online: T.info, Offline: T.success, Hybrid: PURPLE,
  } as Record<string, string>)[mode] || T.sub;

  const fetchDemos = useCallback(async (reset = false) => {
    try {
      const params: any = { search: search || undefined, limit: 20 };
      if (filter !== 'All') params.status = filter;
      const res = await demosApi.getAll(params);
      const d: any = res.data;
      const items: DemoAssignment[] = d?.demos ?? d?.items ?? (Array.isArray(d) ? d : []);
      setDemos(items);
    } catch {
      setDemos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    fetchDemos(true);
  }, [search, filter]);

  const renderDemo = ({ item }: { item: DemoAssignment }) => (
    <Card
      style={twoWide ? { flex: 1 } : undefined}
      onPress={() => navigation.navigate('DemoDetail', { demoId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.schoolName, { color: T.text }]} numberOfLines={1}>{item.schoolName}</Text>
        <Badge label={item.status} color={statusColor(item.status)} />
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Calendar size={12} color={T.dim} />
          <Text style={[styles.metaText, { color: T.sub }]}>{formatDate(item.scheduledDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={12} color={T.dim} />
          <Text style={[styles.metaText, { color: T.sub }]}>{item.scheduledStartTime} – {item.scheduledEndTime}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Badge label={item.demoMode} color={modeColor(item.demoMode)} />
        {role !== 'FO' && <Text style={[styles.assignedTo, { color: T.sub }]}>👤 {item.assignedToName}</Text>}
        {item.outcome && <Text style={[styles.outcome, { color: T.success }]}>{item.outcome}</Text>}
      </View>
    </Card>
  );

  return (
    <View style={[styles.safe, { backgroundColor: T.bg, paddingTop: insets.top }]}>
      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading demos..." />
      ) : (
        <FlatList
          data={demos}
          keyExtractor={item => String(item.id)}
          renderItem={renderDemo}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }, demos.length === 0 && { flex: 1 }]}
          key={twoWide ? 'grid' : 'list'}
          numColumns={twoWide ? 2 : 1}
          columnWrapperStyle={twoWide ? { gap: 10 } : undefined}
          ListHeaderComponent={
            <Card style={styles.controlsCard} padded={false}>
              <View style={styles.controlsInner}>
                <View style={styles.controlsTopRow}>
                  <View style={[styles.searchBar, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
                    <Search size={16} color={T.dim} />
                    <TextInput
                      style={[styles.searchInput, { color: T.text }]}
                      placeholder="Search demos..."
                      placeholderTextColor={T.dim}
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: T.accent }]}
                    onPress={() => navigation.navigate('AssignDemo')}
                  >
                    <Plus size={18} color={T.onAccent} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterContent}
                >
                  {FILTERS.map(f => (
                    <Chip
                      key={f}
                      label={f}
                      active={filter === f}
                      onPress={() => setFilter(f)}
                    />
                  ))}
                </ScrollView>
              </View>
            </Card>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDemos(true); }}
              tintColor={T.accent}
              colors={[T.accent]}
            />
          }
          ListEmptyComponent={<EmptyState title="No demos found" subtitle="Assign a demo to get started" icon="🖥️" />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  controlsCard: { marginBottom: 10 },
  controlsInner: { padding: 12 },
  controlsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11,
    gap: 8,
    flex: 1,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14), padding: 0 },
  filterContent: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  schoolName: { fontFamily: Fonts.bold, fontSize: rf(15), flex: 1 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  assignedTo: { fontFamily: Fonts.regular, fontSize: rf(12), flex: 1 },
  outcome: { fontFamily: Fonts.medium, fontSize: rf(12) },
});
