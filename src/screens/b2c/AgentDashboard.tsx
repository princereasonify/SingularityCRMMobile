import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, Phone, CalendarClock, TrendingUp, ChevronRight } from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel, Badge } from '../../components/ui';
import { ListCard, Avatar } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { B2CAgentDashboardDto } from '../../types/b2c';
import { formatRelativeDate } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, Responsive } from '../../hooks/useResponsive';
import { label } from '../../utils/labels';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const stageTint = (T: any, stage: string): string => {
  if (stage === 'Converted') return T.success;
  if (stage === 'Lost' || stage === 'NotInterested') return T.danger;
  if (stage === 'DocumentPending' || stage === 'FollowUp') return T.warning;
  return T.accent;
};

export const AgentDashboard = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  // 4-up only when there is genuinely room for four values side by side.
  const kpiWidth = r.width >= 900 ? '22%' : r.isTablet ? '30%' : '47%';

  const [data, setData] = useState<B2CAgentDashboardDto | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isManager = !!(user as any)?.isManager;

  const load = useCallback(async () => {
    try {
      const res = await b2cDashboardService.getAgentDashboard();
      setData(res.data);
      if (isManager) {
        try { const t = await b2cUserService.getMyTeam(); setTeam((t.data as any[]) || []); } catch { setTeam([]); }
      }
    } catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isManager]);

  useEffect(() => { load(); }, [load]);

  const capPct = data && data.leadCap > 0 ? Math.min(Math.round((data.activeLeads / data.leadCap) * 100), 100) : 0;
  const capColor = capPct >= 90 ? T.danger : capPct >= 70 ? T.warning : T.accent;
  const pipeMax = Math.max(1, ...((data?.myPipeline || []).map(p => p.count)));

  // The page gutter and the readable-width cap both track the live window size.
  // paddingHorizontal/Top rather than the `padding` shorthand: Screen's own contentContainerStyle
  // sets paddingBottom from the bottom safe-area inset, and the shorthand would overwrite it and
  // push the last card under the home indicator.
  const content = { paddingHorizontal: r.gutter, paddingTop: r.gutter, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } as const;

  const st = useMemo(() => makeStyles(r), [r]);

  return (
    <Screen scroll contentStyle={content} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* Greeting */}
      <Text style={[st.date, { color: T.sub }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <Text style={[st.hello, { color: T.text }]} numberOfLines={1}>
        {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
      </Text>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Could not load dashboard.</Text></Card>
      ) : (
        <>
          {/* KPI grid — responsive columns */}
          <View style={[st.grid, { marginTop: 16 }]}>
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Active Leads" value={`${data.activeLeads}/${data.leadCap}`} sub={`${capPct}% of cap`} icon={<Users size={16} color={T.accent} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Contacted" value={data.contactedToday} sub="today" tint={T.info} icon={<Phone size={16} color={T.info} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Follow-ups" value={data.followUpsDueToday} sub="due today" tint={T.warning} icon={<CalendarClock size={16} color={T.warning} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Converted" value={data.conversionsThisMonth} sub="this month" tint={T.success} icon={<TrendingUp size={16} color={T.success} />} />
          </View>

          {/* Capacity bar */}
          <Card style={{ marginTop: 12 }}>
            <View style={st.capTop}>
              <Text style={[st.capLbl, { color: T.text }]}>Lead capacity</Text>
              <Text style={[st.capVal, { color: T.sub }]}>{data.activeLeads} / {data.leadCap}</Text>
            </View>
            <View style={[st.track, { backgroundColor: T.line }]}>
              <View style={[st.fill, { width: `${capPct}%`, backgroundColor: capColor }]} />
            </View>
          </Card>

          {/* My Pipeline */}
          {(data.myPipeline || []).length > 0 && (
            <View style={{ marginTop: 18 }}>
              <SectionLabel>My Pipeline</SectionLabel>
              <Card>
                {data.myPipeline.map((p, i) => (
                  <View key={p.stage} style={[st.pipeRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <Text style={[st.pipeLbl, { color: T.sub }]} numberOfLines={1}>{label(p.stage)}</Text>
                    <View style={[st.pipeTrack, { backgroundColor: T.line }]}>
                      <View style={{ width: `${(p.count / pipeMax) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: stageTint(T, p.stage) }} />
                    </View>
                    <Text style={[st.pipeCount, { color: T.text }]}>{p.count}</Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Today's follow-ups */}
          <View style={{ marginTop: 18 }}>
            <SectionLabel>Today's Follow-ups</SectionLabel>
            {(data.todayTasks || []).length === 0 ? (
              <Card><Text style={[st.empty, { color: T.dim }]}>Nothing scheduled for today.</Text></Card>
            ) : (
              data.todayTasks.slice(0, 8).map(a => (
                <ListCard key={a.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: a.id })} style={{ marginBottom: 8 }}>
                  <View style={st.taskRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.taskTitle, { color: T.text }]} numberOfLines={1}>{a.notes || 'Follow up'}</Text>
                      <Text style={[st.taskSub, { color: T.sub }]} numberOfLines={1}>{a.type}</Text>
                    </View>
                    {!!a.nextFollowUpDate && <Badge label={formatRelativeDate(a.nextFollowUpDate)} color={T.warning} />}
                    <ChevronRight size={16} color={T.sub} />
                  </View>
                </ListCard>
              ))
            )}
          </View>

          {/* Manager: team at a glance */}
          {isManager && (
            <View style={{ marginTop: 18 }}>
              <SectionLabel>My Team</SectionLabel>
              {team.length === 0 ? (
                <Card><Text style={[st.empty, { color: T.dim }]}>No agents assigned to you yet.</Text></Card>
              ) : (
                team.map(m => (
                  <ListCard key={m.id} onPress={() => nav.navigate('Team Leads')} style={{ marginBottom: 8 }}>
                    <View style={st.taskRow}>
                      <Avatar initials={(m.name || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('')} />
                      <Text style={[st.taskTitle, { color: T.text, flex: 1 }]} numberOfLines={1}>{m.name}</Text>
                      <Text style={[st.taskSub, { color: T.sub }]}>{m.activeLeadsCount ?? 0} leads</Text>
                      <Badge label={m.isActive ? 'Active' : 'Inactive'} color={m.isActive ? T.success : T.sub} />
                    </View>
                  </ListCard>
                ))
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  date: { fontSize: r.rf(12.5), fontWeight: '500' },
  hello: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  // width is the base; flexGrow spends whatever the row has left, so the last tile in a
  // line never leaves a dead strip down the right-hand edge.
  cell: { flexGrow: 1 },
  capTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  capLbl: { fontSize: r.rf(14), fontWeight: '600' },
  capVal: { fontSize: r.rf(12.5), fontWeight: '600' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  pipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  // The stage name is the content; the bar is decoration. Pinning the label to a fixed 108pt on
  // phones cut "Appointment Booked" and "Counseling Booked" down to "Appointment B…" — the row
  // then reads as a truncated mystery with a number beside it. Sizing the label to its text and
  // letting the track surrender width (down to a floor where it is still a readable bar) keeps
  // every stage name whole on the narrowest phone, without changing the tablet layout materially.
  pipeLbl: { fontSize: r.rf(12.5), fontWeight: '500', flexShrink: 1, flexGrow: 0, maxWidth: r.isTablet ? 260 : 180 },
  pipeTrack: { flex: 1, minWidth: 56, height: 8, borderRadius: 999, overflow: 'hidden' },
  pipeCount: { fontSize: r.rf(13.5), fontWeight: '800', minWidth: 30, textAlign: 'right' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskTitle: { fontSize: r.rf(13.5), fontWeight: '600' },
  taskSub: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },
});
