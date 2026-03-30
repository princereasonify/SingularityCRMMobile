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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Users,
  MapPin,
  Monitor,
  Bell,
  LogOut,
  ChevronRight,
  Zap,
  School,
  Menu,
} from 'lucide-react-native';
import { dashboardApi } from '../../api/dashboard';
import { FoDashboardDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { KPICard } from '../../components/common/KPICard';
import { Badge, StageBadge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, ACTIVITY_COLORS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, formatTime } from '../../utils/formatting';
import { rf, isTablet, getNumColumns, getCardWidth } from '../../utils/responsive';

const COLOR = ROLE_COLORS.FO;

export const FODashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const [data, setData] = useState<FoDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await dashboardApi.getFODashboard();
      setData(res.data);
    } catch {
      // Use placeholder data for demo
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading dashboard..." />;

  const revenuePct = data ? Math.round((data.revenue / data.revenueTarget) * 100) : 0;
  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.toggleDrawer()}>
              <Menu size={20} color="#FFF" />
            </TouchableOpacity>
            <Avatar initials={user?.avatar || 'FO'} color="#FFF" size={42} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Good morning 👋</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={logout}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.roleTag}>
          <Zap size={12} color={COLOR.primary} />
          <Text style={[styles.roleText, { color: COLOR.primary }]}>Field Officer</Text>
          {user?.zone && (
            <Text style={styles.zoneText}> • {user.zone}</Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLOR.primary]} />}
      >
        {/* KPI Grid */}
        <View style={[styles.kpiGrid, { gap: 12 }]}>
          <KPICard
            title="Month Revenue"
            value={formatCurrency(data?.revenue || 0)}
            subtitle={`Target: ${formatCurrency(data?.revenueTarget || 0)}`}
            progress={revenuePct}
            progressColor={COLOR.primary}
            icon={<TrendingUp size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Pipeline Leads"
            value={String(data?.pipelineLeads || 0)}
            subtitle={formatCurrency(data?.pipelineValue || 0)}
            icon={<Users size={16} color="#3B82F6" />}
            iconBg="#EFF6FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Visits This Week"
            value={String(data?.visitsThisWeek || 0)}
            subtitle="GPS verified"
            icon={<MapPin size={16} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Demos This Month"
            value={String(data?.demosThisMonth || 0)}
            subtitle={`${data?.dealsWon || 0} deals won`}
            icon={<Monitor size={16} color="#F59E0B" />}
            iconBg="#FFFBEB"
            style={{ width: cardW }}
          />
        </View>

        {/* Today's Assigned Schools — quick-access banner */}
        <TouchableOpacity
          style={styles.schoolsBanner}
          onPress={() => navigation.navigate('AssignedSchools')}
          activeOpacity={0.85}
        >
          <View style={[styles.schoolsBannerIcon, { backgroundColor: COLOR.light }]}>
            <School size={22} color={COLOR.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolsBannerTitle}>Today's Assigned Schools</Text>
            <Text style={styles.schoolsBannerSub}>View map, route & geofence check-ins</Text>
          </View>
          <ChevronRight size={18} color={COLOR.primary} />
        </TouchableOpacity>

        {/* Hot Leads */}
        {(data?.hotLeads?.length || 0) > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Hot Leads</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Leads')}>
                <Text style={[styles.seeAll, { color: COLOR.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {(data?.hotLeads || []).slice(0, 5).map((lead) => (
              <TouchableOpacity
                key={lead.id}
                style={styles.leadRow}
                onPress={() => navigation.navigate('LeadDetail', { leadId: lead.id })}
              >
                <View style={styles.leadInfo}>
                  <Text style={styles.leadSchool} numberOfLines={1}>{lead.school}</Text>
                  <Text style={styles.leadMeta}>{lead.board} • {lead.city}</Text>
                </View>
                <View style={styles.leadRight}>
                  <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(lead.score) + '22' }]}>
                    <Text style={[styles.scoreText, { color: getScoreColor(lead.score) }]}>
                      {lead.score}
                    </Text>
                  </View>
                  <Text style={styles.leadValue}>{formatCurrency(lead.value)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Today's Tasks */}
        {(data?.todaysTasks?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Today's Tasks</Text>
            {(data?.todaysTasks || []).map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View
                  style={[
                    styles.taskType,
                    { backgroundColor: (ACTIVITY_COLORS[task.type] || '#6B7280') + '22' },
                  ]}
                >
                  <Text style={[styles.taskTypeText, { color: ACTIVITY_COLORS[task.type] || '#6B7280' }]}>
                    {task.type}
                  </Text>
                </View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskSchool} numberOfLines={1}>{task.school}</Text>
                  <Text style={styles.taskTime}>{formatTime(task.scheduledTime)}</Text>
                </View>
                <View style={[styles.taskDot, { backgroundColor: task.isDone ? '#22C55E' : '#E5E7EB' }]} />
              </View>
            ))}
          </Card>
        )}

        {/* Recent Activities */}
        {(data?.recentActivities?.length || 0) > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📌 Recent Activities</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Activities')}>
                <Text style={[styles.seeAll, { color: COLOR.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {(data?.recentActivities || []).slice(0, 5).map((act) => (
              <View key={act.id} style={styles.activityRow}>
                <View style={[styles.actDot, { backgroundColor: ACTIVITY_COLORS[act.type] || '#6B7280' }]} />
                <View style={styles.actInfo}>
                  <Text style={styles.actSchool} numberOfLines={1}>{act.school}</Text>
                  <Text style={styles.actMeta}>{act.type} • {act.outcome}</Text>
                </View>
                <Text style={styles.actDate}>{formatRelativeDate(act.date)}</Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
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
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  greeting: { fontSize: rf(12), color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  roleText: { fontSize: rf(12), fontWeight: '700' },
  zoneText: { fontSize: rf(12), color: '#6B7280' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  contentTablet: { padding: 24, gap: 20 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: rf(13), fontWeight: '600' },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  leadInfo: { flex: 1, marginRight: 8 },
  leadSchool: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  leadMeta: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  leadRight: { alignItems: 'flex-end', gap: 4 },
  scoreBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  scoreText: { fontSize: rf(12), fontWeight: '700' },
  leadValue: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskType: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  taskTypeText: { fontSize: rf(11), fontWeight: '600' },
  taskInfo: { flex: 1 },
  taskSchool: { fontSize: rf(14), fontWeight: '500', color: '#111827' },
  taskTime: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  taskDot: { width: 10, height: 10, borderRadius: 5 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actDot: { width: 8, height: 8, borderRadius: 4 },
  actInfo: { flex: 1 },
  actSchool: { fontSize: rf(14), fontWeight: '500', color: '#111827' },
  actMeta: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  actDate: { fontSize: rf(12), color: '#9CA3AF' },

  schoolsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, marginBottom: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  schoolsBannerIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  schoolsBannerTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  schoolsBannerSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
});
