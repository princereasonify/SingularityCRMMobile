import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Users,
  MapPin,
  Monitor,
  LogOut,
  ChevronRight,
  Zap,
  School,
  AlertTriangle,
} from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { NotificationBell } from '../../components/common/NotificationBell';
import { LogoutModal } from '../../components/common/LogoutModal';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card, StatTile, SectionLabel } from '../../components/ui';
import { dashboardApi } from '../../api/dashboard';
import { FoDashboardDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/common/Avatar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ACTIVITY_COLORS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, formatTime } from '../../utils/formatting';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice, getCardWidth } from '../../utils/responsive';

export const FODashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const [showLogout, setShowLogout] = useState(false);
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;
  const [data, setData] = useState<FoDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const fetch = useCallback(async (p: 'today' | 'week' | 'month' = period) => {
    try {
      const res = await dashboardApi.getFODashboard(p);
      setData(res.data);
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetch(period); }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch(period);
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading dashboard..." />;

  const revenuePct = data ? Math.round((data.revenue / data.revenueTarget) * 100) : 0;
  const cols = twoWide ? 4 : 2;
  const cardW = getCardWidth(cols, 32 + (cols - 1) * 12);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <DrawerMenuButton />
            <Avatar initials={user?.avatar || 'FO'} color="rgba(255,255,255,0.9)" size={42} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Good morning 👋</Text>
              <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowLogout(true)}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roleTagRow}>
          <View style={styles.roleTag}>
            <Zap size={12} color="#8C5A2E" />
            <Text style={styles.roleText}>Field Officer</Text>
            {user?.zone && <Text style={styles.zoneText}> • {user.zone}</Text>}
          </View>
          <View style={styles.periodRow}>
            {([['today', 'Today'], ['week', 'Week'], ['month', 'Month']] as const).map(([p, label]) => (
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
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
      >
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <StatTile
            label="Revenue" value={formatCurrency(data?.revenue || 0)}
            sub={`${revenuePct}% of ${formatCurrency(data?.revenueTarget || 0)}`}
            icon={<TrendingUp size={15} color={T.accent} />} tint={T.accent} style={{ width: cardW }}
          />
          <StatTile
            label="Pipeline" value={String(data?.pipelineLeads || 0)}
            sub={formatCurrency(data?.pipelineValue || 0)}
            icon={<Users size={15} color={T.info} />} tint={T.info} style={{ width: cardW }}
          />
          <StatTile
            label="Visits / wk" value={String(data?.visitsThisWeek || 0)}
            sub={`of ${data?.visitsTargetWeekly || 15} target`}
            icon={<MapPin size={15} color="#8B5CF6" />} tint="#8B5CF6" style={{ width: cardW }}
          />
          <StatTile
            label="Demos / mo" value={String(data?.demosThisMonth || 0)}
            sub={`of ${data?.demosTargetMonthly || 8} target`}
            icon={<Monitor size={15} color={T.warning} />} tint={T.warning} style={{ width: cardW }}
          />
          <StatTile
            label="Deals Lost" value={String(data?.dealsLost || 0)}
            sub="Stage = Lost"
            icon={<AlertTriangle size={15} color={T.danger} />} tint={T.danger} style={{ width: cardW }}
          />
        </View>

        {/* Assigned schools banner */}
        <Card onPress={() => navigation.navigate('AssignedSchools')} style={styles.banner}>
          <View style={[styles.bannerIcon, { backgroundColor: T.accentSoft }]}>
            <School size={22} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: T.text }]}>Today's Assigned Schools</Text>
            <Text style={[styles.bannerSub, { color: T.sub }]}>Map, route & geofence check-ins</Text>
          </View>
          <ChevronRight size={18} color={T.accent} />
        </Card>

        {/* Hot Leads */}
        {(data?.hotLeads?.length || 0) > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <SectionLabel style={{ marginBottom: 0 }}>🔥 Hot Leads</SectionLabel>
              <TouchableOpacity onPress={() => navigation.navigate('Leads')}>
                <Text style={[styles.seeAll, { color: T.accent }]}>See All</Text>
              </TouchableOpacity>
            </View>
            <Card padded={false}>
              {(data?.hotLeads || []).slice(0, 5).map((lead, i, arr) => (
                <TouchableOpacity
                  key={lead.id}
                  style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}
                  onPress={() => navigation.navigate('LeadDetail', { leadId: lead.id })}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.rowTitle, { color: T.text }]} numberOfLines={1}>{lead.school}</Text>
                    <Text style={[styles.rowMeta, { color: T.sub }]}>{lead.board} • {lead.city}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(lead.score) + '22' }]}>
                      <Text style={[styles.scoreText, { color: getScoreColor(lead.score) }]}>{lead.score}</Text>
                    </View>
                    <Text style={[styles.rowValue, { color: T.text }]}>{formatCurrency(lead.value)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        )}

        {/* Today's Tasks */}
        {(data?.todaysTasks?.length || 0) > 0 && (
          <View>
            <SectionLabel>📋 Today's Tasks</SectionLabel>
            <Card padded={false}>
              {(data?.todaysTasks || []).map((task, i, arr) => (
                <View key={task.id} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}>
                  <View style={[styles.taskType, { backgroundColor: (ACTIVITY_COLORS[task.type] || T.sub) + '22' }]}>
                    <Text style={[styles.taskTypeText, { color: ACTIVITY_COLORS[task.type] || T.sub }]}>{task.type}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: T.text }]} numberOfLines={1}>{task.school}</Text>
                    <Text style={[styles.rowMeta, { color: T.sub }]}>{formatTime(task.scheduledTime)}</Text>
                  </View>
                  <View style={[styles.taskDot, { backgroundColor: task.isDone ? T.success : T.line }]} />
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Recent Activities */}
        {(data?.recentActivities?.length || 0) > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <SectionLabel style={{ marginBottom: 0 }}>📌 Recent Activities</SectionLabel>
              <TouchableOpacity onPress={() => navigation.navigate('Activities')}>
                <Text style={[styles.seeAll, { color: T.accent }]}>See All</Text>
              </TouchableOpacity>
            </View>
            <Card padded={false}>
              {(data?.recentActivities || []).slice(0, 5).map((act, i, arr) => (
                <View key={act.id} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}>
                  <View style={[styles.actDot, { backgroundColor: ACTIVITY_COLORS[act.type] || T.sub }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: T.text }]} numberOfLines={1}>{act.school}</Text>
                    <Text style={[styles.rowMeta, { color: T.sub }]}>{act.type} • {act.outcome}</Text>
                  </View>
                  <Text style={[styles.rowMeta, { color: T.sub }]}>{formatRelativeDate(act.date)}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      <LogoutModal visible={showLogout} onCancel={() => setShowLogout(false)} onConfirm={() => { setShowLogout(false); setTimeout(logout, 350); }} />
    </View>
  );
};

const DEMO_DATA: FoDashboardDto = {
  revenue: 1450000,
  revenueTarget: 2000000,
  visitsThisWeek: 12,
  demosThisMonth: 4,
  dealsWon: 2,
  pipelineLeads: 8,
  pipelineValue: 3200000,
  hotLeads: [],
  todaysTasks: [],
  recentActivities: [],
  visitsTargetWeekly: 15,
  visitsTargetMonthly: 80,
  demosTargetMonthly: 8,
  followUpsTargetMonthly: 40,
  dealsTargetMonthly: 5,
  allowanceRatePerKm: 10,
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  greeting: { fontFamily: Fonts.regular, fontSize: rf(12), color: 'rgba(255,255,255,0.8)' },
  userName: { fontFamily: Fonts.bold, fontSize: rf(18), color: '#FFF', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  roleTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  roleTag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', gap: 4,
  },
  roleText: { fontFamily: Fonts.bold, fontSize: rf(12), color: '#8C5A2E' },
  zoneText: { fontFamily: Fonts.regular, fontSize: rf(12), color: '#6B5A3E' },
  periodRow: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 100, padding: 3 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  periodBtnActive: { backgroundColor: '#FFF' },
  periodText: { fontFamily: Fonts.medium, fontSize: rf(11.5), color: 'rgba(255,255,255,0.9)' },
  periodTextActive: { color: '#8C5A2E' },

  scroll: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontFamily: Fonts.bold, fontSize: rf(14) },
  bannerSub: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seeAll: { fontFamily: Fonts.medium, fontSize: rf(13) },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  rowTitle: { fontFamily: Fonts.medium, fontSize: rf(14) },
  rowMeta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  rowValue: { fontFamily: Fonts.bold, fontSize: rf(13) },
  scoreBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  scoreText: { fontFamily: Fonts.bold, fontSize: rf(12) },
  taskType: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  taskTypeText: { fontFamily: Fonts.medium, fontSize: rf(11) },
  taskDot: { width: 10, height: 10, borderRadius: 5 },
  actDot: { width: 8, height: 8, borderRadius: 4 },
});
