import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  TrendingUp, ArrowLeft, Users, Clock, Target,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate, formatCurrency } from '../../utils/formatting';
import { rf } from '../../utils/responsive';
import { reportsApi, ReportFilters } from '../../api/reports';
import { aiReportsApi } from '../../api/aiReports';

// ─── Constants ──────────────────────────────────────────────────────────────
const REPORT_TABS = ['User Performance', 'School Visits', 'Pipeline', 'AI Daily (FO)', 'AI Management'];

const todayStr = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

const scoreColorHex = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#EF4444';
const ratingBg = (r: string) => {
  if (!r) return { bg: '#F3F4F6', text: '#6B7280' };
  const l = r.toLowerCase();
  if (l.includes('good')) return { bg: '#D1FAE5', text: '#059669' };
  if (l.includes('average')) return { bg: '#FEF3C7', text: '#D97706' };
  return { bg: '#FEE2E2', text: '#DC2626' };
};
const severityColor = (s: string) => {
  if (s === 'HIGH') return { bg: '#FEE2E2', text: '#DC2626' };
  if (s === 'MEDIUM') return { bg: '#FEF3C7', text: '#D97706' };
  return { bg: '#DBEAFE', text: '#2563EB' };
};

// Robust JSON parse that handles truncated Gemini output (matching web)
function safeParseJSON(str: any) {
  if (!str) return null;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { /* truncated — try repair */ }
  try {
    let s = String(str)
      .replace(/,\s*"[^"]*$/, '')
      .replace(/,\s*\[[^\]]*$/, '')
      .replace(/,\s*$/, '');
    const ob = (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
    const oq = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
    for (let i = 0; i < oq; i++) s += ']';
    for (let i = 0; i < ob; i++) s += '}';
    return JSON.parse(s);
  } catch { return null; }
}

// ─── Score Circle Component ─────────────────────────────────────────────────
const ScoreCircle = ({ score, size = 56 }: { score: number; size?: number }) => {
  const s = Math.min(100, Math.max(0, score || 0));
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  const color = scoreColorHex(s);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <Text style={{ position: 'absolute', fontSize: rf(size > 60 ? 18 : 14), fontWeight: '700', color }}>{s}</Text>
    </View>
  );
};

// ─── Section Accordion ──────────────────────────────────────────────────────
const SectionAccordion = ({ section }: { section: any }) => {
  const [open, setOpen] = useState(false);
  if (!section) return null;
  const rc = ratingBg(section.rating || '');
  return (
    <View style={acc.card}>
      <TouchableOpacity style={acc.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={acc.title}>{section.title}</Text>
          {section.rating ? (
            <View style={[acc.ratingBadge, { backgroundColor: rc.bg }]}>
              <Text style={[acc.ratingText, { color: rc.text }]}>{section.rating}</Text>
            </View>
          ) : null}
        </View>
        {open ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
      </TouchableOpacity>
      {open && (
        <View style={acc.body}>
          {section.narrative ? <Text style={acc.narrative}>{section.narrative}</Text> : null}
          {section.flags?.length > 0 && (
            <View style={acc.flagRow}>
              {section.flags.map((f: string, i: number) => (
                <View key={i} style={acc.flag}><Text style={acc.flagText}>{f}</Text></View>
              ))}
            </View>
          )}
          {section.compliancePercent != null && (
            <View style={acc.complianceRow}>
              <View style={acc.complianceBg}>
                <View style={[acc.complianceFill, {
                  width: `${Math.min(100, section.compliancePercent)}%`,
                  backgroundColor: scoreColorHex(section.compliancePercent),
                }]} />
              </View>
              <Text style={acc.compliancePct}>{section.compliancePercent}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
const acc = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA' },
  title: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  ratingText: { fontSize: rf(10), fontWeight: '700' },
  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: '#FFF' },
  narrative: { fontSize: rf(13), color: '#374151', lineHeight: 20 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  flagText: { fontSize: rf(10), color: '#DC2626', fontWeight: '600' },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  complianceBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' as const },
  complianceFill: { height: 6, borderRadius: 3 },
  compliancePct: { fontSize: rf(12), fontWeight: '600', color: '#6B7280' },
});

// ─── Main Screen ────────────────────────────────────────────────────────────
export const ReportsScreen = (_: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);

  const [activeTab, setActiveTab] = useState('User Performance');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [dateFrom] = useState(thirtyDaysAgo);
  const [dateTo] = useState(todayStr);

  // AI report states
  const [aiReports, setAiReports] = useState<any[]>([]);
  const [viewingAi, setViewingAi] = useState<any>(null);
  const [aiDetail, setAiDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const tabs = isManager ? REPORT_TABS : REPORT_TABS.filter(t => t !== 'AI Management');

  // ─── Fetch standard reports ────────────────────────────────────────────────
  const fetchReport = useCallback(async (tab: string) => {
    setLoading(true);
    setData(null);
    const filters: ReportFilters = { from: dateFrom, to: dateTo };
    try {
      let res: any;
      if (tab === 'User Performance') res = await reportsApi.getUserPerformance(filters);
      else if (tab === 'School Visits') res = await reportsApi.getSchoolVisits(filters);
      else if (tab === 'Pipeline') res = await reportsApi.getPipeline(filters);
      if (res) {
        const d = res.data?.data ?? res.data ?? res;
        setData(d);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // ─── Fetch AI reports ──────────────────────────────────────────────────────
  const fetchAiReports = useCallback(async (tab: string) => {
    setLoading(true);
    setAiReports([]);
    try {
      const filters: any = { dateFrom, dateTo };
      if (tab === 'AI Daily (FO)') filters.reportType = 'FoDaily';
      const res = await aiReportsApi.getReports(filters);
      const d: any = res.data;
      const items = Array.isArray(d) ? d : d?.items ?? d?.reports ?? [];
      // For management, exclude FoDaily
      if (tab === 'AI Management') {
        setAiReports(items.filter((r: any) => r.reportType !== 'FoDaily'));
      } else {
        setAiReports(items);
      }
    } catch {
      setAiReports([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab.startsWith('AI')) fetchAiReports(activeTab);
    else fetchReport(activeTab);
  }, [activeTab]);

  // ─── View AI report detail ─────────────────────────────────────────────────
  const viewAiReport = async (report: any) => {
    setViewingAi(report);
    setAiDetail(null);
    setLoadingDetail(true);
    try {
      const res = await aiReportsApi.getReport(report.id);
      const d: any = res.data;
      setAiDetail(d);
    } catch {
      Alert.alert('Error', 'Failed to load report details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Render standard table ─────────────────────────────────────────────────
  const renderStandardReport = () => {
    if (!data) return (
      <View style={s.emptyBox}><Text style={s.emptyIcon}>📊</Text><Text style={s.emptyText}>No data available</Text></View>
    );

    // User Performance / School Visits = array of rows
    const rows: any[] = data.items || data.rows || data.users || data.schools || (Array.isArray(data) ? data : []);
    // Pipeline = array of stage objects
    const stages: any[] = data.stages || data.pipeline || [];

    if (activeTab === 'Pipeline' && stages.length > 0) {
      return (
        <View style={s.pipelineGrid}>
          {stages.map((stage: any, i: number) => (
            <View key={i} style={s.pipelineCard}>
              <Text style={s.pipelineStage}>{stage.stage || stage.name}</Text>
              <View style={s.pipelineRow}>
                <View style={s.pipelineStat}>
                  <Text style={s.pipelineVal}>{stage.count ?? stage.deals ?? 0}</Text>
                  <Text style={s.pipelineLabel}>Deals</Text>
                </View>
                <View style={s.pipelineStat}>
                  <Text style={[s.pipelineVal, { color: '#16A34A' }]}>{formatCurrency(stage.totalValue ?? stage.value ?? 0)}</Text>
                  <Text style={s.pipelineLabel}>Value</Text>
                </View>
                <View style={s.pipelineStat}>
                  <Text style={s.pipelineVal}>{stage.avgAge ?? stage.avgDays ?? 0}d</Text>
                  <Text style={s.pipelineLabel}>Avg Age</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).filter(k => !['id', 'userId', 'foId', 'schoolId'].includes(k));
      return (
        <View style={s.tableContainer}>
          {rows.map((row: any, idx: number) => (
            <View key={idx} style={[s.tableRow, idx % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
              <Text style={s.tableIdx}>{idx + 1}</Text>
              <View style={s.tableFields}>
                {keys.slice(0, 6).map(k => (
                  <View key={k} style={s.tableField}>
                    <Text style={s.tableKey}>{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</Text>
                    <Text style={s.tableVal} numberOfLines={1}>
                      {typeof row[k] === 'number' && (k.toLowerCase().includes('revenue') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('allowance'))
                        ? formatCurrency(row[k])
                        : String(row[k] ?? '—')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    return <View style={s.emptyBox}><Text style={s.emptyIcon}>📊</Text><Text style={s.emptyText}>No records found</Text></View>;
  };

  // ─── Render AI report list ─────────────────────────────────────────────────
  const renderAiReportCard = ({ item: report }: { item: any }) => {
    const rc = ratingBg(report.overallRating || '');
    return (
      <Card style={s.aiCard} onPress={() => viewAiReport(report)}>
        <View style={s.aiCardRow}>
          <ScoreCircle score={report.overallScore} size={52} />
          <View style={s.aiCardInfo}>
            <View style={s.aiCardNameRow}>
              <Text style={s.aiCardName} numberOfLines={1}>{report.userName}</Text>
              <View style={s.aiRoleBadge}><Text style={s.aiRoleText}>{report.userRole}</Text></View>
            </View>
            <View style={s.aiCardMeta}>
              {report.reportType === 'FoDaily'
                ? <Clock size={12} color="#6B7280" />
                : <Users size={12} color="#6B7280" />}
              <Text style={s.aiMetaText}>{report.reportType === 'FoDaily' ? 'Daily Report' : 'Bi-Weekly'}</Text>
              <Text style={s.aiMetaText}>{formatDate(report.reportDate)}</Text>
            </View>
          </View>
          <View style={s.aiCardRight}>
            <View style={[s.aiRatingBadge, { backgroundColor: rc.bg }]}>
              <Text style={[s.aiRatingText, { color: rc.text }]}>{report.overallRating || 'N/A'}</Text>
            </View>
            {report.status === 'Completed' && <Eye size={16} color={COLOR.primary} />}
            {report.status === 'Generating' && <ActivityIndicator size="small" color="#F59E0B" />}
            {report.status === 'Failed' && <Text style={{ fontSize: rf(11), color: '#DC2626' }}>Failed</Text>}
          </View>
        </View>
      </Card>
    );
  };

  // ─── Render AI report detail ───────────────────────────────────────────────
  const renderAiDetail = () => {
    if (!viewingAi) return null;
    const report = aiDetail || viewingAi;
    const output = safeParseJSON(report.outputJson) || {};
    const sections = parseSections(output);
    const redFlags = parseRedFlags(output);
    const insights = parseInsights(output);
    const teamRanking = output.teamRanking || [];
    const summary = output.summary || output.executiveSummary || '';
    const scoreBd = output.scoreBreakdown || {};

    return (
      <Modal visible={!!viewingAi} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewingAi(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
          {/* Header */}
          <View style={[s.aiDetailHeader, { backgroundColor: COLOR.primary }]}>
            <TouchableOpacity onPress={() => setViewingAi(null)} style={s.aiBackBtn}>
              <ArrowLeft size={18} color="#FFF" />
              <Text style={s.aiBackText}>Back</Text>
            </TouchableOpacity>
          </View>

          {loadingDetail ? (
            <View style={s.loadCenter}><ActivityIndicator size="large" color={COLOR.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={s.aiDetailContent}>
              {/* Score Header */}
              <View style={s.aiScoreHeader}>
                <ScoreCircle score={report.overallScore} size={72} />
                <View style={{ flex: 1 }}>
                  <Text style={s.aiDetailName}>{report.userName}</Text>
                  <Text style={s.aiDetailMeta}>
                    {report.userRole} · {report.reportType === 'FoDaily' ? 'Daily' : 'Bi-Weekly'} · {formatDate(report.reportDate)}
                  </Text>
                </View>
                <View style={[s.aiRatingBadgeLg, { backgroundColor: ratingBg(report.overallRating || '').bg }]}>
                  <Text style={[s.aiRatingTextLg, { color: ratingBg(report.overallRating || '').text }]}>{report.overallRating || 'N/A'}</Text>
                </View>
              </View>

              {/* Summary */}
              {summary ? <View style={s.summaryCard}><Text style={s.summaryText}>{summary}</Text></View> : null}

              {/* Score Breakdown */}
              {Object.keys(scoreBd).length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Target size={14} color="#6B7280" /><Text style={s.sectionTitle}>Score Breakdown</Text></View>
                  <View style={s.scoreGrid}>
                    {Object.entries(scoreBd).map(([key, val]: [string, any]) => (
                      <View key={key} style={s.scoreItem}>
                        <Text style={s.scoreLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                        <View style={s.scoreBarRow}>
                          <View style={s.scoreBarBg}>
                            <View style={[s.scoreBarFill, { width: `${Math.min(100, Math.max(0, val))}%`, backgroundColor: scoreColorHex(val) }]} />
                          </View>
                          <Text style={[s.scoreNum, { color: scoreColorHex(val) }]}>{val}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Team Ranking */}
              {teamRanking.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Users size={14} color="#6B7280" /><Text style={s.sectionTitle}>Team Ranking</Text></View>
                  {teamRanking.slice(0, 15).map((fo: any, i: number) => (
                    <View key={i} style={[s.rankRow, i % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
                      <Text style={s.rankNum}>{fo.rank || i + 1}</Text>
                      <Text style={s.rankName} numberOfLines={1}>{fo.foName}</Text>
                      <Text style={[s.rankScore, { color: scoreColorHex(fo.avgDailyScore || 0) }]}>{fo.avgDailyScore || 0}</Text>
                      <Text style={s.rankObs} numberOfLines={1}>{fo.keyObservation || ''}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Detailed Analysis */}
              {sections.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Text style={s.sectionTitle}>Detailed Analysis</Text></View>
                  {sections.map((sec: any, i: number) => <SectionAccordion key={i} section={sec} />)}
                </View>
              )}

              {/* Red Flags */}
              {redFlags.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><AlertTriangle size={14} color="#DC2626" /><Text style={[s.sectionTitle, { color: '#DC2626' }]}>Red Flags ({redFlags.length})</Text></View>
                  {redFlags.map((f: any, i: number) => {
                    const sc = severityColor(f.severity || 'MEDIUM');
                    return (
                      <View key={i} style={[s.flagCard, { borderLeftColor: sc.text }]}>
                        <View style={s.flagHeader}>
                          <View style={[s.flagSeverity, { backgroundColor: sc.bg }]}>
                            <Text style={[s.flagSeverityText, { color: sc.text }]}>{f.severity || 'MEDIUM'}</Text>
                          </View>
                          {f.category ? <Text style={s.flagCategory}>{f.category}</Text> : null}
                        </View>
                        <Text style={s.flagIssue}>{f.issue}</Text>
                        {f.evidence ? <Text style={s.flagEvidence}>{f.evidence}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* AI Insights */}
              {(insights.strengths?.length > 0 || insights.problems?.length > 0 || insights.recommendations?.length > 0) && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Text style={s.sectionTitle}>AI Insights</Text></View>
                  {insights.strengths?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: '#059669' }]}>STRENGTHS</Text>
                      {insights.strengths.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><CheckCircle size={12} color="#059669" /><Text style={s.insightText}>{item}</Text></View>
                      ))}
                    </View>
                  )}
                  {(insights.problems || insights.problemAreas)?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: '#DC2626' }]}>PROBLEMS</Text>
                      {(insights.problems || insights.problemAreas).map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><AlertTriangle size={12} color="#DC2626" /><Text style={s.insightText}>{item}</Text></View>
                      ))}
                    </View>
                  )}
                  {insights.recommendations?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: '#2563EB' }]}>RECOMMENDATIONS</Text>
                      {insights.recommendations.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><TrendingUp size={12} color="#2563EB" /><Text style={s.insightText}>{item}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading report..." />
      ) : activeTab.startsWith('AI') ? (
        <FlatList
          data={aiReports}
          keyExtractor={item => String(item.id)}
          renderItem={renderAiReportCard}
          contentContainerStyle={[s.listContent, aiReports.length === 0 && { flex: 1 }]}
          ListHeaderComponent={
            <View style={s.controlsCard}>
              <Text style={s.controlsTitle}>Reports</Text>
              <Text style={s.controlsSub}>Generate and view performance reports</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabContent}>
                {tabs.map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      s.tabChip,
                      activeTab === tab && { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[s.tabText, activeTab === tab && { color: '#FFF' }]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyBox}><Text style={s.emptyIcon}>🤖</Text><Text style={s.emptyText}>No AI reports found for this period</Text></View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={s.listContent}>
          <View style={s.controlsCard}>
            <Text style={s.controlsTitle}>Reports</Text>
            <Text style={s.controlsSub}>Generate and view performance reports</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabContent}>
              {tabs.map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    s.tabChip,
                    activeTab === tab && { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[s.tabText, activeTab === tab && { color: '#FFF' }]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {renderStandardReport()}
        </ScrollView>
      )}

      {renderAiDetail()}
    </SafeAreaView>
  );
};

// ─── Helpers for AI detail ──────────────────────────────────────────────────
function parseSections(output: any) {
  // Check multiple possible keys for sections data
  const raw = output?.sections || output?.detailedAnalysis || output?.analysis || {};
  if (Array.isArray(raw)) {
    return raw.map((item: any) => {
      if (typeof item === 'string') return { title: item, narrative: '', rating: '', flags: [], compliancePercent: undefined };
      return {
        title: item.title || '',
        narrative: item.narrative || item.details || item.comments || item.content || item.summary || '',
        rating: item.rating || '',
        flags: item.flags || [],
        compliancePercent: item.compliancePercent,
      };
    }).filter((sec: any) => sec.narrative);
  }
  // Object — values can be strings, objects, or nested structures
  return Object.entries(raw).map(([key, val]: [string, any]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase()).trim();
    if (typeof val === 'string') return { title: label, narrative: val, rating: '', flags: [], compliancePercent: undefined };
    if (typeof val !== 'object' || val === null) return { title: label, narrative: String(val ?? ''), rating: '', flags: [], compliancePercent: undefined };
    return {
      title: val.title || label,
      narrative: val.narrative || val.details || val.comments || val.content || val.summary || '',
      rating: val.rating || '',
      flags: val.flags || [],
      compliancePercent: val.compliancePercent,
    };
  }).filter((sec: any) => sec.narrative);
}
function parseRedFlags(output: any) {
  return (output?.redFlags || []).map((f: any) => typeof f === 'string' ? { severity: 'MEDIUM', category: 'General', issue: f } : f);
}
function parseInsights(output: any) {
  const raw = output?.aiInsights || {};
  return Array.isArray(raw) ? { problems: raw, strengths: [], recommendations: [] } : raw;
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  controlsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  controlsTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
  controlsSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2, marginBottom: 10 },
  tabContent: { flexDirection: 'row', gap: 6 },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabText: { fontSize: rf(12), color: '#374151', fontWeight: '700' },
  listContent: { padding: 14, paddingBottom: 32 },
  loadCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF', textAlign: 'center' },
  // Standard report table
  tableContainer: { gap: 6 },
  tableRow: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 10 },
  tableIdx: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '700', minWidth: 24, paddingTop: 2 },
  tableFields: { flex: 1, gap: 4 },
  tableField: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tableKey: { fontSize: rf(12), color: '#6B7280', flex: 1, textTransform: 'capitalize' },
  tableVal: { fontSize: rf(12), color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
  // Pipeline
  pipelineGrid: { gap: 10 },
  pipelineCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  pipelineStage: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 10 },
  pipelineRow: { flexDirection: 'row', gap: 12 },
  pipelineStat: { flex: 1, alignItems: 'center' },
  pipelineVal: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  pipelineLabel: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  // AI report card
  aiCard: { padding: 14, marginBottom: 10 },
  aiCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiCardInfo: { flex: 1 },
  aiCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiCardName: { fontSize: rf(14), fontWeight: '700', color: '#111827', flex: 1 },
  aiRoleBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  aiRoleText: { fontSize: rf(10), color: '#6B7280', fontWeight: '600' },
  aiCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiMetaText: { fontSize: rf(12), color: '#6B7280' },
  aiCardRight: { alignItems: 'center', gap: 6 },
  aiRatingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  aiRatingText: { fontSize: rf(11), fontWeight: '700' },
  // AI detail
  aiDetailHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  aiBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiBackText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
  aiDetailContent: { padding: 14, gap: 14, paddingBottom: 32 },
  aiScoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  aiDetailName: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  aiDetailMeta: { fontSize: rf(12), color: '#6B7280', marginTop: 4 },
  aiRatingBadgeLg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  aiRatingTextLg: { fontSize: rf(13), fontWeight: '700' },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16 },
  summaryText: { fontSize: rf(13), color: '#374151', lineHeight: 20 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: rf(12), fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Score breakdown
  scoreGrid: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, gap: 10 },
  scoreItem: { gap: 4 },
  scoreLabel: { fontSize: rf(11), color: '#6B7280', textTransform: 'capitalize' },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBarBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreNum: { fontSize: rf(13), fontWeight: '700', minWidth: 28, textAlign: 'right' },
  // Team ranking
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8 },
  rankNum: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '700', width: 22 },
  rankName: { fontSize: rf(13), fontWeight: '600', color: '#111827', width: 80 },
  rankScore: { fontSize: rf(13), fontWeight: '700', width: 32 },
  rankObs: { fontSize: rf(11), color: '#6B7280', flex: 1 },
  // Red flags
  flagCard: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, borderLeftWidth: 3, marginBottom: 6 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  flagSeverity: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  flagSeverityText: { fontSize: rf(10), fontWeight: '700' },
  flagCategory: { fontSize: rf(11), color: '#6B7280' },
  flagIssue: { fontSize: rf(13), color: '#111827', fontWeight: '600' },
  flagEvidence: { fontSize: rf(12), color: '#6B7280', marginTop: 4 },
  // Insights
  insightGroup: { gap: 6, marginBottom: 12 },
  insightLabel: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.5 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { fontSize: rf(13), color: '#374151', flex: 1, lineHeight: 19 },
});
