import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Filter, Grid3X3 } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, StageBadge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ROLE_COLORS, STAGE_COLORS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, isOverdue } from '../../utils/formatting';
import { rf, isTablet } from '../../utils/responsive';

const FILTERS = ['All', 'Active', 'Hot', 'Won', 'Unassigned'];

export const LeadsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLeads = useCallback(async (pg = 1, reset = false) => {
    try {
      const stage = filter === 'Won' ? 'Won' : undefined;
      const res = await leadsApi.getLeads({ page: pg, pageSize: 20, search: search || undefined, stage });
      const items = res.data.items;
      let filtered = items;
      if (filter === 'Active') filtered = items.filter(l => !['Won', 'Lost'].includes(l.stage));
      if (filter === 'Hot') filtered = items.filter(l => l.score >= 70);
      if (filter === 'Unassigned') filtered = items.filter(l => !l.foId);
      if (reset) setLeads(filtered);
      else setLeads((prev) => [...prev, ...filtered]);
      setTotalPages(res.data.totalPages);
    } catch {
      if (reset) setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchLeads(1, true);
  }, [search, filter]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchLeads(next, false);
    }
  };

  const renderLead = ({ item }: { item: LeadListDto }) => {
    const overdue = isOverdue(item.lastActivityDate, 5);
    return (
      <Card style={tablet ? { ...styles.leadCard, ...styles.leadCardTablet } : styles.leadCard} onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}>
        <View style={styles.leadHeader}>
          <View style={styles.leadTitleRow}>
            {overdue && !['Won', 'Lost'].includes(item.stage) && (
              <View style={styles.overdueIndicator} />
            )}
            <Text style={styles.leadSchool} numberOfLines={2}>{item.school}</Text>
          </View>
          <StageBadge stage={item.stage} />
        </View>
        <View style={styles.leadMeta}>
          <Text style={styles.metaText}>{item.board}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.city}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.type}</Text>
        </View>
        <View style={styles.leadFooter}>
          <View style={styles.footerLeft}>
            <Text style={styles.leadValue}>{formatCurrency(item.value)}</Text>
            {item.foName && role !== 'FO' && (
              <Text style={styles.foName} numberOfLines={1}>👤 {item.foName}</Text>
            )}
          </View>
          <View style={styles.footerRight}>
            <View style={[styles.scorePill, { backgroundColor: getScoreColor(item.score) + '22' }]}>
              <Text style={[styles.scoreText, { color: getScoreColor(item.score) }]}>{item.score}</Text>
            </View>
            {item.lastActivityDate && (
              <Text style={styles.lastActivity}>{formatRelativeDate(item.lastActivityDate)}</Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Leads</Text>
          <View style={styles.headerActions}>
            {role !== 'FO' && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddLead')}>
                <Plus size={20} color="#FFF" />
              </TouchableOpacity>
            )}
            {role === 'FO' && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddLead')}>
                <Plus size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search school, city, contact..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
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
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading leads..." />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLead}
          contentContainerStyle={[styles.list, leads.length === 0 && styles.listEmpty]}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? styles.columnWrapper : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPage(1); fetchLeads(1, true); }} colors={[COLOR.primary]} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No leads found" subtitle="Try adjusting your search or filters" icon="📋" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={COLOR.primary} /> : null}
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
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10 },
  leadCard: { marginBottom: 2 },
  leadCardTablet: { flex: 1 },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  leadTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginRight: 8 },
  overdueIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginTop: 5 },
  leadSchool: { flex: 1, fontSize: rf(15), fontWeight: '700', color: '#111827' },
  leadMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: rf(12), color: '#9CA3AF' },
  metaDot: { fontSize: rf(12), color: '#D1D5DB' },
  leadFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { gap: 2 },
  leadValue: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  foName: { fontSize: rf(12), color: '#6B7280' },
  footerRight: { alignItems: 'flex-end', gap: 4 },
  scorePill: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: rf(12), fontWeight: '700' },
  lastActivity: { fontSize: rf(11), color: '#9CA3AF' },
});
