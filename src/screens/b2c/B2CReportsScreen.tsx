import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, CheckCircle, TrendingUp, IndianRupee, MapPin, Award, MessageSquare, HeartHandshake } from 'lucide-react-native';
import { Card, SectionLabel, StatTile, Badge } from '../../components/ui';
import { ListCard } from '../../components/crud';
import { b2cDashboardService } from '../../api/b2c/b2cDashboardService';
import { FEEDBACK_TYPES } from '../../api/b2c/b2cObjectionService';
import { B2CAdminDashboardDto, AgentPerformanceItem, StageFunnelItem, SourceBreakdownItem } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * B2CReportsScreen — read-only admin reports. Mirrors web B2CReports.jsx:
 * KPI tiles, pipeline funnel, lead sources, feedback pulse, counseling health,
 * geo/quality tiles and an agent-performance list (Manager badge when isManager).
 */

// The admin dashboard payload carries a couple of report-only blocks the shared
// DTO doesn't type (feedbackPulse, counselingHealth) and isManager/teamSize on
// agent rows — read them off a loose view, exactly like the web page does.
interface FeedbackPulseItem { feedback: string; count: number }
interface CounselingHealth {
  openObjections?: number; bookedThisMonth?: number; resolvedThisMonth?: number; briefCoveragePercent?: number;
}
type AgentRow = AgentPerformanceItem & { isManager?: boolean; teamSize?: number };
type ReportData = B2CAdminDashboardDto & {
  feedbackPulse?: FeedbackPulseItem[];
  counselingHealth?: CounselingHealth;
  agentPerformance: AgentRow[];
};

const fmtRupee = (v?: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fbMeta = (v: string) => FEEDBACK_TYPES.find(f => f.value === v) || { label: v, tone: 'neutral' };
const spaceCase = (s?: string) => (s || '').replace(/([A-Z])/g, ' $1').trim();

export const B2CReportsScreen = () => {
  const T = useAppTheme();
  const { width } = useWindowDimensions();
  // Full-width KPI grid: 4-across on tablet/landscape, 2-across on phone portrait.
  const cols = width >= 700 ? 4 : 2;
  const GAP = 12;
  const tileW = (width - 28 - GAP * (cols - 1)) / cols; // scroll padding is 14 each side

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await b2cDashboardService.getAdminDashboard();
      setData((res.data as ReportData) ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toneColor = (tone: string) =>
    tone === 'positive' ? T.success : tone === 'negative' ? T.danger : tone === 'warn' ? T.warning : T.sub;

  const convColor = (p: number) => (p >= 30 ? T.success : p >= 15 ? T.warning : T.sub);

  const renderKpis = (d: ReportData) => {
    const kpis = [
      { label: 'Total leads', value: d.totalLeadsThisMonth ?? 0, icon: <Users size={16} color={T.accent} /> },
      { label: 'Conversions', value: d.leadsConvertedThisMonth ?? 0, icon: <CheckCircle size={16} color={T.accent} /> },
      { label: 'Conversion rate', value: `${Math.round(d.conversionRatePercent ?? 0)}%`, icon: <TrendingUp size={16} color={T.accent} /> },
      { label: 'Revenue', value: fmtRupee(d.revenueThisMonth), icon: <IndianRupee size={16} color={T.accent} /> },
    ];
    return (
      <View style={[s.grid, { gap: GAP }]}>
        {kpis.map(k => (
          <StatTile key={k.label} label={k.label} value={k.value} icon={k.icon} style={{ width: tileW }} />
        ))}
      </View>
    );
  };

  const renderCompliance = (d: ReportData) => {
    const g = d.geoCompliance || ({} as ReportData['geoCompliance']);
    const cq = d.counselorQuality || ({} as ReportData['counselorQuality']);
    const tiles = [
      { label: 'Geo pass rate', value: `${Math.round(g?.passRatePercent ?? 0)}%`, icon: <MapPin size={16} color={T.accent} /> },
      { label: 'Violations (mo)', value: g?.violationsThisMonth ?? 0, icon: undefined },
      { label: 'Pending selfies', value: g?.pendingSelfies ?? 0, icon: undefined },
      { label: 'Avg counselor score', value: cq?.avgScore != null ? Math.round(cq.avgScore) : '—', icon: <Award size={16} color={T.accent} /> },
    ];
    return (
      <View style={[s.grid, { gap: GAP }]}>
        {tiles.map(t => (
          <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} style={{ width: tileW }} />
        ))}
      </View>
    );
  };

  const Bar = ({ label, count, max, color, w }: { label: string; count: number; max: number; color: string; w: number }) => (
    <View style={s.barRow}>
      <Text style={[s.barLabel, { color: T.sub, width: w }]} numberOfLines={1}>{label}</Text>
      <View style={[s.barTrack, { backgroundColor: T.cardAlt }]}>
        <View style={[s.barFill, { backgroundColor: color, width: `${(count / max) * 100}%`, minWidth: count > 0 ? 24 : 0 }]}>
          {count > 0 && <Text style={s.barVal}>{count}</Text>}
        </View>
      </View>
    </View>
  );

  const renderBody = (d: ReportData) => {
    const pipeline: StageFunnelItem[] = d.pipeline || [];
    const sources: SourceBreakdownItem[] = d.sourceBreakdown || [];
    const feedback: FeedbackPulseItem[] = d.feedbackPulse || [];
    const ch: CounselingHealth = d.counselingHealth || {};
    const agents: AgentRow[] = d.agentPerformance || [];
    const pipeMax = Math.max(1, ...pipeline.map(i => i.count));
    const fbMax = Math.max(1, ...feedback.map(f => f.count));

    const healthCells = [
      { label: 'Open objections', value: ch.openObjections ?? 0, color: T.text },
      { label: 'Booked this month', value: ch.bookedThisMonth ?? 0, color: T.text },
      { label: 'Resolved this month', value: ch.resolvedThisMonth ?? 0, color: T.success },
      { label: 'AI brief coverage', value: `${Math.round(ch.briefCoveragePercent ?? 0)}%`, color: T.text },
    ];

    return (
      <>
        {renderKpis(d)}

        <SectionLabel>Pipeline Funnel</SectionLabel>
        <Card>
          {pipeline.length > 0
            ? <View style={{ gap: 10 }}>{pipeline.map(i => <Bar key={i.stage} label={i.stage} count={i.count} max={pipeMax} color={T.accent} w={110} />)}</View>
            : <Text style={[s.muted, { color: T.dim }]}>No data.</Text>}
        </Card>

        <SectionLabel>Lead Sources</SectionLabel>
        <Card>
          {sources.length > 0
            ? <View style={{ gap: 10 }}>
                {sources.map(src => (
                  <View key={src.source} style={s.srcRow}>
                    <Text style={[s.srcName, { color: T.sub }]} numberOfLines={1}>{spaceCase(src.source)}</Text>
                    <Text style={[s.srcCount, { color: T.text }]}>{src.count}</Text>
                  </View>
                ))}
              </View>
            : <Text style={[s.muted, { color: T.dim }]}>No data.</Text>}
        </Card>

        <View style={s.sectionHead}>
          <MessageSquare size={14} color={T.accent} />
          <SectionLabel style={{ marginBottom: 0 }}>Feedback Pulse</SectionLabel>
        </View>
        <Card>
          {feedback.length > 0
            ? <View style={{ gap: 10 }}>
                {feedback.map(f => {
                  const m = fbMeta(f.feedback);
                  return <Bar key={f.feedback} label={m.label} count={f.count} max={fbMax} color={toneColor(m.tone)} w={130} />;
                })}
              </View>
            : <Text style={[s.muted, { color: T.dim }]}>No feedback captured this month.</Text>}
        </Card>

        <View style={s.sectionHead}>
          <HeartHandshake size={14} color={T.accent} />
          <SectionLabel style={{ marginBottom: 0 }}>Counseling Health</SectionLabel>
        </View>
        <View style={[s.grid, { gap: GAP }]}>
          {healthCells.map(c => (
            <View key={c.label} style={[s.healthCell, { backgroundColor: T.card, borderColor: T.line, width: tileW }]}>
              <Text style={[s.healthLbl, { color: T.sub }]} numberOfLines={1}>{c.label}</Text>
              <Text style={[s.healthVal, { color: c.color }]}>{c.value}</Text>
            </View>
          ))}
        </View>

        <SectionLabel>Compliance & Quality</SectionLabel>
        {renderCompliance(d)}

        <SectionLabel>Agent Performance</SectionLabel>
        {agents.length > 0 ? (
          <View style={{ gap: 8 }}>
            {agents.map(a => (
              <ListCard key={a.agentId} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={s.agentTop}>
                    <Text style={[s.agentName, { color: T.text }]} numberOfLines={1}>{a.agentName}</Text>
                    {a.isManager && <Badge label={`Manager · ${a.teamSize ?? 0}`} color={T.accent} />}
                  </View>
                  <View style={s.agentMeta}>
                    <Text style={[s.agentStat, { color: T.sub }]}>Active {a.activeLeads}/{a.leadCap}</Text>
                    <Text style={[s.agentStat, { color: T.sub }]}>·  {a.conversions} conv</Text>
                  </View>
                </View>
                <Badge label={`${Math.round(a.conversionPercent)}%`} color={convColor(a.conversionPercent)} />
              </ListCard>
            ))}
          </View>
        ) : (
          <Card><Text style={[s.muted, { color: T.dim, textAlign: 'center' }]}>No agent data.</Text></Card>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.dim }]}>Team performance this month</Text>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 64 }} />
        ) : error || !data ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No data</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Pull down to try again.</Text>
          </View>
        ) : (
          renderBody(data)
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginBottom: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  muted: { fontSize: rf(12.5), fontWeight: '500' },

  // bars (pipeline + feedback)
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontSize: rf(11.5), fontWeight: '500' },
  barTrack: { flex: 1, height: 22, borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 8, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 7 },
  barVal: { color: '#FFF', fontSize: rf(10.5), fontWeight: '700' },

  // sources
  srcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  srcName: { fontSize: rf(12.5), fontWeight: '500', flex: 1 },
  srcCount: { fontSize: rf(13), fontWeight: '700' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },

  // counseling health cells
  healthCell: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  healthLbl: { fontSize: rf(11.5), fontWeight: '600' },
  healthVal: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4 },

  // agent rows
  agentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentName: { fontSize: rf(13.5), fontWeight: '700', flexShrink: 1 },
  agentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  agentStat: { fontSize: rf(11.5), fontWeight: '500' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8, marginTop: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
});
