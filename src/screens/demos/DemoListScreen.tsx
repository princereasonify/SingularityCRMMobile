import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions, ScrollView,
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

const FILTERS = ['All', 'Requested', 'Approved', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'];

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading demos..." />
      ) : (
        <FlatList
          data={demos}
          keyExtractor={item => String(item.id)}
          renderItem={renderDemo}
          contentContainerStyle={[styles.list, demos.length === 0 && { flex: 1 }]}
          key={tablet ? 'grid' : 'list'}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          ListHeaderComponent={
            <View style={styles.controlsCard}>
              <View style={styles.controlsTopRow}>
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
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: COLOR.primary }]}
                  onPress={() => navigation.navigate('AssignDemo')}
                >
                  <Plus size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
              >
                {FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterChip,
                      filter === f && { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
                    ]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
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
  controlsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  controlsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterContent: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '700' },
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
