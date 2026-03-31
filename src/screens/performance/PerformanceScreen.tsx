import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { dashboardApi } from '../../api/dashboard';
import { UserPerformanceDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, RoleBadge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { KPICard } from '../../components/common/KPICard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, getStatusColor, getProgressColor } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatting';
import { rf, getCardWidth } from '../../utils/responsive';

const LABEL_MAP: Record<string, string> = {
  FO: 'My Performance',
  ZH: 'FO Performance',
  RH: 'ZH Performance',
  SH: 'RH Performance',
};

export const PerformanceScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [data, setData] = useState<UserPerformanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await dashboardApi.getPerformanceTracking();
      setData(Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const myData = role === 'FO' ? data.find((d) => d.userId === user?.id) : null;
  const teamData = role === 'FO' ? [] : data;

  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <DrawerMenuButton />
          <Text style={styles.headerTitle}>{LABEL_MAP[role] || 'Performance'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLOR.primary]} />}
      >
        {/* FO Self View */}
        {role === 'FO' && myData && (
          <>
            <View style={styles.kpiGrid}>
              <KPICard title="Total Leads" value={String(myData.totalLeads)} subtitle={`${myData.activeLeads} active`} style={{ width: cardW }} icon={<Text>📋</Text>} />
              <KPICard title="Deals Won" value={String(myData.wonLeads)} subtitle={`${myData.winRate}% win rate`} style={{ width: cardW }} icon={<Text>🏆</Text>} />
              <KPICard title="Revenue" value={formatCurrency(myData.revenue)} subtitle={`${myData.targetPct}% of target`} progress={myData.targetPct} progressColor={COLOR.primary} style={{ width: cardW }} icon={<Text>💰</Text>} />
              <KPICard title="Activities" value={String(myData.totalActivities)} subtitle={`${myData.visitsThisMonth} visits`} style={{ width: cardW }} icon={<Text>📌</Text>} />
            </View>
            <Card style={styles.section}>
              <View style={styles.performRow}>
                <Avatar initials={user?.avatar || 'FO'} color={COLOR.primary} size={48} />
                <View style={styles.performInfo}>
                  <Text style={styles.performName}>{myData.name}</Text>
                  <View style={styles.roleRow}>
                    <RoleBadge role={myData.role} />
                    {myData.zone && <Text style={styles.zoneText}>{myData.zone}</Text>}
                  </View>
                </View>
                <Badge label={myData.status} color={getStatusColor(myData.status)} size="md" />
              </View>
              <ProgressBar value={myData.targetPct} height={8} showLabel style={{ marginTop: 12 }} />
            </Card>
          </>
        )}

        {/* Manager Team View */}
        {role !== 'FO' && (
          <>
            {/* Summary */}
            <View style={styles.kpiGrid}>
              <KPICard title="Team Members" value={String(teamData.length)} style={{ width: cardW }} icon={<Text>👥</Text>} />
              <KPICard title="On Track" value={String(teamData.filter((d) => d.status === 'On Track').length)} style={{ width: cardW }} icon={<Text>✅</Text>} />
              <KPICard title="At Risk" value={String(teamData.filter((d) => d.status === 'At Risk').length)} valueColor="#F59E0B" style={{ width: cardW }} icon={<Text>⚠️</Text>} />
              <KPICard title="Underperforming" value={String(teamData.filter((d) => d.status === 'Underperforming').length)} valueColor="#EF4444" style={{ width: cardW }} icon={<Text>🔴</Text>} />
            </View>

            {teamData.length === 0 ? (
              <EmptyState title="No team data" subtitle="Performance data not available" icon="📊" />
            ) : (
              teamData.map((member) => (
                <Card key={member.userId} style={styles.memberCard}>
                  <TouchableOpacity onPress={() => setExpanded(expanded === member.userId ? null : member.userId)}>
                    <View style={styles.memberRow}>
                      <Avatar initials={member.avatar} color={COLOR.primary} size={44} />
                      <View style={styles.memberInfo}>
                        <View style={styles.memberTopRow}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <RoleBadge role={member.role} />
                        </View>
                        {(member.zone || member.region) && (
                          <Text style={styles.memberZone}>{member.zone || member.region}</Text>
                        )}
                        <View style={styles.memberStats}>
                          <Text style={styles.statText}>{formatCurrency(member.revenue)}</Text>
                          <Text style={styles.statDot}>•</Text>
                          <Text style={styles.statText}>{member.totalLeads} leads</Text>
                          <Text style={styles.statDot}>•</Text>
                          <Text style={styles.statText}>{member.wonLeads} won</Text>
                        </View>
                        <ProgressBar value={member.targetPct} height={4} style={{ marginTop: 6, width: '90%' }} />
                      </View>
                      <View style={styles.memberRight}>
                        <Badge label={member.status} color={getStatusColor(member.status)} />
                        {expanded === member.userId ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {expanded === member.userId && (
                    <View style={styles.expandedSection}>
                      <View style={styles.expandedGrid}>
                        {[
                          { label: 'Total Leads', val: member.totalLeads },
                          { label: 'Active', val: member.activeLeads },
                          { label: 'Won', val: member.wonLeads },
                          { label: 'Lost', val: member.lostLeads },
                          { label: 'Win Rate', val: `${member.winRate}%` },
                          { label: 'Revenue', val: formatCurrency(member.revenue) },
                          { label: 'Target %', val: `${member.targetPct}%` },
                          { label: 'Activities', val: member.totalActivities },
                          { label: 'Visits/Mo', val: member.visitsThisMonth },
                          { label: 'Demos/Mo', val: member.demosThisMonth },
                        ].map(({ label, val }) => (
                          <View key={label} style={styles.expandedItem}>
                            <Text style={styles.expandedLabel}>{label}</Text>
                            <Text style={styles.expandedVal}>{val}</Text>
                          </View>
                        ))}
                      </View>
                      {member.leadsByStage && Object.keys(member.leadsByStage).length > 0 && (
                        <View style={styles.stageBreakdown}>
                          <Text style={styles.stageBreakdownTitle}>Leads by Stage</Text>
                          {Object.entries(member.leadsByStage).map(([stage, count]) => (
                            <View key={stage} style={styles.stageRow}>
                              <Text style={styles.stageKey}>{stage}</Text>
                              <View style={styles.stageBar}>
                                <View style={[styles.stageFill, { width: `${Math.min((count / member.totalLeads) * 100, 100)}%`, backgroundColor: COLOR.primary }]} />
                              </View>
                              <Text style={styles.stageCount}>{count}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </Card>
              ))
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  section: { padding: 16 },
  performRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  performInfo: { flex: 1 },
  performName: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  zoneText: { fontSize: rf(12), color: '#6B7280' },
  memberCard: { padding: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  memberInfo: { flex: 1 },
  memberTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontSize: rf(15), fontWeight: '600', color: '#111827' },
  memberZone: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  memberStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statText: { fontSize: rf(12), color: '#6B7280' },
  statDot: { color: '#D1D5DB', fontSize: rf(12) },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  expandedSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  expandedItem: { width: '28%' },
  expandedLabel: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  expandedVal: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  stageBreakdown: { marginTop: 8 },
  stageBreakdownTitle: { fontSize: rf(12), fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stageKey: { fontSize: rf(11), color: '#6B7280', width: 120 },
  stageBar: { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  stageFill: { height: '100%', borderRadius: 3 },
  stageCount: { fontSize: rf(12), fontWeight: '700', color: '#111827', width: 24, textAlign: 'right' },
});
