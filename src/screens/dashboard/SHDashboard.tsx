import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, LogOut, TrendingUp, Building2, DollarSign, Target } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { dashboardApi } from '../../api/dashboard';
import { NationalDashboardDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { KPICard } from '../../components/common/KPICard';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, getStatusColor, getProgressColor } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatting';
import { rf, getCardWidth } from '../../utils/responsive';

const COLOR = ROLE_COLORS.SH;

export const SHDashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const [data, setData] = useState<NationalDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'MTD' | 'QTD' | 'FY'>('MTD');

  const fetch = useCallback(async () => {
    try {
      const res = await dashboardApi.getNationalDashboard();
      setData(res.data);
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading national data..." />;

  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <DrawerMenuButton />
            <Avatar initials={user?.avatar || 'SH'} color="#FFF" size={42} />
            <View>
              <Text style={styles.greeting}>Sales Head</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Bell size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={logout}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Period Selector */}
        <View style={styles.periodRow}>
          {(['MTD', 'QTD', 'FY'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLOR.primary]} />}
      >
        <View style={styles.kpiGrid}>
          <KPICard
            title="Revenue MTD"
            value={formatCurrency(data?.revenueMTD || 0)}
            subtitle={`${data?.targetPct || 0}% of ₹20Cr target`}
            progress={data?.targetPct || 0}
            progressColor={COLOR.primary}
            icon={<DollarSign size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Schools Won"
            value={String(data?.schoolsWon || 0)}
            subtitle="This period"
            icon={<Building2 size={16} color="#22C55E" />}
            iconBg="#F0FDF4"
            style={{ width: cardW }}
          />
          <KPICard
            title="Pipeline Value"
            value={formatCurrency(data?.pipelineValue || 0)}
            subtitle="Active pipeline"
            icon={<TrendingUp size={16} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Win Rate"
            value={`${data?.winRate || 0}%`}
            subtitle="Deal conversion"
            icon={<Target size={16} color="#F59E0B" />}
            iconBg="#FFFBEB"
            style={{ width: cardW }}
          />
        </View>

        {/* Regional Scorecard */}
        {(data?.regions?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🗺️ Regional Scorecard</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={[styles.tableHeader, { width: tablet ? '100%' : 560 }]}>
                  {['Region', 'Revenue', 'Target %', 'Schools', 'Win Rate', 'Health'].map((h, i) => (
                    <Text key={h} style={[styles.thCell, i === 0 ? { flex: 2 } : { flex: 1.2 }]}>{h}</Text>
                  ))}
                </View>
                {(data?.regions || []).map((reg) => (
                  <View key={reg.id} style={[styles.tableRow, { width: tablet ? '100%' : 560 }]}>
                    <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>{reg.name}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{formatCurrency(reg.revenue)}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2, color: getProgressColor(reg.targetPct) }]}>{reg.targetPct}%</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{reg.schools}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{reg.winRate}%</Text>
                    <View style={{ flex: 1.2 }}>
                      <Badge label={reg.health} color={getStatusColor(reg.health)} size="sm" />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Revenue Chart */}
        {(data?.revenueChart?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Revenue Trend</Text>
            <View style={styles.chartArea}>
              {(data?.revenueChart || []).map((point) => {
                const maxVal = Math.max(...(data?.revenueChart || []).map((p) => p.value));
                const pct = maxVal > 0 ? (point.value / maxVal) * 100 : 0;
                return (
                  <View key={point.label} style={styles.barWrap}>
                    <Text style={styles.barValue}>{formatCurrency(point.value)}</Text>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${pct}%`, backgroundColor: COLOR.primary }]} />
                    </View>
                    <Text style={styles.barLabel}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Loss Reasons */}
        {(data?.lossReasons?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📉 Loss Reasons</Text>
            {(data?.lossReasons || []).map((lr) => {
              const total = (data?.lossReasons || []).reduce((s, r) => s + r.count, 0);
              const pct = total > 0 ? (lr.count / total) * 100 : 0;
              return (
                <View key={lr.reason} style={styles.lossRow}>
                  <Text style={styles.lossReason}>{lr.reason}</Text>
                  <ProgressBar value={pct} height={6} style={{ flex: 1, marginHorizontal: 12 }} color="#EF4444" />
                  <Text style={styles.lossCount}>{lr.count}</Text>
                </View>
              );
            })}
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const DEMO_DATA: NationalDashboardDto = {
  revenueMTD: 68000000,
  revenueTarget: 200000000,
  targetPct: 34,
  schoolsWon: 84,
  pipelineValue: 145000000,
  winRate: 33,
  regions: [],
  revenueChart: [
    { label: 'Oct', value: 42000000 }, { label: 'Nov', value: 55000000 },
    { label: 'Dec', value: 38000000 }, { label: 'Jan', value: 61000000 },
    { label: 'Feb', value: 52000000 }, { label: 'Mar', value: 68000000 },
  ],
  lossReasons: [
    { reason: 'Price', count: 12 }, { reason: 'Competitor', count: 8 },
    { reason: 'No Decision', count: 6 }, { reason: 'No Fit', count: 4 },
  ],
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: rf(12), color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  periodRow: { flexDirection: 'row', gap: 6 },
  periodBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  periodBtnActive: { backgroundColor: '#FFF' },
  periodText: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  periodTextActive: { color: COLOR.primary },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 14 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#F3F4F6' },
  thCell: { fontSize: rf(11), fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  tdCell: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barWrap: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 80, justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 4, alignSelf: 'center', minHeight: 4 },
  barLabel: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  barValue: { fontSize: rf(8), color: '#6B7280', marginBottom: 2 },
  lossRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  lossReason: { fontSize: rf(13), color: '#374151', width: 100 },
  lossCount: { fontSize: rf(13), fontWeight: '700', color: '#EF4444', width: 24, textAlign: 'right' },
});
