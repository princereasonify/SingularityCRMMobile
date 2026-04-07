import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, CheckCircle, XCircle, Users, TrendingUp, Clock, Target, MapPin, Monitor, AlertTriangle, BarChart2 } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { NotificationBell } from '../../components/common/NotificationBell';
import { LogoutModal } from '../../components/common/LogoutModal';
import { dashboardApi } from '../../api/dashboard';
import { dealsApi } from '../../api/deals';
import { ZoneDashboardDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { KPICard } from '../../components/common/KPICard';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, getStatusColor, getProgressColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, formatDate } from '../../utils/formatting';
import { rf, getCardWidth } from '../../utils/responsive';

const COLOR = ROLE_COLORS.ZH;

const PIPELINE_STAGES = [
  { stage: 'New/Contacted', count: 7 },
  { stage: 'Qualified', count: 9 },
  { stage: 'Demo', count: 6 },
  { stage: 'Proposal', count: 4 },
  { stage: 'Won', count: 2 },
];

const STAGE_COLORS: Record<string, string> = {
  'New Lead': '#9CA3AF',
  'New/Contacted': '#9CA3AF',
  'Contacted': '#9CA3AF',
  'Qualified': '#38BDF8',
  'Demo': '#818CF8',
  'Proposal': '#FBBF24',
  'Negotiation': '#F97316',
  'Won': '#14B8A6',
};

const RISK_COLORS: Record<string, string> = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#22C55E',
};

export const ZHDashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const [data, setData] = useState<ZoneDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  const fetch = useCallback(async (p: 'today' | 'week' | 'month' = period) => {
    try {
      const res = await dashboardApi.getZoneDashboard(p);
      setData(res.data);
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetch(period); }, [period]);

  const handleApprove = async (dealId: number, approved: boolean) => {
    if (approved) {
      Alert.alert('Approve Deal', 'Confirm approval?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setApproving(dealId);
            try {
              await dealsApi.approveDeal(dealId, true, 'Approved');
              fetch();
            } catch { Alert.alert('Error', 'Failed to approve deal'); }
            setApproving(null);
          },
        },
      ]);
    } else {
      Alert.prompt?.('Reject Deal', 'Enter rejection reason:', async (note) => {
        setApproving(dealId);
        try {
          await dealsApi.approveDeal(dealId, false, note || 'Rejected');
          fetch();
        } catch { Alert.alert('Error', 'Failed to reject deal'); }
        setApproving(null);
      });
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading zone data..." />;

  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <DrawerMenuButton />
            <Avatar initials={user?.avatar || 'ZH'} color="#FFF" size={42} />
            <View>
              <Text style={styles.greeting}>Zone Head</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLogout(true)}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.zoneName}>{data?.zoneName || user?.zone || 'Zone'}</Text>
          <View style={styles.periodRow}>
            {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as const).map(([p, label]) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(period); }} colors={[COLOR.primary]} />}
      >
        {/* KPIs - Row 1 */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Zone Revenue MTD"
            value={formatCurrency(data?.revenueMTD || 0)}
            subtitle={`${data?.targetPct || 0}% of ${formatCurrency(data?.revenueTarget || 0)}`}
            progress={data?.targetPct || 0}
            progressColor={COLOR.primary}
            icon={<TrendingUp size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Pipeline Value"
            value={formatCurrency(data?.pipelineValue || data?.activePipeline || 0)}
            subtitle={`${data?.activePipeline || 0} active leads`}
            icon={<Users size={16} color="#3B82F6" />}
            iconBg="#EFF6FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Pending Approvals"
            value={String(data?.pendingApprovals || 0)}
            subtitle={(data?.pendingDeals?.length || 0) > 0 ? 'Action required' : 'All clear'}
            icon={<Clock size={16} color="#F59E0B" />}
            iconBg="#FFFBEB"
            valueColor={data?.pendingApprovals ? '#F59E0B' : '#111827'}
            style={{ width: cardW }}
          />
          <KPICard
            title="Zone Win Rate"
            value={`${data?.winRate || 0}%`}
            subtitle="Month to date"
            progress={data?.winRate || 0}
            progressColor="#14B8A6"
            icon={<Target size={16} color="#22C55E" />}
            iconBg="#F0FDF4"
            style={{ width: cardW }}
          />
        </View>
        {/* Activity Row */}
        {(data?.visitsThisMonth !== undefined || data?.demosThisMonth !== undefined) && (
          <View style={styles.kpiGrid}>
            <KPICard
              title="Visits This Month"
              value={String(data?.visitsThisMonth || 0)}
              subtitle={`/ ${data?.visitsTargetMonthly || 0} target`}
              icon={<MapPin size={16} color="#8B5CF6" />}
              iconBg="#F5F3FF"
              style={{ width: cardW }}
            />
            <KPICard
              title="Demos This Month"
              value={String(data?.demosThisMonth || 0)}
              subtitle={`/ ${data?.demosTargetMonthly || 0} target`}
              icon={<Monitor size={16} color="#F59E0B" />}
              iconBg="#FFFBEB"
              style={{ width: cardW }}
            />
            <KPICard
              title="Total FOs"
              value={String(data?.totalFOs || 0)}
              subtitle="In your zone"
              icon={<Users size={16} color="#22C55E" />}
              iconBg="#F0FDF4"
              style={{ width: cardW }}
            />
            <KPICard
              title="At Risk FOs"
              value={String(data?.atRiskFOs || 0)}
              subtitle="Need attention"
              icon={<AlertTriangle size={16} color="#EF4444" />}
              iconBg="#FEF2F2"
              valueColor={data?.atRiskFOs ? '#EF4444' : '#111827'}
              style={{ width: cardW }}
            />
            <KPICard
              title="Deals Lost"
              value={String(data?.dealsLost || 0)}
              subtitle="Stage = Lost"
              icon={<AlertTriangle size={16} color="#EF4444" />}
              iconBg="#FEF2F2"
              valueColor="#EF4444"
              style={{ width: cardW }}
            />
          </View>
        )}

        {/* Pending Deal Approvals */}
        {(data?.pendingDeals?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Pending Deal Approvals</Text>
            {(data?.pendingDeals || []).map((deal) => (
              <View key={deal.id} style={styles.dealCard}>
                <View style={styles.dealHeader}>
                  <View style={styles.dealInfo}>
                    <Text style={styles.dealSchool} numberOfLines={1}>{deal.school}</Text>
                    <Text style={styles.dealFO}>by {deal.foName}</Text>
                  </View>
                  <View style={styles.dealValues}>
                    <Text style={styles.dealValue}>{formatCurrency(deal.finalValue)}</Text>
                    <Badge label={`${deal.discount}% off`} color="#F59E0B" />
                  </View>
                </View>
                <Text style={styles.dealDate}>Submitted {formatRelativeDate(deal.submittedAt)}</Text>
                <View style={styles.dealActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#22C55E' }]}
                    onPress={() => handleApprove(deal.id, true)}
                    disabled={approving === deal.id}
                  >
                    <CheckCircle size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleApprove(deal.id, false)}
                    disabled={approving === deal.id}
                  >
                    <XCircle size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Zone Pipeline Funnel */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Zone Pipeline Funnel (All FOs)</Text>
          <View style={styles.funnelContainer}>
            {(data?.conversionFunnel || data?.pipelineFunnel || PIPELINE_STAGES).map((item) => {
              const funnelData = data?.conversionFunnel || data?.pipelineFunnel || PIPELINE_STAGES;
              const maxCount = Math.max(...funnelData.map((s) => s.count), 1);
              const barHeight = Math.max((item.count / maxCount) * 120, 8);
              const color = STAGE_COLORS[item.stage] || '#9CA3AF';
              return (
                <View key={item.stage} style={styles.funnelBar}>
                  <Text style={styles.funnelCount}>{item.count}</Text>
                  <View style={[styles.funnelFill, { height: barHeight, backgroundColor: color }]} />
                  <Text style={styles.funnelLabel} numberOfLines={2}>{item.stage}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* FO Leaderboard */}
        {(data?.foPerformance?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 FO Leaderboard</Text>
            {(data?.foPerformance || []).map((fo, idx) => (
              <View key={fo.foId} style={styles.foRow}>
                <Text style={styles.foRank}>{idx + 1 <= 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}`}</Text>
                <Avatar initials={fo.avatar} color={COLOR.primary} size={36} />
                <View style={styles.foInfo}>
                  <Text style={styles.foName}>{fo.name}</Text>
                  <View style={styles.foStats}>
                    <Text style={styles.foStat}>{formatCurrency(fo.revenue)}</Text>
                    <Text style={styles.foDot}>•</Text>
                    <Text style={[styles.foStat, { fontWeight: '700', color: fo.targetPct >= 70 ? '#14B8A6' : fo.targetPct >= 40 ? '#F59E0B' : '#EF4444' }]}>{fo.targetPct}%</Text>
                    <Text style={styles.foDot}>•</Text>
                    <Text style={[styles.foStat, { color: fo.visitsWeek >= 15 ? '#14B8A6' : fo.visitsWeek >= 10 ? '#F59E0B' : '#EF4444' }]}>{fo.visitsWeek} visits/wk</Text>
                  </View>
                  <ProgressBar value={fo.targetPct} height={4} style={{ marginTop: 4 }} />
                </View>
                <Badge
                  label={fo.status}
                  color={getStatusColor(fo.status)}
                  size="sm"
                />
              </View>
            ))}
          </Card>
        )}

        {/* Revenue Trend */}
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
                      <View style={[styles.bar, { height: `${pct}%` as any, backgroundColor: COLOR.primary }]} />
                    </View>
                    <Text style={styles.barLabel}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Aging Deals */}
        {(data?.agingDeals?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>⏰ Aging Deals</Text>
            {(data?.agingDeals || []).map((deal, idx) => (
              <View key={idx} style={styles.agingRow}>
                <View style={styles.agingInfo}>
                  <Text style={styles.agingSchool} numberOfLines={1}>{deal.school}</Text>
                  <Text style={styles.agingMeta}>{deal.stage} · {deal.daysInStage} days</Text>
                </View>
                <View style={styles.agingRight}>
                  <Text style={styles.agingValue}>{formatCurrency(deal.value)}</Text>
                  <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[deal.risk] + '22' }]}>
                    <Text style={[styles.riskText, { color: RISK_COLORS[deal.risk] }]}>{deal.risk}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
      <LogoutModal visible={showLogout} onCancel={() => setShowLogout(false)} onConfirm={() => { setShowLogout(false); logout(); }} />
    </SafeAreaView>
  );
};

const DEMO_DATA: ZoneDashboardDto = {
  zoneName: 'Mumbai West',
  revenueMTD: 5200000,
  revenueTarget: 8000000,
  targetPct: 65,
  activePipeline: 24,
  pendingApprovals: 3,
  winRate: 35,
  atRiskFOs: 1,
  pipelineFunnel: PIPELINE_STAGES,
  foPerformance: [],
  pendingDeals: [],
  pipelineValue: 2500000,
  totalFOs: 5,
  visitsThisMonth: 120,
  demosThisMonth: 18,
  callsThisMonth: 340,
  visitsTargetMonthly: 400,
  demosTargetMonthly: 140,
  callsTargetMonthly: 1000,
  conversionFunnel: [],
  agingDeals: [],
  revenueChart: [
    { label: 'Nov', value: 1200000 }, { label: 'Dec', value: 1800000 },
    { label: 'Jan', value: 2400000 }, { label: 'Feb', value: 2100000 },
    { label: 'Mar', value: 2700000 }, { label: 'Apr', value: 800000 },
  ],
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: rf(12), color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  zoneName: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  periodRow: { flexDirection: 'row', gap: 4 },
  periodBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  periodBtnActive: { backgroundColor: '#FFF' },
  periodText: { fontSize: rf(11), color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  periodTextActive: { color: COLOR.primary },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 14 },
  dealCard: {
    borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12,
    padding: 12, marginBottom: 10,
  },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dealInfo: { flex: 1, marginRight: 8 },
  dealSchool: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  dealFO: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  dealValues: { alignItems: 'flex-end', gap: 4 },
  dealValue: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  dealDate: { fontSize: rf(12), color: '#9CA3AF', marginBottom: 10 },
  dealActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  actionBtnText: { color: '#FFF', fontSize: rf(13), fontWeight: '600' },
  foRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  foRank: { fontSize: rf(16), width: 28, textAlign: 'center' },
  foInfo: { flex: 1 },
  foName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  foStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  foStat: { fontSize: rf(12), color: '#6B7280' },
  foDot: { color: '#D1D5DB' },
  funnelContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    height: 160,
    paddingTop: 8,
  },
  funnelBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  funnelCount: {
    fontSize: rf(14),
    fontWeight: '700',
    color: '#111827',
  },
  funnelFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    minHeight: 8,
  },
  funnelLabel: {
    fontSize: rf(10),
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 8 },
  barWrap: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 80, justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 4, alignSelf: 'center', minHeight: 4 },
  barLabel: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  barValue: { fontSize: rf(9), color: '#6B7280', marginBottom: 2 },
  agingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  agingInfo: { flex: 1 },
  agingSchool: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  agingMeta: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  agingRight: { alignItems: 'flex-end', gap: 4 },
  agingValue: { fontSize: rf(14), fontWeight: '700', color: '#374151' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  riskText: { fontSize: rf(11), fontWeight: '700' },
});
