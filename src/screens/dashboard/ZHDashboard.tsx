import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, LogOut, CheckCircle, XCircle, Users, TrendingUp, Clock, Target } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
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
  'New/Contacted': '#9CA3AF',
  'Qualified': '#38BDF8',
  'Demo': '#818CF8',
  'Proposal': '#FBBF24',
  'Won': '#14B8A6',
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

  const fetch = useCallback(async () => {
    try {
      const res = await dashboardApi.getZoneDashboard();
      setData(res.data);
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Bell size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLogout(true)}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.zoneName}>{data?.zoneName || user?.zone || 'Zone'}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLOR.primary]} />}
      >
        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Zone Revenue MTD"
            value={formatCurrency(data?.revenueMTD || 0)}
            subtitle={`${data?.targetPct || 0}% of target`}
            progress={data?.targetPct || 0}
            progressColor={COLOR.primary}
            icon={<TrendingUp size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Active Pipeline"
            value={String(data?.activePipeline || 0)}
            subtitle="Leads in progress"
            icon={<Users size={16} color="#3B82F6" />}
            iconBg="#EFF6FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Pending Approvals"
            value={String(data?.pendingApprovals || 0)}
            subtitle="Action required"
            icon={<Clock size={16} color="#F59E0B" />}
            iconBg="#FFFBEB"
            valueColor={data?.pendingApprovals ? '#F59E0B' : '#111827'}
            style={{ width: cardW }}
          />
          <KPICard
            title="Win Rate"
            value={`${data?.winRate || 0}%`}
            subtitle={`${data?.atRiskFOs || 0} at-risk FOs`}
            icon={<Target size={16} color="#22C55E" />}
            iconBg="#F0FDF4"
            style={{ width: cardW }}
          />
        </View>

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
            {(data?.pipelineFunnel || PIPELINE_STAGES).map((item) => {
              const maxCount = Math.max(...(data?.pipelineFunnel || PIPELINE_STAGES).map((s) => s.count), 1);
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
                    <Text style={styles.foStat}>{fo.visitsWeek} visits/wk</Text>
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
  zoneName: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
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
});
