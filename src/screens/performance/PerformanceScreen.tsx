import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown, ChevronUp, Users, Award, TrendingUp, Activity,
  CheckCircle, AlertTriangle, AlertCircle,
} from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { GradientBackground } from '../../components/common/GradientBackground';
import { dashboardApi } from '../../api/dashboard';
import { UserPerformanceDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, StatTile, Badge, SectionLabel } from '../../components/ui';
import { RoleBadge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { getStatusColor } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatting';
import { rf, isTabletDevice, getCardWidth } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

const LABEL_MAP: Record<string, string> = {
  FO: 'My Performance',
  ZH: 'FO Performance',
  RH: 'ZH Performance',
  SH: 'RH Performance',
};

export const PerformanceScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

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

  const cols = twoWide ? 4 : 2;
  const cardW = getCardWidth(cols, 32 + (cols - 1) * 12);

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading performance..." />;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <DrawerMenuButton />
          <Text style={styles.headerTitle}>{LABEL_MAP[role] || 'Performance'}</Text>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={T.accent} />}
      >
        {/* FO Self View */}
        {role === 'FO' && myData && (
          <>
            <View style={styles.kpiGrid}>
              <StatTile
                label="Total Leads" value={String(myData.totalLeads)}
                sub={`${myData.activeLeads} active`}
                icon={<Users size={15} color={T.info} />} tint={T.info} style={{ width: cardW }}
              />
              <StatTile
                label="Deals Won" value={String(myData.wonLeads)}
                sub={`${myData.winRate}% win rate`}
                icon={<Award size={15} color={T.success} />} tint={T.success} style={{ width: cardW }}
              />
              <StatTile
                label="Revenue" value={formatCurrency(myData.revenue)}
                sub={`${myData.targetPct}% of target`}
                icon={<TrendingUp size={15} color={T.accent} />} tint={T.accent} style={{ width: cardW }}
              />
              <StatTile
                label="Activities" value={String(myData.totalActivities)}
                sub={`${myData.visitsThisMonth} visits`}
                icon={<Activity size={15} color={T.warning} />} tint={T.warning} style={{ width: cardW }}
              />
            </View>

            <Card>
              <View style={styles.performRow}>
                <Avatar initials={user?.avatar || 'FO'} color={T.accent} size={48} />
                <View style={styles.performInfo}>
                  <Text style={[styles.performName, { color: T.text }]}>{myData.name}</Text>
                  <View style={styles.roleRow}>
                    <RoleBadge role={myData.role} />
                    {myData.zone && <Text style={[styles.zoneText, { color: T.sub }]}>{myData.zone}</Text>}
                  </View>
                </View>
                <Badge label={myData.status} color={getStatusColor(myData.status)} />
              </View>
              <ProgressBar value={myData.targetPct} height={8} showLabel color={T.accent} trackColor={T.cardAlt} style={{ marginTop: 12 }} />
            </Card>
          </>
        )}

        {/* Manager Team View */}
        {role !== 'FO' && (
          <>
            {/* Summary */}
            <View style={styles.kpiGrid}>
              <StatTile
                label="Team Members" value={String(teamData.length)}
                icon={<Users size={15} color={T.accent} />} tint={T.accent} style={{ width: cardW }}
              />
              <StatTile
                label="On Track" value={String(teamData.filter((d) => d.status === 'On Track').length)}
                icon={<CheckCircle size={15} color={T.success} />} tint={T.success} style={{ width: cardW }}
              />
              <StatTile
                label="At Risk" value={String(teamData.filter((d) => d.status === 'At Risk').length)}
                icon={<AlertTriangle size={15} color={T.warning} />} tint={T.warning} style={{ width: cardW }}
              />
              <StatTile
                label="Underperforming" value={String(teamData.filter((d) => d.status === 'Underperforming').length)}
                icon={<AlertCircle size={15} color={T.danger} />} tint={T.danger} style={{ width: cardW }}
              />
            </View>

            {teamData.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={[styles.emptyTitle, { color: T.text }]}>No team data</Text>
                <Text style={[styles.emptySub, { color: T.sub }]}>Performance data not available</Text>
              </View>
            ) : (
              teamData.map((member) => (
                <Card key={member.userId}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(expanded === member.userId ? null : member.userId)}>
                    <View style={styles.memberRow}>
                      <Avatar initials={member.avatar} color={T.accent} size={44} />
                      <View style={styles.memberInfo}>
                        <View style={styles.memberTopRow}>
                          <Text style={[styles.memberName, { color: T.text }]}>{member.name}</Text>
                          <RoleBadge role={member.role} />
                        </View>
                        {(member.zone || member.region) && (
                          <Text style={[styles.memberZone, { color: T.sub }]}>{member.zone || member.region}</Text>
                        )}
                        <View style={styles.memberStats}>
                          <Text style={[styles.statText, { color: T.sub }]}>{formatCurrency(member.revenue)}</Text>
                          <Text style={[styles.statDot, { color: T.dim }]}>•</Text>
                          <Text style={[styles.statText, { color: T.sub }]}>{member.totalLeads} leads</Text>
                          <Text style={[styles.statDot, { color: T.dim }]}>•</Text>
                          <Text style={[styles.statText, { color: T.sub }]}>{member.wonLeads} won</Text>
                        </View>
                        <ProgressBar value={member.targetPct} height={4} color={T.accent} trackColor={T.cardAlt} style={{ marginTop: 6, width: '90%' }} />
                      </View>
                      <View style={styles.memberRight}>
                        <Badge label={member.status} color={getStatusColor(member.status)} />
                        {expanded === member.userId ? <ChevronUp size={16} color={T.dim} /> : <ChevronDown size={16} color={T.dim} />}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {expanded === member.userId && (
                    <View style={[styles.expandedSection, { borderTopColor: T.line }]}>
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
                            <Text style={[styles.expandedLabel, { color: T.dim }]}>{label}</Text>
                            <Text style={[styles.expandedVal, { color: T.text }]}>{val}</Text>
                          </View>
                        ))}
                      </View>
                      {member.leadsByStage && Object.keys(member.leadsByStage).length > 0 && (
                        <View style={styles.stageBreakdown}>
                          <SectionLabel>Leads by Stage</SectionLabel>
                          {Object.entries(member.leadsByStage).map(([stage, count]) => (
                            <View key={stage} style={styles.stageRow}>
                              <Text style={[styles.stageKey, { color: T.sub }]}>{stage}</Text>
                              <View style={[styles.stageBar, { backgroundColor: T.cardAlt }]}>
                                <View style={[styles.stageFill, { width: `${Math.min((count / member.totalLeads) * 100, 100)}%`, backgroundColor: T.accent }]} />
                              </View>
                              <Text style={[styles.stageCount, { color: T.text }]}>{count}</Text>
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

        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  scroll: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  performRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  performInfo: { flex: 1 },
  performName: { fontFamily: Fonts.bold, fontSize: rf(16) },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  zoneText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  memberRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  memberInfo: { flex: 1 },
  memberTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontFamily: Fonts.medium, fontSize: rf(15) },
  memberZone: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  memberStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  statDot: { fontSize: rf(12) },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  expandedSection: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  expandedItem: { width: '28%' },
  expandedLabel: { fontFamily: Fonts.medium, fontSize: rf(10), textTransform: 'uppercase', marginBottom: 2 },
  expandedVal: { fontFamily: Fonts.bold, fontSize: rf(14) },
  stageBreakdown: { marginTop: 8 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stageKey: { fontFamily: Fonts.regular, fontSize: rf(11), width: 120 },
  stageBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  stageFill: { height: '100%', borderRadius: 3 },
  stageCount: { fontFamily: Fonts.bold, fontSize: rf(12), width: 24, textAlign: 'right' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  emptyIcon: { fontSize: 48, marginBottom: 6 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: rf(16) },
  emptySub: { fontFamily: Fonts.regular, fontSize: rf(13), textAlign: 'center' },
});
