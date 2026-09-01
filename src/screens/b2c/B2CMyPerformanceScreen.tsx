import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Target, TrendingUp, CheckCircle, Clock, Award } from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel, Badge } from '../../components/ui';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { FEEDBACK_TYPES } from '../../api/b2c/b2cObjectionService';
import {
  B2CAgentDashboardDto,
  B2CCounselorDashboardDto,
  B2CActivityListDto,
  StageFunnelItem,
} from '../../types/b2c';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { todayStr, shortDate } from '../../utils/dates';
import { label } from '../../utils/labels';

/**
 * B2CMyPerformanceScreen — read-only "My Performance" for the signed-in agent / counselor.
 * Mirrors web B2CMyPerformance.jsx: role-gated KPI tiles + pipeline / coaching-score view,
 * plus "Today's feedback" — what each student actually said today.
 *
 * That last list comes from the caller's own activity feed scoped to today, the same source
 * the web reads. It is Agent/Counselor-authorized, so both roles get a real list rather than
 * the agent-dashboard stand-in this screen used to settle for.
 */

// The feed rows carry student + feedback fields the shared list DTO does not type; widen
// locally so they render when present without touching the shared type.
type TodayItem = B2CActivityListDto & { studentName?: string | null; feedback?: string | null };

const feedbackMeta = (v?: string | null) => FEEDBACK_TYPES.find(f => f.value === v);
const feedbackLabel = (v?: string | null) => feedbackMeta(v)?.label || v || '';

// Stage → tint, mirrors the AgentDashboard pipeline colouring.
const stageTint = (T: AppTheme, stage: string): string => {
  if (stage === 'Converted') return T.success;
  if (stage === 'Lost' || stage === 'NotInterested') return T.danger;
  if (stage === 'DocumentPending' || stage === 'FollowUp') return T.warning;
  return T.accent;
};

export const B2CMyPerformanceScreen = () => {
  const T = useAppTheme();
  const { user } = useAuth();
  const r = useResponsive();
  const isCounselor = user?.role === 'Counselor';

  const kpiWidth = r.isWide ? '23.5%' : r.isTablet ? '23.5%' : '48.5%';
  const twoCol = r.isTablet;   // pipeline + this-month side by side once there is room

  const [agent, setAgent] = useState<B2CAgentDashboardDto | null>(null);
  const [counselor, setCounselor] = useState<B2CCounselorDashboardDto | null>(null);
  const [today, setToday] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const feedbackTone = useCallback(
    (v?: string | null) => {
      switch (feedbackMeta(v)?.tone) {
        case 'positive': return T.success;
        case 'warn':     return T.warning;
        case 'negative': return T.danger;
        default:         return T.sub;
      }
    },
    [T],
  );

  const load = useCallback(async () => {
    try {
      if (isCounselor) {
        const res = await b2cDashboardService.getCounselorDashboard();
        setCounselor(res.data ?? null);
      } else {
        const res = await b2cDashboardService.getAgentDashboard();
        setAgent(res.data ?? null);
      }
    } catch {
      setAgent(null); setCounselor(null);
    }
    // Today's activities → the feedback captured per student today. Bounded to the LOCAL day,
    // so an agent opening this before 5:30am in IST does not get yesterday's list.
    try {
      const res = await b2cActivityService.getMyActivities({
        page: 1, pageSize: 100, from: todayStr(), to: todayStr(),
      });
      setToday((((res.data as any)?.items ?? res.data ?? []) as TodayItem[]));
    } catch {
      setToday([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [isCounselor]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const data = isCounselor ? counselor : agent;
  const funnelMax = agent?.myPipeline?.length
    ? Math.max(1, ...agent.myPipeline.map(i => i.count))
    : 1;
  const SCORE_MAX = 100; // AI coaching scores are 0–100

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      contentStyle={r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } : undefined}
    >
      <Text style={[s.title, { color: T.text }]}>My Performance</Text>
      <Text style={[s.subtitle, { color: T.sub }]}>
        {isCounselor ? 'Your counseling impact' : 'Your field performance this month'}
      </Text>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>No data. Pull down to refresh.</Text></Card>
      ) : isCounselor && counselor ? (
        <>
          <View style={[s.grid, { marginTop: 16 }]}>
            <StatTile style={{ width: kpiWidth }} label="Active assignments" value={counselor.totalActiveAssignments ?? 0} icon={<Target size={16} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Sessions this week" value={counselor.sessionsThisWeek ?? 0} tint={T.info} icon={<TrendingUp size={16} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="Sessions today" value={counselor.sessionsToday ?? 0} tint={T.warning} icon={<Clock size={16} color={T.warning} />} />
            <StatTile style={{ width: kpiWidth }} label="Avg AI score" value={counselor.avgAiScore != null ? Math.round(counselor.avgAiScore) : '—'} tint={T.success} icon={<Award size={16} color={T.success} />} />
          </View>

          {counselor.scoreTrend?.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <SectionLabel>Recent AI Coaching Scores</SectionLabel>
              <Card>
                <View style={s.trendRow}>
                  {counselor.scoreTrend.map((sc, i) => (
                    <View key={i} style={s.trendCol}>
                      <Text style={[s.trendVal, { color: T.text }]}>{sc.score}</Text>
                      <View style={[s.trendTrack, { backgroundColor: T.line }]}>
                        <View style={[s.trendBar, { height: `${Math.max(4, (sc.score / SCORE_MAX) * 100)}%`, backgroundColor: T.accent }]} />
                      </View>
                      <Text style={[s.trendDate, { color: T.dim }]} numberOfLines={1}>{shortDate(sc.date)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}
        </>
      ) : agent ? (
        <>
          <View style={[s.grid, { marginTop: 16 }]}>
            <StatTile style={{ width: kpiWidth }} label="Active leads" value={`${agent.activeLeads ?? 0} / ${agent.leadCap ?? 50}`} icon={<Target size={16} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Contacted today" value={agent.contactedToday ?? 0} tint={T.info} icon={<TrendingUp size={16} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="Follow-ups due" value={agent.followUpsDueToday ?? 0} tint={T.warning} icon={<Clock size={16} color={T.warning} />} />
            <StatTile style={{ width: kpiWidth }} label="Conversions (mo)" value={agent.conversionsThisMonth ?? 0} tint={T.success} icon={<CheckCircle size={16} color={T.success} />} />
          </View>

          <View style={s.colsRow}>
            <View style={s.col}>
              <SectionLabel>My Pipeline</SectionLabel>
              <Card>
                {agent.myPipeline?.length > 0 ? (
                  agent.myPipeline.map((it: StageFunnelItem, i) => (
                    <View key={it.stage} style={[s.pipeRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[s.pipeLbl, { color: T.sub }]} numberOfLines={1}>{label(it.stage)}</Text>
                      <View style={[s.pipeTrack, { backgroundColor: T.line }]}>
                        <View style={{ width: `${(it.count / funnelMax) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: stageTint(T, it.stage) }} />
                      </View>
                      <Text style={[s.pipeCount, { color: T.text }]}>{it.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[s.muted, { color: T.dim }]}>No leads yet.</Text>
                )}
              </Card>
            </View>

            <View style={[s.col, !twoCol && { marginTop: 18 }]}>
              <SectionLabel>This Month</SectionLabel>
              <Card>
                <View style={{ gap: 12 }}>
                  <View style={s.kvRow}>
                    <Text style={[s.kvKey, { color: T.sub }]}>Leads created</Text>
                    <Text style={[s.kvVal, { color: T.text }]}>{agent.leadsCreatedThisMonth ?? 0}</Text>
                  </View>
                  <View style={s.kvRow}>
                    <Text style={[s.kvKey, { color: T.sub }]}>Conversions</Text>
                    <Text style={[s.kvVal, { color: T.text }]}>{agent.conversionsThisMonth ?? 0}</Text>
                  </View>
                  <View style={s.kvRow}>
                    <Text style={[s.kvKey, { color: T.sub }]}>Lead capacity used</Text>
                    <Text style={[s.kvVal, { color: T.text }]}>{agent.activeLeads ?? 0} / {agent.leadCap ?? 50}</Text>
                  </View>
                </View>
              </Card>
            </View>
          </View>
        </>
      ) : null}

      {/* Today's feedback — what each student said today */}
      {!loading && data && (
        <View style={{ marginTop: 18 }}>
          <SectionLabel>Today's Feedback</SectionLabel>
          <Card padded={false}>
            <View style={[s.feedHead, { borderBottomColor: T.line }]}>
              <Text style={[s.muted, { color: T.dim }]}>
                {today.length} {today.length === 1 ? 'activity' : 'activities'} logged today
              </Text>
            </View>
            {today.length === 0 ? (
              <Text style={[s.feedEmpty, { color: T.dim }]}>Nothing logged yet today.</Text>
            ) : (
              today.map((a, idx) => (
                <View
                  key={a.id ?? idx}
                  style={[s.feedRow, idx > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <Text style={[s.feedType, { color: T.accent }]} numberOfLines={1}>{a.type}</Text>
                  <Text style={[s.feedName, { color: T.text }]} numberOfLines={1}>
                    {a.studentName || a.performedByName}
                  </Text>
                  {a.feedback
                    ? <Badge label={feedbackLabel(a.feedback)} color={feedbackTone(a.feedback)} />
                    : <Text style={[s.muted, { color: T.dim }]}>—</Text>}
                </View>
              ))
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
};

const makeStyles = (r: ReturnType<typeof useResponsive>) =>
  StyleSheet.create({
    title: { fontSize: r.rf(22), fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { fontSize: r.rf(13), fontWeight: '500', marginTop: 3 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
    colsRow: {
      flexDirection: r.isTablet ? 'row' : 'column',
      alignItems: r.isTablet ? 'flex-start' : 'stretch',
      gap: r.isTablet ? r.gap : 0,
      marginTop: 18,
    },
    col: { flex: r.isTablet ? 1 : undefined, width: r.isTablet ? undefined : '100%' },

    muted: { fontSize: r.rf(12.5), fontWeight: '500' },
    empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },

    // My Pipeline funnel
    pipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
    pipeLbl: { fontSize: r.rf(12.5), fontWeight: '500', width: r.isTablet ? 150 : 110 },
    pipeTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
    pipeCount: { fontSize: r.rf(13.5), fontWeight: '800', width: 32, textAlign: 'right' },

    // AI coaching score trend
    trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: r.isTablet ? 200 : 160 },
    trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
    trendVal: { fontSize: r.rf(11), fontWeight: '800' },
    trendTrack: { width: '100%', flex: 1, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
    trendBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    trendDate: { fontSize: r.rf(10), fontWeight: '500' },

    // This Month key/value rows
    kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    kvKey: { fontSize: r.rf(13), fontWeight: '500' },
    kvVal: { fontSize: r.rf(14), fontWeight: '800' },

    // Today's feedback
    feedHead: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    feedEmpty: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 28 },
    feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    feedType: { width: r.isTablet ? 90 : 62, fontSize: r.rf(11), fontWeight: '800', textTransform: 'uppercase' },
    feedName: { flex: 1, fontSize: r.rf(13.5), fontWeight: '600' },
  });

export default B2CMyPerformanceScreen;
