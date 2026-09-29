/**
 * Calling Agent's home screen — mobile twin of web's B2CCallingDashboard.jsx.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneCall, AlertTriangle, Clock, UserCheck, Phone } from 'lucide-react-native';
import { StatTile, Card } from '../../components/ui';
import { StatusBadge } from '../../components/crud';
import { CoinBalance } from '../../components/b2c/CoinBalance';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { b2cCallingService, CallDashboard } from '../../api/b2c/b2cCallingService';

const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');

const bucketTone = (T: ReturnType<typeof useAppTheme>, bucket: string) =>
  bucket === 'Overdue' ? T.danger : bucket === 'DueToday' ? T.warning : bucket === 'NeverCalled' ? T.accent : T.dim;
const bucketLabel: Record<string, string> = { Overdue: 'Overdue', DueToday: 'Due today', NeverCalled: 'Never called', Later: '' };

const fmtTime = (d?: string | null) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

export const B2CCallingDashboardScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();
  const { user } = useAuth();
  const [data, setData] = useState<CallDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    b2cCallingService.getDashboard()
      .then((res) => { if (alive) setData(res.data || null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const kpiW = r.isTablet ? '24%' : '48.5%';
  const connectLine = data && data.callsToday > 0
    ? `${data.connectedToday} of ${data.callsToday} reached someone`
    : 'No calls logged yet today';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 14 }}>
        <View>
          <Text style={[styles.h1, { color: T.text }]}>Hello, {(user?.name || '').split(' ')[0]}!</Text>
          <Text style={[styles.h2, { color: T.sub }]}>{loading ? 'Loading…' : connectLine}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : !data ? (
          <Text style={{ color: T.sub, textAlign: 'center', marginTop: 40 }}>Failed to load dashboard.</Text>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <StatTile style={{ width: kpiW }} label="Calls today" value={data.callsToday} icon={<PhoneCall size={17} color={T.text} strokeWidth={ICON_STROKE} />} sub={connectLine} />
              <StatTile style={{ width: kpiW }} label="Overdue" value={data.overdue} icon={<AlertTriangle size={17} color={T.danger} strokeWidth={ICON_STROKE} />} tint={T.danger} sub="Promised a call that never happened" />
              <StatTile style={{ width: kpiW }} label="Due today" value={data.dueToday} icon={<Clock size={17} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} sub="Callbacks you agreed for today" />
              <StatTile style={{ width: kpiW }} label="Handed over" value={data.handoffsToday} icon={<UserCheck size={17} color={T.text} strokeWidth={ICON_STROKE} />} sub="Sent to an agent or counsellor" />
            </View>

            <Card>
              <View style={styles.cardHead}>
                <View>
                  <Text style={[styles.cardTitle, { color: T.text }]}>Up next</Text>
                  <Text style={[styles.cardSub, { color: T.sub }]}>Overdue first, then today's callbacks</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Call Queue')}>
                  <Text style={[styles.link, { color: T.accent }]}>View queue</Text>
                </TouchableOpacity>
              </View>
              {(data.upNext || []).length === 0 ? (
                <View style={styles.empty}>
                  <PhoneCall size={28} color={T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.emptyTxt, { color: T.sub }]}>Nothing waiting — the queue is clear.</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.upNext.map((row) => (
                    <TouchableOpacity key={row.id} onPress={() => navigation.navigate('Call Queue')} activeOpacity={0.7} style={[styles.row, { backgroundColor: T.cardAlt }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.rowMain, { color: T.text }]} numberOfLines={1}>{row.studentName}</Text>
                        <Text style={[styles.rowSub, { color: T.sub }]} numberOfLines={1}>
                          {row.parentName || 'parent unknown'} · {row.parentMobile || row.mobileNumber}
                        </Text>
                      </View>
                      <CoinBalance value={row.coinBalance} />
                      {!!bucketLabel[row.bucket] && <StatusBadge label={bucketLabel[row.bucket]} color={bucketTone(T, row.bucket)} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            <Card>
              <View style={styles.cardHead}>
                <View>
                  <Text style={[styles.cardTitle, { color: T.text }]}>Your recent calls</Text>
                  <Text style={[styles.cardSub, { color: T.sub }]}>What you logged most recently</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('My Calls')}>
                  <Text style={[styles.link, { color: T.accent }]}>View all</Text>
                </TouchableOpacity>
              </View>
              {(data.recentCalls || []).length === 0 ? (
                <View style={styles.empty}>
                  <Phone size={28} color={T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.emptyTxt, { color: T.sub }]}>No calls logged yet.</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Call Queue')}>
                    <Text style={[styles.link, { color: T.accent, marginTop: 6 }]}>Start calling →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.recentCalls.map((c) => (
                    <View key={c.id} style={[styles.row, { backgroundColor: T.cardAlt, alignItems: 'flex-start' }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.rowMain, { color: T.text }]} numberOfLines={1}>{c.studentName}</Text>
                        <Text style={[styles.rowSub, { color: T.sub }]} numberOfLines={1}>{c.discussion || c.notes || 'no note'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <StatusBadge label={c.outcome ? spaced(c.outcome) : '—'} color={c.outcome ? T.accent : T.dim} />
                        <Text style={[styles.rowSub, { color: T.dim, marginTop: 4 }]}>{fmtTime(c.calledAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  h1: { fontWeight: '800', fontSize: 22, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 13, marginTop: 3 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontWeight: '700', fontSize: 15 },
  cardSub: { fontWeight: '500', fontSize: 11.5, marginTop: 1 },
  link: { fontWeight: '600', fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 28 },
  emptyTxt: { fontSize: 12.5, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  rowMain: { fontWeight: '600', fontSize: 13 },
  rowSub: { fontWeight: '500', fontSize: 11.5, marginTop: 1 },
});

export default B2CCallingDashboardScreen;
