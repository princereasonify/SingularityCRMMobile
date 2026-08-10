import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
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
import { rf } from '../../utils/responsive';

/**
 * B2CMyPerformanceScreen — read-only "My Performance" for the signed-in agent / counselor.
 * Mirrors web B2CMyPerformance.jsx: role-gated KPI tiles + pipeline / coaching-score view,
 * plus a "Today's feedback" list of the activities logged today.
 *
 * Web pulls today's feedback from b2cActivityService.getMyActivities('/mine'), which the
 * permitted mobile service does not expose (and services must not be changed). The closest
 * today-scoped activity data the mobile services return is the agent dashboard's `todayTasks`,
 * so that backs the feedback list for agents; counselors have no equivalent endpoint and show
 * the empty state — matching web copy in both cases.
 */

// Dashboard activities may carry student/feedback fields the list DTO doesn't type; widen
// locally so we can render them when present (web parity) without touching the shared type.
type TodayItem = B2CActivityListDto & { studentName?: string | null; feedback?: string | null };

const feedbackMeta = (v?: string | null) => FEEDBACK_TYPES.find(f => f.value === v);
const feedbackLabel = (v?: string | null) => feedbackMeta(v)?.label || v || '';

// Stage → tint, mirrors the AgentDashboard pipeline colouring.
const stageTint = (T: any, stage: string): string => {
  if (stage === 'Converted') return T.success;
  if (stage === 'Lost' || stage === 'NotInterested') return T.danger;
  if (stage === 'DocumentPending' || stage === 'FollowUp') return T.warning;
  return T.accent;
};

export const B2CMyPerformanceScreen = () => {
  const T = useAppTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCounselor = user?.role === 'Counselor';

  const kpiCols = width >= 720 ? 4 : 2;                 // iPad landscape → 4-up, phone → 2-up
  const kpiWidth = kpiCols === 4 ? '23.5%' : '48.5%';
  const twoCol = width >= 720;                          // pipeline + this-month side-by-side on iPad

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
        setToday([]); // no today-scoped activity endpoint for counselors
      } else {
        const res = await b2cDashboardService.getAgentDashboard();
        setAgent(res.data ?? null);
        setToday((res.data?.todayTasks as TodayItem[]) ?? []);
      }
    } catch {
      setAgent(null); setCounselor(null); setToday([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [isCounselor]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const data = isCounselor ? counselor : agent;
  const funnelMax = agent?.myPipeline?.length
    ? Math.max(1, ...agent.myPipeline.map(i => i.count))
    : 1;
  const scoreMax = 100; // AI coaching scores are 0–100

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[st.title, { color: T.text }]}>My Performance</Text>
      <Text style={[st.subtitle, { color: T.sub }]}>
        {isCounselor ? 'Your counseling impact' : 'Your field performance this month'}
      </Text>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>No data. Pull down to refresh.</Text></Card>
      ) : isCounselor && counselor ? (
        <>
          <View style={[st.grid, { marginTop: 16 }]}>
            <StatTile style={{ width: kpiWidth }} label="Active assignments" value={counselor.totalActiveAssignments ?? 0} icon={<Target size={16} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Sessions this week" value={counselor.sessionsThisWeek ?? 0} tint={T.info} icon={<TrendingUp size={16} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="Sessions today" value={counselor.sessionsToday ?? 0} tint={T.warning} icon={<Clock size={16} color={T.warning} />} />
            <StatTile style={{ width: kpiWidth }} label="Avg AI score" value={counselor.avgAiScore != null ? Math.round(counselor.avgAiScore) : '—'} tint={T.success} icon={<Award size={16} color={T.success} />} />
          </View>

          {counselor.scoreTrend?.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <SectionLabel>Recent AI Coaching Scores</SectionLabel>
              <Card>
                <View style={st.trendRow}>
                  {counselor.scoreTrend.map((sc, i) => (
                    <View key={i} style={st.trendCol}>
                      <Text style={[st.trendVal, { color: T.text }]}>{sc.score}</Text>
                      <View style={[st.trendTrack, { backgroundColor: T.line }]}>
                        <View style={[st.trendBar, { height: `${Math.max(4, (sc.score / scoreMax) * 100)}%`, backgroundColor: T.accent }]} />
                      </View>
                      <Text style={[st.trendDate, { color: T.dim }]} numberOfLines={1}>
                        {new Date(sc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}
        </>
      ) : agent ? (
        <>
          <View style={[st.grid, { marginTop: 16 }]}>
            <StatTile style={{ width: kpiWidth }} label="Active leads" value={`${agent.activeLeads ?? 0} / ${agent.leadCap ?? 50}`} icon={<Target size={16} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Contacted today" value={agent.contactedToday ?? 0} tint={T.info} icon={<TrendingUp size={16} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="Follow-ups due" value={agent.followUpsDueToday ?? 0} tint={T.warning} icon={<Clock size={16} color={T.warning} />} />
            <StatTile style={{ width: kpiWidth }} label="Conversions (mo)" value={agent.conversionsThisMonth ?? 0} tint={T.success} icon={<CheckCircle size={16} color={T.success} />} />
          </View>

          <View style={[twoCol ? st.colsRow : undefined, { marginTop: 18 }]}>
            <View style={twoCol ? st.col : undefined}>
              <SectionLabel>My Pipeline</SectionLabel>
              <Card>
                {agent.myPipeline?.length > 0 ? (
                  agent.myPipeline.map((it: StageFunnelItem, i) => (
                    <View key={it.stage} style={[st.pipeRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[st.pipeLbl, { color: T.sub }]} numberOfLines={1}>{it.stage}</Text>
                      <View style={[st.pipeTrack, { backgroundColor: T.line }]}>
                        <View style={{ width: `${(it.count / funnelMax) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: stageTint(T, it.stage) }} />
                      </View>
                      <Text style={[st.pipeCount, { color: T.text }]}>{it.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[st.muted, { color: T.dim }]}>No leads yet.</Text>
                )}
              </Card>
            </View>

            <View style={[twoCol ? st.col : undefined, !twoCol && { marginTop: 18 }]}>
              <SectionLabel>This Month</SectionLabel>
              <Card>
                <View style={{ gap: 12 }}>
                  <View style={st.kvRow}>
                    <Text style={[st.kvKey, { color: T.sub }]}>Leads created</Text>
                    <Text style={[st.kvVal, { color: T.text }]}>{agent.leadsCreatedThisMonth ?? 0}</Text>
                  </View>
                  <View style={st.kvRow}>
                    <Text style={[st.kvKey, { color: T.sub }]}>Conversions</Text>
                    <Text style={[st.kvVal, { color: T.text }]}>{agent.conversionsThisMonth ?? 0}</Text>
                  </View>
                  <View style={st.kvRow}>
                    <Text style={[st.kvKey, { color: T.sub }]}>Lead capacity used</Text>
                    <Text style={[st.kvVal, { color: T.text }]}>{agent.activeLeads ?? 0} / {agent.leadCap ?? 50}</Text>
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
            <View style={[st.feedHead, { borderBottomColor: T.line }]}>
              <Text style={[st.muted, { color: T.dim }]}>
                {today.length} {today.length === 1 ? 'activity' : 'activities'} logged today
              </Text>
            </View>
            {today.length === 0 ? (
              <Text style={[st.feedEmpty, { color: T.dim }]}>Nothing logged yet today.</Text>
            ) : (
              today.map((a, idx) => (
                <View
                  key={a.id ?? idx}
                  style={[st.feedRow, idx > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <Text style={[st.feedType, { color: T.accent }]} numberOfLines={1}>{a.type}</Text>
                  <Text style={[st.feedName, { color: T.text }]} numberOfLines={1}>
                    {a.studentName || a.performedByName}
                  </Text>
                  {a.feedback
                    ? <Badge label={feedbackLabel(a.feedback)} color={feedbackTone(a.feedback)} />
                    : <Text style={[st.muted, { color: T.dim }]}>—</Text>}
                </View>
              ))
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
};

const st = StyleSheet.create({
  title: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(13), fontWeight: '500', marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colsRow: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  muted: { fontSize: rf(12.5), fontWeight: '500' },
  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },

  // My Pipeline funnel
  pipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  pipeLbl: { fontSize: rf(12.5), fontWeight: '500', width: 110 },
  pipeTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  pipeCount: { fontSize: rf(13.5), fontWeight: '800', width: 30, textAlign: 'right' },

  // AI coaching score trend
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
  trendVal: { fontSize: rf(11), fontWeight: '800' },
  trendTrack: { width: '100%', flex: 1, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  trendDate: { fontSize: rf(10), fontWeight: '500' },

  // This Month key/value rows
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kvKey: { fontSize: rf(13), fontWeight: '500' },
  kvVal: { fontSize: rf(14), fontWeight: '800' },

  // Today's feedback
  feedHead: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  feedEmpty: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 28 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  feedType: { width: 60, fontSize: rf(11), fontWeight: '800', textTransform: 'uppercase' },
  feedName: { flex: 1, fontSize: rf(13.5), fontWeight: '600' },
});
