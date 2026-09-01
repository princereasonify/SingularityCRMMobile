import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Users, TrendingUp, IndianRupee, UserCheck, GraduationCap, Percent } from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { StatusBadge } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { B2CAdminDashboardDto } from '../../types/b2c';
import { formatCurrency } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, Responsive } from '../../hooks/useResponsive';
import { label } from '../../utils/labels';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const B2CAdminDashboard = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const { user } = useAuth();
  // Six KPI tiles: 3-up on a tablet, 2-up on a phone — never one long clipped row.
  // Bases are deliberately under a clean division: every tile also flexGrows, so it fills
  // the row, and no rounding error can bump the last one onto a line of its own.
  const kpiWidth = r.isTablet ? '30%' : '46%';
  const geoWidth = r.isTablet ? '22%' : '46%';

  const [data, setData] = useState<B2CAdminDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await b2cDashboardService.getAdminDashboard();
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The page gutter and the readable-width cap both track the live window size.
  // paddingHorizontal/Top rather than the `padding` shorthand: Screen's own contentContainerStyle
  // sets paddingBottom from the bottom safe-area inset, and the shorthand would overwrite it and
  // push the last card under the home indicator.
  const content = { paddingHorizontal: r.gutter, paddingTop: r.gutter, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } as const;

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <Screen scroll contentStyle={content} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[s.date, { color: T.sub }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <Text style={[s.hello, { color: T.text }]} numberOfLines={1}>
        {greeting()}, {user?.name?.split(' ')[0] || 'Admin'} 👋
      </Text>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : !data ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Could not load dashboard.</Text></Card>
      ) : (
        <>
          <View style={[s.grid, { marginTop: 16 }]}>
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Leads (This Month)" value={data.totalLeadsThisMonth} icon={<Users size={16} color={T.accent} />} />
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Converted" value={data.leadsConvertedThisMonth} tint={T.success} icon={<TrendingUp size={16} color={T.success} />} />
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Conversion Rate" value={`${Math.round(data.conversionRatePercent)}%`} tint={T.info} icon={<Percent size={16} color={T.info} />} />
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Revenue (This Month)" value={formatCurrency(data.revenueThisMonth)} tint={T.success} icon={<IndianRupee size={16} color={T.success} />} />
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Active Agents" value={data.activeAgents} icon={<UserCheck size={16} color={T.accent} />} />
            <StatTile style={[s.cell, { width: kpiWidth }]} label="Active Counselors" value={data.activeCounselors} tint={T.warning} icon={<GraduationCap size={16} color={T.warning} />} />
          </View>

            {data.pipeline.length > 0 && (
              <View style={s.section}>
                <SectionLabel>Pipeline</SectionLabel>
                <Card>
                  {data.pipeline.map((p, i) => (
                    <View key={p.stage} style={[s.row, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[s.rowLabel, { color: T.text }]} numberOfLines={1}>{label(p.stage)}</Text>
                      <Text style={[s.rowVal, { color: T.text }]}>{p.count}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {data.agentPerformance.length > 0 && (
              <View style={s.section}>
                <SectionLabel>Agent Performance</SectionLabel>
                <Card>
                  {data.agentPerformance.map((a, i) => (
                    <View key={a.agentId} style={[s.row, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rowLabel, { color: T.text }]} numberOfLines={1}>{a.agentName}</Text>
                        <Text style={[s.rowSub, { color: T.dim }]}>{a.activeLeads}/{a.leadCap} leads · {a.conversions} won</Text>
                      </View>
                      <StatusBadge label={`${Math.round(a.conversionPercent)}%`} color={T.success} />
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {data.sourceBreakdown.length > 0 && (
              <View style={s.section}>
                <SectionLabel>Source Breakdown</SectionLabel>
                <Card>
                  {data.sourceBreakdown.map((b, i) => (
                    <View key={b.source} style={[s.row, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[s.rowLabel, { color: T.text }]} numberOfLines={1}>{b.source}</Text>
                      <Text style={[s.rowVal, { color: T.text }]}>{b.count}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {data.geoCompliance && (
              <View style={s.section}>
                <SectionLabel>Geo Compliance</SectionLabel>
                <Card>
                  <View style={s.geoGrid}>
                    {[
                      { label: 'Violations', value: data.geoCompliance.violationsThisMonth ?? 0, color: T.danger },
                      { label: 'Unverified Visits', value: data.geoCompliance.unverifiedVisits ?? 0, color: T.warning },
                      { label: 'Pending Selfies', value: data.geoCompliance.pendingSelfies ?? 0, color: T.warning },
                      { label: 'Pass Rate', value: `${data.geoCompliance.passRatePercent ?? 100}%`, color: T.success },
                    ].map(item => (
                      <View key={item.label} style={[s.geoBox, { backgroundColor: T.cardAlt, width: geoWidth }]}>
                        <Text style={[s.geoNum, { color: item.color }]}>{item.value}</Text>
                        <Text style={[s.geoLbl, { color: T.dim }]} numberOfLines={1}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            )}

            <View style={s.section}>
              <SectionLabel>Counselor Quality</SectionLabel>
              <Card>
                <View style={s.row}>
                  <Text style={[s.rowLabel, { color: T.text }]}>Average score</Text>
                  <Text style={[s.rowVal, { color: T.text }]}>{data.counselorQuality.avgScore.toFixed(1)}</Text>
                </View>
                <View style={[s.row, { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[s.rowLabel, { color: T.text }]}>Sessions this month</Text>
                  <Text style={[s.rowVal, { color: T.text }]}>{data.counselorQuality.sessionsThisMonth}</Text>
                </View>
              </Card>
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
  hello: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  cell: { flexGrow: 1 },
  section: { gap: 2, marginTop: r.rs(14) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: r.rs(11) },
  rowLabel: { fontSize: r.rf(13), fontWeight: '600', flex: 1 },
  rowSub: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  rowVal: { fontSize: r.rf(14), fontWeight: '800' },
  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 24 },
  geoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  geoBox: { flexGrow: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 3 },
  geoNum: { fontSize: r.rf(20), fontWeight: '800' },
  geoLbl: { fontSize: r.rf(11), fontWeight: '600' },
});
