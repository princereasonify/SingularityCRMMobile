import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Calendar, Clock } from 'lucide-react-native';
import { demosApi } from '../../api/demos';
import { DemoAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'Today', 'Upcoming', 'Completed', 'Cancelled'];

const STATUS_COLORS: Record<string, string> = {
  Requested: '#F59E0B', Approved: '#2563EB', Scheduled: '#0D9488',
  InProgress: '#EA580C', Completed: '#16A34A', Cancelled: '#9CA3AF', Rescheduled: '#7C3AED',
};
const MODE_COLORS: Record<string, string> = {
  Online: '#2563EB', Offline: '#16A34A', Hybrid: '#7C3AED',
};

export const DemoListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [demos, setDemos] = useState<DemoAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const today = new Date().toISOString().split('T')[0];

  const fetchDemos = useCallback(async (reset = false) => {
    try {
      const params: any = { search: search || undefined };
      if (filter === 'Today') { params.from = today; params.to = today; }
      if (filter === 'Upcoming') { params.from = today; }
      if (filter === 'Completed') params.status = 'Completed';
      if (filter === 'Cancelled') params.status = 'Cancelled';
      const res = await demosApi.getAll(params);
      const items: DemoAssignment[] = (res.data as any)?.items ?? res.data ?? [];
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
      style={tablet ? { flex: 1 } : undefined}
      onPress={() => navigation.navigate('DemoDetail', { demoId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.schoolName} numberOfLines={1}>{item.schoolName}</Text>
        <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Calendar size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>{formatDate(item.scheduledDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>{item.scheduledStartTime} – {item.scheduledEndTime}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Badge label={item.demoMode} color={MODE_COLORS[item.demoMode] || '#6B7280'} />
        {role !== 'FO' && <Text style={styles.assignedTo}>👤 {item.assignedToName}</Text>}
        {item.outcome && <Text style={styles.outcome}>{item.outcome}</Text>}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Demos</Text>
          {role === 'FO' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AssignDemo')}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchBar}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search demos..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && { backgroundColor: '#FFF' }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: COLOR.primary }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading demos..." />
      ) : (
        <FlatList
          data={demos}
          keyExtractor={item => String(item.id)}
          renderItem={renderDemo}
          contentContainerStyle={[styles.list, demos.length === 0 && { flex: 1 }]}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDemos(true); }}
              colors={[COLOR.primary]}
            />
          }
          ListEmptyComponent={<EmptyState title="No demos found" subtitle="Assign a demo to get started" icon="🖥️" />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  schoolName: { fontSize: rf(15), fontWeight: '700', color: '#111827', flex: 1 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: rf(12), color: '#6B7280' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  assignedTo: { fontSize: rf(12), color: '#6B7280', flex: 1 },
  outcome: { fontSize: rf(12), color: '#16A34A', fontWeight: '600' },
});
