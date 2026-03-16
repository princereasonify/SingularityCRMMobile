import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, LogOut, TrendingUp, Users, Award, BarChart2 } from 'lucide-react-native';
import { dashboardApi } from '../../api/dashboard';
import { RegionDashboardDto } from '../../types';
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

const COLOR = ROLE_COLORS.RH;

export const RHDashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const [data, setData] = useState<RegionDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await dashboardApi.getRegionDashboard();
      setData(res.data);
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading region data..." />;

  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Avatar initials={user?.avatar || 'RH'} color="#FFF" size={42} />
            <View>
              <Text style={styles.greeting}>Regional Head</Text>
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
        <Text style={styles.regionName}>{data?.regionName || user?.region || 'Region'}</Text>
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
            subtitle={`${data?.targetPct || 0}% of target`}
            progress={data?.targetPct || 0}
            progressColor={COLOR.primary}
            icon={<TrendingUp size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Active Leads"
            value={String(data?.activeLeads || 0)}
            subtitle="In pipeline"
            icon={<Users size={16} color="#3B82F6" />}
            iconBg="#EFF6FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Deals Won"
            value={String(data?.dealsWon || 0)}
            subtitle={`${data?.winRate || 0}% win rate`}
            icon={<Award size={16} color="#22C55E" />}
            iconBg="#F0FDF4"
            style={{ width: cardW }}
          />
          <KPICard
            title="Forecast Accuracy"
            value={`${data?.forecastAccuracy || 0}%`}
            subtitle="Revenue forecast"
            icon={<BarChart2 size={16} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            style={{ width: cardW }}
          />
        </View>

        {/* Zone Comparison */}
        {(data?.zones?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Zone Performance</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, { flex: 2 }]}>Zone</Text>
              <Text style={[styles.thCell, { flex: 1.5 }]}>Revenue</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Target %</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Health</Text>
            </View>
            {(data?.zones || []).map((zone) => (
              <View key={zone.id} style={styles.tableRow}>
                <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>{zone.name}</Text>
                <Text style={[styles.tdCell, { flex: 1.5 }]}>{formatCurrency(zone.revenue)}</Text>
                <View style={[{ flex: 1 }]}>
                  <Text style={[styles.tdCell, { color: getProgressColor(zone.targetPct) }]}>
                    {zone.targetPct}%
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Badge label={zone.health} color={getStatusColor(zone.health)} size="sm" />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Revenue Chart (simple bar) */}
        {(data?.revenueChart?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Revenue Trend</Text>
            <View style={styles.chartArea}>
              {(data?.revenueChart || []).map((point) => {
                const maxVal = Math.max(...(data?.revenueChart || []).map((p) => p.value));
                const pct = maxVal > 0 ? (point.value / maxVal) * 100 : 0;
                return (
                  <View key={point.label} style={styles.barWrap}>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${pct}%`, backgroundColor: COLOR.primary }]} />
                    </View>
                    <Text style={styles.barLabel}>{point.label}</Text>
                    <Text style={styles.barValue}>{formatCurrency(point.value)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const DEMO_DATA: RegionDashboardDto = {
  regionName: 'West',
  revenueMTD: 18500000,
  revenueTarget: 40000000,
  targetPct: 46,
  activeLeads: 84,
  dealsWon: 18,
  winRate: 38,
  forecastAccuracy: 72,
  zones: [],
  revenueChart: [
    { label: 'Oct', value: 12000000 }, { label: 'Nov', value: 15000000 },
    { label: 'Dec', value: 11000000 }, { label: 'Jan', value: 16000000 },
    { label: 'Feb', value: 14000000 }, { label: 'Mar', value: 18500000 },
  ],
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: rf(12), color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  regionName: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 14 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#F3F4F6', marginBottom: 4 },
  thCell: { fontSize: rf(11), fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  tdCell: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100, marginTop: 8 },
  barWrap: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 70, justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 4, alignSelf: 'center', minHeight: 4 },
  barLabel: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  barValue: { fontSize: rf(9), color: '#6B7280' },
});
