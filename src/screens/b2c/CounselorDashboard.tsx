import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, CalendarClock, CalendarDays, Sparkles, Mic, ChevronRight } from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { ListCard, Avatar, StatusBadge, Btn } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { B2CCounselorDashboardDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { rf } from '../../utils/responsive';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const CounselorDashboard = () => {
  const T = useAppTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const kpiWidth = width >= 720 ? '23.5%' : '48.5%';

  const [data, setData] = useState<B2CCounselorDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await b2cDashboardService.getCounselorDashboard(); setData(res.data); }
    catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* Greeting */}
      <Text style={[st.date, { color: T.sub }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <View style={st.helloRow}>
        <Text style={[st.hello, { color: T.text }]} numberOfLines={1}>
          {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
        </Text>
        <Btn label="Start Session" small icon={<Mic size={15} color={T.onAccent} />} onPress={() => nav.navigate('Recording')} />
      </View>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Could not load dashboard.</Text></Card>
      ) : (
        <>
          {/* KPI grid — responsive columns */}
          <View style={[st.grid, { marginTop: 16 }]}>
            <StatTile style={{ width: kpiWidth }} label="Active Assignments" value={data.totalActiveAssignments} icon={<ClipboardList size={16} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Sessions Today" value={data.sessionsToday} tint={T.info} icon={<CalendarClock size={16} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="This Week" value={data.sessionsThisWeek} tint={T.warning} icon={<CalendarDays size={16} color={T.warning} />} />
            <StatTile style={{ width: kpiWidth }} label="Avg AI Score" value={data.avgAiScore != null ? data.avgAiScore.toFixed(1) : '—'} tint={T.success} icon={<Sparkles size={16} color={T.success} />} />
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

const st = StyleSheet.create({
  date: { fontSize: rf(12.5), fontWeight: '500' },
  helloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 3 },
  hello: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },
});
