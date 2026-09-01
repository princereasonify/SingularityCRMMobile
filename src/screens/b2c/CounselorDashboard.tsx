import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, CalendarClock, CalendarDays, Sparkles, Mic, ChevronRight } from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { ListCard, Avatar, StatusBadge, Btn } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { B2CCounselorDashboardDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, Responsive } from '../../hooks/useResponsive';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const CounselorDashboard = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  // 4-up only when there is genuinely room for four values side by side.
  const kpiWidth = r.width >= 900 ? '22%' : r.isTablet ? '30%' : '47%';

  const [data, setData] = useState<B2CCounselorDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await b2cDashboardService.getCounselorDashboard(); setData(res.data); }
    catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      <View style={st.helloRow}>
        <Text style={[st.hello, { color: T.text }]} numberOfLines={1}>
          {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
        </Text>
        <Btn label="Start Session" icon={<Mic size={15} color={T.onAccent} />} onPress={() => nav.navigate('Recording')} />
      </View>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Could not load dashboard.</Text></Card>
      ) : (
        <>
          {/* KPI grid — responsive columns */}
          <View style={[st.grid, { marginTop: 16 }]}>
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Active Assignments" value={data.totalActiveAssignments} icon={<ClipboardList size={16} color={T.accent} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Sessions Today" value={data.sessionsToday} tint={T.info} icon={<CalendarClock size={16} color={T.info} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="This Week" value={data.sessionsThisWeek} tint={T.warning} icon={<CalendarDays size={16} color={T.warning} />} />
            <StatTile style={[st.cell, { width: kpiWidth }]} label="Avg AI Score" value={data.avgAiScore != null ? data.avgAiScore.toFixed(1) : '—'} tint={T.success} icon={<Sparkles size={16} color={T.success} />} />
          </View>

          {/* Assigned leads */}
          <View style={{ marginTop: 18 }}>
            <SectionLabel>Assigned Students</SectionLabel>
            {(data.assignedLeads || []).length === 0 ? (
              <Card><Text style={[st.empty, { color: T.dim }]}>No students assigned to you yet.</Text></Card>
            ) : (
              data.assignedLeads.map(l => (
                <ListCard key={l.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: l.id })} style={{ marginBottom: 8 }}>
                  <View style={st.row}>
                    <Avatar initials={initialsOf(l.studentName)} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.name, { color: T.text }]} numberOfLines={1}>{l.studentName}</Text>
                      <Text style={[st.sub, { color: T.sub }]} numberOfLines={1}>{[l.city, l.mobileNumber].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <StatusBadge label={l.stage} color={T.accent} />
                    <ChevronRight size={16} color={T.sub} />
                  </View>
                </ListCard>
              ))
            )}
          </View>
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
  helloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 3 },
  hello: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  // width is the base; flexGrow spends whatever the row has left, so the last tile in a
  // line never leaves a dead strip down the right-hand edge.
  cell: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },
});
