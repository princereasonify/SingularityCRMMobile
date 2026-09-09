import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, TrendingUp, IndianRupee, UserCheck, GraduationCap, Percent } from 'lucide-react-native';
import { Screen, Card, StatTile } from '../../components/ui';
import { StatusBadge, Avatar } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { B2CAdminDashboardDto } from '../../types/b2c';
import { formatCurrency } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, Responsive } from '../../hooks/useResponsive';
import { label } from '../../utils/labels';
import { PREVIEW_ROWS, SectionHeader, Bar, initialsOf, sectionGrid } from '../../components/b2c/DashboardSection';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const B2CAdminDashboard = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const { user } = useAuth();
  const nav = useNavigation<any>();
  // Six KPI tiles: 3-up on a tablet, 2-up on a phone — never one long clipped row.
  // Bases are deliberately under a clean division: every tile also flexGrows, so it fills
  // the row, and no rounding error can bump the last one onto a line of its own.
  const kpiWidth = r.isTablet ? '30%' : '46%';
  // Sections sit two-up on a tablet and full width on a phone.
  const grid = sectionGrid(r);

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

  // The longest bar is the biggest stage, so the shape of the funnel is readable even when
  // every count is small. Never zero, or every bar divides by it.
  const maxPipeline = Math.max(1, ...(data?.pipeline ?? []).map(p => p.count));

  // Sections render only when they have rows, so both the count AND each section's position
  // must be derived from what is actually on screen — a fixed 0/1/2 would mis-place the
  // orphan the moment one of them is empty.
  const hasPipe = (data?.pipeline?.length ?? 0) > 0;
  const hasAgents = (data?.agentPerformance?.length ?? 0) > 0;
  const shownSections = [hasPipe, hasAgents].filter(Boolean).length;
  const idxPipe = 0;
  const idxAgents = hasPipe ? 1 : 0;

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

            {/* Two-up on a tablet. A home screen is a SUMMARY: on an iPad these three cards
                stacked one per row turned a glanceable page into a long scroll with a column
                of empty space beside it. */}
            <View style={grid.style}>
              {data.pipeline.length > 0 && (
                <View style={[s.section, { width: grid.widthAt(idxPipe, shownSections) }]}>
                  <SectionHeader
                    title="Pipeline"
                    total={data.pipeline.length}
                    onViewAll={() => nav.navigate('Pipeline')}
                  />
                  <Card style={s.fillCard}>
                    {data.pipeline.slice(0, PREVIEW_ROWS).map((p, i) => (
                      <View key={p.stage} style={[s.barRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={s.barTop}>
                          <Text style={[s.rowLabel, { color: T.text }]} numberOfLines={1}>{label(p.stage)}</Text>
                          <Text style={[s.rowVal, { color: T.text }]}>{p.count}</Text>
                        </View>
                        <Bar pct={maxPipeline > 0 ? p.count / maxPipeline : 0} color={T.accent} track={T.cardAlt} />
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {data.agentPerformance.length > 0 && (
                <View style={[s.section, { width: grid.widthAt(idxAgents, shownSections) }]}>
                  <SectionHeader
                    title="Agent Performance"
                    total={data.agentPerformance.length}
                    onViewAll={() => nav.navigate('Student Leads')}
                  />
                  <Card style={s.fillCard}>
                    {data.agentPerformance.slice(0, PREVIEW_ROWS).map((a, i) => (
                      <View key={a.agentId} style={[s.agentRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        {/* Initials, as on the web card — a column of names alone is far harder
                            to scan than a column of faces. */}
                        <Avatar initials={initialsOf(a.agentName)} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.rowLabel, { color: T.text }]} numberOfLines={1}>{a.agentName}</Text>
                          <View style={s.agentMeta}>
                            <Bar
                              pct={a.leadCap > 0 ? a.activeLeads / a.leadCap : 0}
                              color={T.accent}
                              track={T.cardAlt}
                              style={{ flex: 1 }}
                            />
                            <Text style={[s.rowSub, { color: T.dim }]}>{a.activeLeads}/{a.leadCap}</Text>
                          </View>
                        </View>
                        <StatusBadge label={`${Math.round(a.conversionPercent)}%`} color={T.success} />
                      </View>
                    ))}
                  </Card>
                </View>
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
  hello: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  cell: { flexGrow: 1 },
  section: { gap: 2, marginTop: r.rs(14) },
  // The row stretches the section; this makes the card inside fill that height rather than
  // leaving a gap under a short list next to a tall one.
  fillCard: { flex: 1 },
  barRow: { paddingVertical: r.rs(10), gap: 7 },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: r.rs(10) },
  agentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: r.rs(11) },
  rowLabel: { fontSize: r.rf(13), fontWeight: '600', flex: 1 },
  rowSub: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  rowVal: { fontSize: r.rf(14), fontWeight: '800' },
  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 24 },
});
