import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Navigation, Eye } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../api/dashboard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { FoPerformanceDto } from '../../types';

function fmt(v: number) {
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
}

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  'On Track':        { border: '#10B981', bg: '#D1FAE5', text: '#059669' },
  'At Risk':         { border: '#F59E0B', bg: '#FEF3C7', text: '#D97706' },
  'Underperforming': { border: '#EF4444', bg: '#FEE2E2', text: '#DC2626' },
};

function FOCard({ fo, navigation }: { fo: FoPerformanceDto; navigation?: any }) {
  const sc = STATUS_COLORS[fo.status] || STATUS_COLORS['On Track'];
  const pct = Math.min(100, fo.targetPct || 0);

  return (
    <View style={[fc.card, { borderLeftColor: sc.border }]}>
      {/* Name + Status */}
      <View style={fc.top}>
        <View style={fc.avatarWrap}>
          <Text style={fc.avatarText}>{fo.avatar || (fo.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fc.name}>{fo.name}</Text>
          <Text style={fc.territory}>{fo.territory || fo.zone || 'No territory assigned'}</Text>
        </View>
        <View style={[fc.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[fc.statusText, { color: sc.text }]}>{fo.status}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={fc.stats}>
        {[
          { label: 'Revenue', value: fmt(fo.revenue), sub: `${fo.targetPct}%` },
          { label: 'Visits/Wk', value: String(fo.visitsWeek), warn: (fo.visitsWeek || 0) < 15 },
          { label: 'Deals Won', value: String(fo.dealsWon) },
        ].map(({ label, value, sub, warn }) => (
          <View key={label} style={fc.statCell}>
            <Text style={[fc.statVal, warn && { color: '#D97706' }]}>{value}</Text>
            {sub ? <Text style={fc.statSub}>{sub}</Text> : null}
            <Text style={fc.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Progress */}
      <View style={fc.progressRow}>
        <Text style={fc.progressLabel}>Target Progress</Text>
        <Text style={fc.progressPct}>{pct}%</Text>
      </View>
      <View style={fc.progressBg}>
        <View style={[fc.progressFill, {
          width: `${pct}%`,
          backgroundColor: pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444',
        }]} />
      </View>

      {/* Actions */}
      <View style={fc.actionRow}>
        <TouchableOpacity
          style={fc.actionBtn}
          onPress={() => navigation?.navigate('SchoolsList', { assignedTo: fo.foId })}
        >
          <Navigation size={13} color="#7C3AED" />
          <Text style={[fc.actionText, { color: '#7C3AED' }]}>Assign Schools</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[fc.actionBtn, { backgroundColor: '#F9FAFB' }]}
          onPress={() => navigation?.navigate('LeadsList', { foId: fo.foId })}
        >
          <Eye size={13} color="#374151" />
          <Text style={[fc.actionText, { color: '#374151' }]}>View Leads</Text>
        </TouchableOpacity>
        {fo.status === 'Underperforming' && (
          <View style={[fc.actionBtn, { backgroundColor: '#FEE2E2', flex: 0, paddingHorizontal: 10 }]}>
            <AlertTriangle size={13} color="#DC2626" />
          </View>
        )}
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 14, borderLeftWidth: 4, marginBottom: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: rf(16), fontWeight: '700', color: '#7C3AED' },
  name: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  territory: { fontSize: rf(12), color: '#6B7280', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusText: { fontSize: rf(11), fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statCell: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: rf(15), fontWeight: '800', color: '#111827' },
  statSub: { fontSize: rf(11), color: '#0D9488', fontWeight: '700' },
  statLabel: { fontSize: rf(10), color: '#9CA3AF', marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: rf(12), color: '#6B7280', fontWeight: '500' },
  progressPct: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  progressBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 6, borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: '#EDE9FE', borderRadius: 10 },
  actionText: { fontSize: rf(12), fontWeight: '600' },
});

export const TeamManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'ZH';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const [foList, setFoList] = useState<FoPerformanceDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getTeamPerformance()
      .then(res => setFoList(res.data || []))
      .catch(() => Alert.alert('Error', 'Failed to load team data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading team..." />;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>Team Management</Text>
          <Text style={s.pageSub}>{foList.length} Field Officer{foList.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { label: 'On Track', color: '#10B981' },
          { label: 'At Risk', color: '#F59E0B' },
          { label: 'Underperforming', color: '#EF4444' },
        ].map(({ label, color }) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {foList.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👥</Text>
          <Text style={s.emptyText}>No team data available</Text>
        </View>
      ) : (
        <FlatList
          data={foList}
          keyExtractor={item => String(item.foId)}
          renderItem={({ item }) => <FOCard fo={item} navigation={navigation} />}
          contentContainerStyle={s.list}
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: rf(11), color: '#6B7280', fontWeight: '500' },
  list: { padding: 14, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF' },
});
