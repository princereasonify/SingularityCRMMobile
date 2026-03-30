import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Users, Phone, Flame } from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { School, SchoolWithPriority, PaginatedResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'Active', 'Inactive', 'Blacklisted', 'Priority'];

const STATUS_COLORS: Record<string, string> = {
  Active: '#16A34A',
  Inactive: '#9CA3AF',
  Blacklisted: '#DC2626',
};

export const SchoolsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [schools, setSchools] = useState<(School | SchoolWithPriority)[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSchools = useCallback(async (pg = 1, reset = false) => {
    try {
      let items: (School | SchoolWithPriority)[] = [];
      let pages = 1;
      if (filter === 'Priority') {
        const res = await schoolsApi.getPriority({ page: pg, pageSize: 20, search: search || undefined });
        items = (res.data as any)?.items ?? res.data ?? [];
        pages = (res.data as any)?.totalPages ?? 1;
      } else {
        const status = filter !== 'All' ? filter : undefined;
        const res = await schoolsApi.getAll({ page: pg, pageSize: 20, search: search || undefined, status });
        items = (res.data as any)?.items ?? res.data ?? [];
        pages = (res.data as any)?.totalPages ?? 1;
      }
      if (reset) setSchools(items);
      else setSchools(prev => [...prev, ...items]);
      setTotalPages(pages);
    } catch {
      if (reset) setSchools([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSchools(1, true);
  }, [search, filter]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchSchools(next, false);
    }
  };

  const PRIORITY_COLORS = { High: '#DC2626', Medium: '#F59E0B', Low: '#16A34A' };

  const renderSchool = ({ item }: { item: School | SchoolWithPriority }) => {
    const withPriority = item as SchoolWithPriority;
    const hasPriority = withPriority.visitPriorityScore != null;
    return (
      <Card
        style={tablet ? { ...styles.card, flex: 1 } : styles.card}
        onPress={() => navigation.navigate('SchoolDetail', { schoolId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.schoolName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.cardHeaderRight}>
            {hasPriority && (
              <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[withPriority.priorityLevel] || '#9CA3AF') + '20' }]}>
                <Flame size={10} color={PRIORITY_COLORS[withPriority.priorityLevel] || '#9CA3AF'} />
                <Text style={[styles.priorityScore, { color: PRIORITY_COLORS[withPriority.priorityLevel] || '#9CA3AF' }]}>
                  {withPriority.visitPriorityScore}
                </Text>
              </View>
            )}
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || '#9CA3AF' }]} />
          </View>
        </View>
        <View style={styles.metaRow}>
          {item.city && <Text style={styles.metaText}>{item.city}</Text>}
          {item.city && item.state && <Text style={styles.metaDot}>•</Text>}
          {item.state && <Text style={styles.metaText}>{item.state}</Text>}
          {item.board && <><Text style={styles.metaDot}>•</Text><Text style={styles.metaText}>{item.board}</Text></>}
        </View>
        <View style={styles.statsRow}>
          {item.studentCount != null && (
            <View style={styles.stat}>
              <Users size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{item.studentCount} students</Text>
            </View>
          )}
          {item.contactCount != null && (
            <View style={styles.stat}>
              <Phone size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{item.contactCount} contacts</Text>
            </View>
          )}
          {item.lastVisitDate && (
            <Text style={styles.lastVisit}>Visited {formatRelativeDate(item.lastVisitDate)}</Text>
          )}
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.category}>{item.category}</Text>
          <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading schools..." />
      ) : (
        <FlatList
          data={schools}
          keyExtractor={item => String(item.id)}
          renderItem={renderSchool}
          contentContainerStyle={[styles.list, schools.length === 0 && styles.listEmpty]}
          key={tablet ? 'grid' : 'list'}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          ListHeaderComponent={
            <View>
              <View style={styles.controlsCard}>
                <View style={styles.controlsTopRow}>
                  <View style={styles.searchBar}>
                    <Search size={16} color="#9CA3AF" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search school, city..."
                      placeholderTextColor="#9CA3AF"
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: COLOR.primary }]}
                    onPress={() => navigation.navigate('AddSchool')}
                  >
                    <Plus size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
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
                </View>
              </View>
              <View style={styles.countBar}>
                <Text style={styles.countText}>{schools.length} Schools</Text>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setPage(1); fetchSchools(1, true); }}
              colors={[COLOR.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No schools found" subtitle="Try adjusting your search or filters" icon="🏫" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={COLOR.primary} /> : null}
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
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '700' },
  countBar: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: rf(12), color: '#6B7280', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },
  card: { marginBottom: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  schoolName: { flex: 1, fontSize: rf(15), fontWeight: '700', color: '#111827', marginRight: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 100 },
  priorityScore: { fontSize: rf(11), fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 8 },
  metaText: { fontSize: rf(12), color: '#9CA3AF' },
  metaDot: { fontSize: rf(12), color: '#D1D5DB' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: rf(12), color: '#6B7280' },
  lastVisit: { fontSize: rf(11), color: '#9CA3AF' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: rf(12), color: '#6B7280' },
});
