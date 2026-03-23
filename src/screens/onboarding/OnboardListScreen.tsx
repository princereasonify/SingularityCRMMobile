import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingApi } from '../../api/onboarding';
import { OnboardAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'InProgress', 'Completed', 'OnHold', 'Assigned'];

const STATUS_COLORS: Record<string, string> = {
  Assigned: '#F59E0B', InProgress: '#2563EB', Completed: '#16A34A',
  OnHold: '#9CA3AF', Cancelled: '#DC2626',
};

export const OnboardListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [items, setItems] = useState<OnboardAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');

  const fetchItems = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'All') params.status = filter;
      const res = await onboardingApi.getAll(params);
      const data: OnboardAssignment[] = (res.data as any)?.items ?? res.data ?? [];
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [filter]);

  const renderItem = ({ item }: { item: OnboardAssignment }) => (
    <Card
      style={tablet ? { flex: 1 } : undefined}
      onPress={() => navigation.navigate('OnboardDetail', { onboardId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.schoolName} numberOfLines={1}>{item.schoolName}</Text>
        <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
      </View>
      <Text style={styles.assignedTo}>👤 {item.assignedToName}</Text>
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressPct}>{item.completionPercentage}%</Text>
        </View>
        <ProgressBar value={item.completionPercentage} color={COLOR.primary} />
      </View>
      {item.scheduledEndDate && (
        <Text style={styles.deadline}>
          {item.completionPercentage === 100 ? '✅' : '📅'} Due {formatDate(item.scheduledEndDate)}
        </Text>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <Text style={styles.headerTitle}>Onboarding</Text>
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
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, items.length === 0 && { flex: 1 }]}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchItems(); }}
              colors={[COLOR.primary]}
            />
          }
          ListEmptyComponent={<EmptyState title="No onboarding tasks" subtitle="Assigned tasks will appear here" icon="📋" />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  schoolName: { fontSize: rf(15), fontWeight: '700', color: '#111827', flex: 1 },
  assignedTo: { fontSize: rf(13), color: '#6B7280', marginBottom: 10 },
  progressSection: { gap: 4, marginBottom: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: rf(12), color: '#6B7280' },
  progressPct: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  deadline: { fontSize: rf(12), color: '#9CA3AF' },
});
