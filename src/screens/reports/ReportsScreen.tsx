import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, ActivityIndicator, FlatList, useWindowDimensions,
} from 'react-native';
import { generatePDF } from 'react-native-html-to-pdf';
import RNShare from 'react-native-share';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Eye, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  TrendingUp, ArrowLeft, Users, Clock, Target, Download,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { aiReportsApi } from '../../api/aiReports';

// ─── Constants ──────────────────────────────────────────────────────────────

const REPORT_TYPE_MAP: Record<string, string> = {
  'FO Daily':   'FoDaily',
  'FO Weekly':  'FoWeekly',
  'FO Monthly': 'FoMonthly',
  'ZH Weekly':  'ZhWeekly',
  'RH Weekly':  'RhWeekly',
  'SH Weekly':  'ShWeekly',
};

const getTabsForRole = (role: string): string[] => {
  switch (role) {
    case 'ZH':  return ['FO Daily', 'FO Weekly', 'FO Monthly', 'ZH Weekly'];
    case 'RH':  return ['FO Daily', 'FO Weekly', 'FO Monthly', 'ZH Weekly', 'RH Weekly'];
    case 'SH':
    case 'SCA': return ['FO Daily', 'FO Weekly', 'FO Monthly', 'ZH Weekly', 'RH Weekly', 'SH Weekly'];
    default:    return ['FO Daily', 'FO Weekly', 'FO Monthly'];
  }
};

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
  const T = useAppTheme();
  const s = Math.min(100, Math.max(0, score || 0));
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  const color = scoreColorHex(s);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.cardAlt} strokeWidth={strokeWidth} />
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <Text style={{ position: 'absolute', fontFamily: Fonts.bold, fontSize: rf(size > 60 ? 18 : 14), color }}>{s}</Text>
    </View>
  );
};

// ─── Section Accordion ──────────────────────────────────────────────────────
const SectionAccordion = ({ section }: { section: any }) => {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);
  if (!section) return null;
  const rc = ratingBg(section.rating || '');
  return (
    <View style={[acc.card, { borderColor: T.line }]}>
      <TouchableOpacity style={[acc.header, { backgroundColor: T.cardAlt }]} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={[acc.title, { color: T.text }]}>{section.title}</Text>
          {section.rating ? (
            <View style={[acc.ratingBadge, { backgroundColor: rc.bg }]}>
              <Text style={[acc.ratingText, { color: rc.text }]}>{section.rating}</Text>
            </View>
          ) : null}
        </View>
        {open ? <ChevronUp size={16} color={T.dim} /> : <ChevronDown size={16} color={T.dim} />}
      </TouchableOpacity>
      {open && (
        <View style={[acc.body, { backgroundColor: T.card }]}>
          {section.narrative ? <Text style={[acc.narrative, { color: T.sub }]}>{section.narrative}</Text> : null}
          {section.flags?.length > 0 && (
            <View style={acc.flagRow}>
              {section.flags.map((f: string, i: number) => (
                <View key={i} style={[acc.flag, { backgroundColor: T.danger + '18', borderColor: T.danger + '33' }]}>
                  <Text style={[acc.flagText, { color: T.danger }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}
          {section.compliancePercent != null && (
            <View style={acc.complianceRow}>
              <View style={[acc.complianceBg, { backgroundColor: T.cardAlt }]}>
                <View style={[acc.complianceFill, {
                  width: `${Math.min(100, section.compliancePercent)}%`,
                  backgroundColor: scoreColorHex(section.compliancePercent),
                }]} />
              </View>
              <Text style={[acc.compliancePct, { color: T.sub }]}>{section.compliancePercent}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
const acc = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontFamily: Fonts.bold, fontSize: rf(13) },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  ratingText: { fontFamily: Fonts.bold, fontSize: rf(10) },
  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  narrative: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 20 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  flagText: { fontFamily: Fonts.medium, fontSize: rf(10) },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  complianceBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  complianceFill: { height: 6, borderRadius: 3 },
  compliancePct: { fontFamily: Fonts.medium, fontSize: rf(12) },
});

// ─── Main Screen ────────────────────────────────────────────────────────────
export const ReportsScreen = (_: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [activeTab, setActiveTab] = useState('FO Daily');
  const [loading, setLoading] = useState(false);
  const [dateFrom] = useState(thirtyDaysAgo());
  const [dateTo] = useState(todayStr());

  // AI report states
  const [aiReports, setAiReports] = useState<any[]>([]);
  const [viewingAi, setViewingAi] = useState<any>(null);
  const [aiDetail, setAiDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  const tabs = getTabsForRole(role);

  // ─── Fetch AI reports ──────────────────────────────────────────────────────
  const fetchAiReports = useCallback(async (tab: string) => {
    setLoading(true);
    setAiReports([]);
    try {
      const reportType = REPORT_TYPE_MAP[tab];
      const filters: any = { dateFrom, dateTo };
      if (reportType) filters.reportType = reportType;
      const res = await aiReportsApi.getReports(filters);
      const d: any = res.data;
      const items = Array.isArray(d) ? d : d?.items ?? d?.reports ?? [];
      setAiReports(items);
    } catch {
      setAiReports([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // All tabs are AI report tabs now
  useEffect(() => {
    fetchAiReports(activeTab);
  }, [activeTab]);

  // ─── Download PDF ──────────────────────────────────────────────────────────
  const downloadPDF = async (report: any) => {
    setPdfLoadingId(report.id);
    try {
      const res = await aiReportsApi.getReport(report.id);
      const d: any = res.data;
      const output = safeParseJSON(d?.outputJson || report.outputJson) || {};
      const sections = parseSections(output);
      const redFlags = parseRedFlags(output);
      const insights = parseInsights(output);
      const summary = output.summary || output.executiveSummary || '';
      const scoreBd = output.scoreBreakdown || {};
      const teamRanking: any[] = output.teamRanking || [];

      const sc = (v: number) => v >= 70 ? '#10B981' : v >= 50 ? '#F59E0B' : '#EF4444';
      const rtBg = (r: string) => {
        const l = (r || '').toLowerCase();
        if (l.includes('good')) return { bg: '#D1FAE5', fg: '#059669' };
        if (l.includes('average')) return { bg: '#FEF3C7', fg: '#D97706' };
        if (l.includes('poor') || l.includes('bad')) return { bg: '#FEE2E2', fg: '#DC2626' };
        return { bg: '#F3F4F6', fg: '#6B7280' };
      };
      const rc = rtBg(report.overallRating || '');
      const typeName =
        report.reportType === 'FoDaily' ? 'Daily Report' :
        report.reportType === 'FoWeekly' ? 'FO Weekly Report' :
        report.reportType === 'FoMonthly' ? 'FO Monthly Report' :
        (report.reportType?.replace(/([A-Z])/g, ' $1').trim() ?? 'Report');

      const scorePercent = Math.min(100, Math.max(0, report.overallScore || 0));
      const circumference = 2 * Math.PI * 40;
      const dashOffset = circumference - (scorePercent / 100) * circumference;

      const sectionsHtml = sections.map(sec => `
        <div class="section-item">
          <div class="section-header">
            <span class="section-title">${sec.title}</span>
            ${sec.rating ? `<span class="badge" style="background:${rtBg(sec.rating).bg};color:${rtBg(sec.rating).fg}">${sec.rating}</span>` : ''}
          </div>
          ${sec.narrative ? `<p class="narrative">${sec.narrative}</p>` : ''}
          ${sec.compliancePercent != null ? `
            <div class="progress-row">
              <div class="progress-bg"><div class="progress-fill" style="width:${sec.compliancePercent}%;background:${sc(sec.compliancePercent)}"></div></div>
              <span class="progress-pct">${sec.compliancePercent}%</span>
            </div>` : ''}
          ${sec.flags?.length ? `<div class="flag-row">${sec.flags.map((f: string) => `<span class="flag-chip">${f}</span>`).join('')}</div>` : ''}
        </div>`).join('');

      const redFlagsHtml = redFlags.length ? `
        <div class="card">
          <div class="card-title" style="color:#DC2626">⚠ Red Flags (${redFlags.length})</div>
          ${redFlags.map((f: any) => {
            const sev = f.severity === 'HIGH' ? { bg: '#FEE2E2', fg: '#DC2626' } : f.severity === 'MEDIUM' ? { bg: '#FEF3C7', fg: '#D97706' } : { bg: '#DBEAFE', fg: '#2563EB' };
            return `<div class="flag-card" style="border-left-color:${sev.fg}">
              <div style="margin-bottom:4px"><span class="badge" style="background:${sev.bg};color:${sev.fg}">${f.severity || 'MEDIUM'}</span>${f.category ? ` <span style="color:#6B7280;font-size:12px">${f.category}</span>` : ''}</div>
              <div style="font-weight:600;font-size:13px">${f.issue || ''}</div>
              ${f.evidence ? `<div style="color:#6B7280;font-size:12px;margin-top:4px">${f.evidence}</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : '';

      const insightsHtml = (insights.strengths?.length || insights.problems?.length || insights.recommendations?.length) ? `
        <div class="card">
          <div class="card-title">AI Insights</div>
          ${insights.strengths?.length ? `<div class="insight-group"><div class="insight-label" style="color:#059669">STRENGTHS</div>${insights.strengths.map((i: string) => `<div class="insight-row"><span style="color:#059669">✓</span> ${i}</div>`).join('')}</div>` : ''}
          ${(insights.problems || insights.problemAreas)?.length ? `<div class="insight-group"><div class="insight-label" style="color:#DC2626">PROBLEMS</div>${(insights.problems || insights.problemAreas).map((i: string) => `<div class="insight-row"><span style="color:#DC2626">✗</span> ${i}</div>`).join('')}</div>` : ''}
          ${insights.recommendations?.length ? `<div class="insight-group"><div class="insight-label" style="color:#2563EB">RECOMMENDATIONS</div>${insights.recommendations.map((i: string) => `<div class="insight-row"><span style="color:#2563EB">→</span> ${i}</div>`).join('')}</div>` : ''}
        </div>` : '';

      const scoreBdHtml = Object.keys(scoreBd).length ? `
        <div class="card">
          <div class="card-title">Score Breakdown</div>
          ${Object.entries(scoreBd).map(([k, v]: [string, any]) => `
            <div class="score-row">
              <span class="score-key">${k.replace(/([A-Z])/g, ' $1').trim()}</span>
              <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${Math.min(100, v)}%;background:${sc(v)}"></div></div>
              <span class="score-val" style="color:${sc(v)}">${v}</span>
            </div>`).join('')}
        </div>` : '';

      const rankHtml = teamRanking.length ? `
        <div class="card">
          <div class="card-title">Team Ranking</div>
          <table class="rank-table">
            <tr class="rank-header"><th>#</th><th>Name</th><th>Score</th><th>Observation</th></tr>
            ${teamRanking.slice(0, 15).map((fo: any, i: number) => `
              <tr class="${i % 2 === 0 ? 'rank-row-even' : ''}">
                <td class="rank-num">${fo.rank || i + 1}</td>
                <td class="rank-name">${fo.foName || ''}</td>
                <td class="rank-score" style="color:${sc(fo.avgDailyScore || 0)}">${fo.avgDailyScore || 0}</td>
                <td class="rank-obs">${fo.keyObservation || ''}</td>
              </tr>`).join('')}
          </table>
        </div>` : '';

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, Arial, sans-serif; color:#111827; background:#F9FAFB; padding:24px; font-size:13px; }
.header { background:${COLOR.primary}; color:#FFF; border-radius:12px; padding:20px 24px; margin-bottom:20px; display:flex; align-items:center; gap:20px; }
.header-score { text-align:center; }
.score-circle { position:relative; width:80px; height:80px; }
.score-circle svg { transform:rotate(-90deg); }
.score-num { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:22px; font-weight:800; color:${sc(scorePercent)}; }
.header-info { flex:1; }
.header-name { font-size:20px; font-weight:800; margin-bottom:4px; }
.header-meta { font-size:12px; opacity:0.85; margin-bottom:8px; }
.rating-badge { display:inline-block; padding:4px 12px; border-radius:100px; font-size:12px; font-weight:700; background:${rc.bg}; color:${rc.fg}; }
.card { background:#FFF; border-radius:12px; padding:16px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,0.07); }
.card-title { font-size:12px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; }
.summary { background:#FFF; border-radius:12px; padding:16px; margin-bottom:14px; font-size:13px; color:#374151; line-height:1.6; }
.section-item { border:1px solid #F3F4F6; border-radius:10px; overflow:hidden; margin-bottom:8px; }
.section-header { background:#FAFAFA; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; }
.section-title { font-size:13px; font-weight:700; color:#111827; }
.badge { display:inline-block; padding:2px 8px; border-radius:100px; font-size:11px; font-weight:700; }
.narrative { padding:10px 14px; font-size:12px; color:#374151; line-height:1.5; }
.progress-row { display:flex; align-items:center; gap:8px; padding:8px 14px; }
.progress-bg { flex:1; height:6px; background:#E5E7EB; border-radius:3px; overflow:hidden; }
.progress-fill { height:6px; border-radius:3px; }
.progress-pct { font-size:12px; font-weight:600; color:#6B7280; min-width:32px; text-align:right; }
.flag-row { padding:8px 14px; display:flex; flex-wrap:wrap; gap:6px; }
.flag-chip { background:#FEF2F2; border:1px solid #FECACA; padding:2px 8px; border-radius:100px; font-size:11px; color:#DC2626; font-weight:600; }
.flag-card { background:#FEF2F2; border-left:3px solid; border-radius:8px; padding:10px 12px; margin-bottom:8px; }
.score-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.score-key { font-size:12px; color:#6B7280; text-transform:capitalize; width:120px; flex-shrink:0; }
.score-bar-wrap { flex:1; height:6px; background:#E5E7EB; border-radius:3px; overflow:hidden; }
.score-bar-fill { height:6px; border-radius:3px; }
.score-val { font-size:13px; font-weight:700; min-width:28px; text-align:right; }
.insight-group { margin-bottom:12px; }
.insight-label { font-size:11px; font-weight:700; letter-spacing:0.5px; margin-bottom:6px; }
.insight-row { font-size:12px; color:#374151; padding:2px 0; display:flex; gap:6px; line-height:1.5; }
.rank-table { width:100%; border-collapse:collapse; }
.rank-header th { font-size:11px; color:#9CA3AF; font-weight:700; text-transform:uppercase; padding:6px 8px; text-align:left; border-bottom:1px solid #F3F4F6; }
.rank-row-even { background:#F9FAFB; }
.rank-table td { padding:8px 8px; font-size:12px; vertical-align:middle; }
.rank-num { font-weight:700; color:#9CA3AF; width:28px; }
.rank-name { font-weight:600; color:#111827; max-width:100px; }
.rank-score { font-weight:700; width:40px; }
.rank-obs { color:#6B7280; font-size:11px; }
.footer { text-align:center; color:#9CA3AF; font-size:11px; margin-top:24px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-score">
    <div class="score-circle">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="6"/>
        <circle cx="40" cy="40" r="32" fill="none" stroke="${sc(scorePercent)}" stroke-width="6"
          stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"
          stroke-linecap="round"/>
      </svg>
      <div class="score-num">${scorePercent}</div>
    </div>
  </div>
  <div class="header-info">
    <div class="header-name">${report.userName || 'Unknown'}</div>
    <div class="header-meta">${report.userRole} · ${typeName} · ${report.reportDate || ''}</div>
    <span class="rating-badge">${report.overallRating || 'N/A'}</span>
  </div>
</div>

${summary ? `<div class="summary">${summary}</div>` : ''}

${scoreBdHtml}

${rankHtml}

${sections.length ? `<div class="card"><div class="card-title">Detailed Analysis</div>${sectionsHtml}</div>` : ''}

${redFlagsHtml}

${insightsHtml}

<div class="footer">Generated by SingularityCRM · ${new Date().toLocaleDateString('en-IN')}</div>
</body>
</html>`;

      const safeName = (report.userName || 'Report').replace(/[^a-zA-Z0-9_]/g, '_');
      const pdf = await generatePDF({
        html,
        fileName: `AI_Report_${safeName}_${report.reportDate || 'unknown'}`,
        directory: 'Documents',
        base64: false,
        height: 842,
        width: 595,
      });

      if (!pdf.filePath) throw new Error('PDF generation failed');

      await RNShare.open({
        url: `file://${pdf.filePath}`,
        type: 'application/pdf',
        filename: `Report_${safeName}_${report.reportDate}.pdf`,
        failOnCancel: false,
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to generate PDF report');
      }
    } finally {
      setPdfLoadingId(null);
    }
  };

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

  // ─── Render AI report list ─────────────────────────────────────────────────
  const renderAiReportCard = ({ item: report }: { item: any }) => {
    const rc = ratingBg(report.overallRating || '');
    return (
      <Card style={s.aiCard} onPress={() => viewAiReport(report)}>
        <View style={s.aiCardRow}>
          <ScoreCircle score={report.overallScore} size={52} />
          <View style={s.aiCardInfo}>
            <View style={s.aiCardNameRow}>
              <Text style={[s.aiCardName, { color: T.text }]} numberOfLines={1}>{report.userName}</Text>
              <View style={[s.aiRoleBadge, { backgroundColor: T.cardAlt }]}><Text style={[s.aiRoleText, { color: T.sub }]}>{report.userRole}</Text></View>
            </View>
            <View style={s.aiCardMeta}>
              {report.reportType === 'FoDaily'
                ? <Clock size={12} color={T.sub} />
                : <Users size={12} color={T.sub} />}
              <Text style={[s.aiMetaText, { color: T.sub }]}>{
                report.reportType === 'FoDaily' ? 'Daily' :
                report.reportType === 'FoWeekly' ? 'FO Weekly' :
                report.reportType === 'FoMonthly' ? 'FO Monthly' :
                report.reportType?.replace('Weekly', ' Weekly') ?? 'Report'
              }</Text>
              <Text style={[s.aiMetaText, { color: T.sub }]}>{formatDate(report.reportDate)}</Text>
            </View>
          </View>
          <View style={s.aiCardRight}>
            <View style={[s.aiRatingBadge, { backgroundColor: rc.bg }]}>
              <Text style={[s.aiRatingText, { color: rc.text }]}>{report.overallRating || 'N/A'}</Text>
            </View>
            {report.status === 'Completed' && <Eye size={16} color={T.accent} />}
            {report.status === 'Completed' && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); downloadPDF(report); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={pdfLoadingId === report.id}
              >
                {pdfLoadingId === report.id
                  ? <ActivityIndicator size="small" color={T.sub} />
                  : <Download size={16} color={T.sub} />}
              </TouchableOpacity>
            )}
            {report.status === 'Generating' && <ActivityIndicator size="small" color={T.warning} />}
            {report.status === 'Failed' && <Text style={{ fontFamily: Fonts.medium, fontSize: rf(11), color: T.danger }}>Failed</Text>}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
          {/* Header */}
          <GradientBackground glow style={s.aiDetailHeader}>
            <TouchableOpacity onPress={() => setViewingAi(null)} style={s.aiBackBtn}>
              <ArrowLeft size={18} color="#FFF" />
              <Text style={s.aiBackText}>Back</Text>
            </TouchableOpacity>
          </GradientBackground>

          {loadingDetail ? (
            <View style={s.loadCenter}><ActivityIndicator size="large" color={T.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={[s.aiDetailContent, twoWide && s.centered]}>
              {/* Score Header */}
              <Card style={s.aiScoreHeader}>
                <ScoreCircle score={report.overallScore} size={72} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.aiDetailName, { color: T.text }]}>{report.userName}</Text>
                  <Text style={[s.aiDetailMeta, { color: T.sub }]}>
                    {report.userRole} · {
                      report.reportType === 'FoDaily' ? 'Daily' :
                      report.reportType === 'FoWeekly' ? 'FO Weekly' :
                      report.reportType === 'FoMonthly' ? 'FO Monthly' :
                      report.reportType?.replace('Weekly', ' Weekly') ?? 'Report'
                    } · {formatDate(report.reportDate)}
                  </Text>
                </View>
                <View style={[s.aiRatingBadgeLg, { backgroundColor: ratingBg(report.overallRating || '').bg }]}>
                  <Text style={[s.aiRatingTextLg, { color: ratingBg(report.overallRating || '').text }]}>{report.overallRating || 'N/A'}</Text>
                </View>
              </Card>

              {/* Summary */}
              {summary ? <Card style={s.summaryCard}><Text style={[s.summaryText, { color: T.text }]}>{summary}</Text></Card> : null}

              {/* Score Breakdown */}
              {Object.keys(scoreBd).length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Target size={14} color={T.sub} /><Text style={[s.sectionTitle, { color: T.sub }]}>Score Breakdown</Text></View>
                  <Card style={s.scoreGrid}>
                    {Object.entries(scoreBd).map(([key, val]: [string, any]) => (
                      <View key={key} style={s.scoreItem}>
                        <Text style={[s.scoreLabel, { color: T.sub }]}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                        <View style={s.scoreBarRow}>
                          <View style={[s.scoreBarBg, { backgroundColor: T.cardAlt }]}>
                            <View style={[s.scoreBarFill, { width: `${Math.min(100, Math.max(0, val))}%`, backgroundColor: scoreColorHex(val) }]} />
                          </View>
                          <Text style={[s.scoreNum, { color: scoreColorHex(val) }]}>{val}</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {/* Team Ranking */}
              {teamRanking.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Users size={14} color={T.sub} /><Text style={[s.sectionTitle, { color: T.sub }]}>Team Ranking</Text></View>
                  <Card padded={false} style={s.rankCard}>
                    {teamRanking.slice(0, 15).map((fo: any, i: number) => (
                      <View key={i} style={[s.rankRow, i % 2 === 0 && { backgroundColor: T.cardAlt }]}>
                        <Text style={[s.rankNum, { color: T.dim }]}>{fo.rank || i + 1}</Text>
                        <Text style={[s.rankName, { color: T.text }]} numberOfLines={1}>{fo.foName}</Text>
                        <Text style={[s.rankScore, { color: scoreColorHex(fo.avgDailyScore || 0) }]}>{fo.avgDailyScore || 0}</Text>
                        <Text style={[s.rankObs, { color: T.sub }]} numberOfLines={1}>{fo.keyObservation || ''}</Text>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {/* Detailed Analysis */}
              {sections.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Text style={[s.sectionTitle, { color: T.sub }]}>Detailed Analysis</Text></View>
                  {sections.map((sec: any, i: number) => <SectionAccordion key={i} section={sec} />)}
                </View>
              )}

              {/* Red Flags */}
              {redFlags.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><AlertTriangle size={14} color={T.danger} /><Text style={[s.sectionTitle, { color: T.danger }]}>Red Flags ({redFlags.length})</Text></View>
                  {redFlags.map((f: any, i: number) => {
                    const sc = severityColor(f.severity || 'MEDIUM');
                    return (
                      <View key={i} style={[s.flagCard, { backgroundColor: T.cardAlt, borderLeftColor: sc.text }]}>
                        <View style={s.flagHeader}>
                          <View style={[s.flagSeverity, { backgroundColor: sc.bg }]}>
                            <Text style={[s.flagSeverityText, { color: sc.text }]}>{f.severity || 'MEDIUM'}</Text>
                          </View>
                          {f.category ? <Text style={[s.flagCategory, { color: T.sub }]}>{f.category}</Text> : null}
                        </View>
                        <Text style={[s.flagIssue, { color: T.text }]}>{f.issue}</Text>
                        {f.evidence ? <Text style={[s.flagEvidence, { color: T.sub }]}>{f.evidence}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* AI Insights */}
              {(insights.strengths?.length > 0 || insights.problems?.length > 0 || insights.recommendations?.length > 0) && (
                <View style={s.section}>
                  <View style={s.sectionHeader}><Text style={[s.sectionTitle, { color: T.sub }]}>AI Insights</Text></View>
                  {insights.strengths?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.success }]}>STRENGTHS</Text>
                      {insights.strengths.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><CheckCircle size={12} color={T.success} /><Text style={[s.insightText, { color: T.text }]}>{item}</Text></View>
                      ))}
                    </View>
                  )}
                  {(insights.problems || insights.problemAreas)?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.danger }]}>PROBLEMS</Text>
                      {(insights.problems || insights.problemAreas).map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><AlertTriangle size={12} color={T.danger} /><Text style={[s.insightText, { color: T.text }]}>{item}</Text></View>
                      ))}
                    </View>
                  )}
                  {insights.recommendations?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.info }]}>RECOMMENDATIONS</Text>
                      {insights.recommendations.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}><TrendingUp size={12} color={T.info} /><Text style={[s.insightText, { color: T.text }]}>{item}</Text></View>
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
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <DrawerMenuButton />
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>AI Reports</Text>
            <Text style={s.headerSub}>AI-generated performance reports</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodScroll} contentContainerStyle={s.periodContent}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.periodPill, activeTab === tab && s.periodPillActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.periodText, activeTab === tab && s.periodTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </GradientBackground>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading report..." />
      ) : (
        <FlatList
          data={aiReports}
          keyExtractor={item => String(item.id)}
          renderItem={renderAiReportCard}
          contentContainerStyle={[s.listContent, twoWide && s.centered, aiReports.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <View style={s.emptyBox}><Text style={s.emptyIcon}>🤖</Text><Text style={[s.emptyText, { color: T.dim }]}>No AI reports found for this period</Text></View>
          }
        />
      )}

      {renderAiDetail()}
    </View>
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
  root: { flex: 1 },
  // Hero header
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12), color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  periodScroll: { marginHorizontal: -4 },
  periodContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  periodPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.16)' },
  periodPillActive: { backgroundColor: '#FFF' },
  periodText: { fontFamily: Fonts.medium, fontSize: rf(12.5), color: 'rgba(255,255,255,0.92)' },
  periodTextActive: { color: '#8C5A2E' },

  listContent: { padding: 14, paddingBottom: 32, gap: 10 },
  centered: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  loadCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: Fonts.regular, fontSize: rf(14), textAlign: 'center' },
  // AI report card
  aiCard: { padding: 14 },
  aiCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiCardInfo: { flex: 1 },
  aiCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiCardName: { fontFamily: Fonts.bold, fontSize: rf(14), flex: 1 },
  aiRoleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  aiRoleText: { fontFamily: Fonts.medium, fontSize: rf(10) },
  aiCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiMetaText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  aiCardRight: { alignItems: 'center', gap: 6 },
  aiRatingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  aiRatingText: { fontFamily: Fonts.bold, fontSize: rf(11) },
  // AI detail
  aiDetailHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  aiBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiBackText: { fontFamily: Fonts.medium, fontSize: rf(14), color: '#FFF' },
  aiDetailContent: { padding: 14, gap: 14, paddingBottom: 32 },
  aiScoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiDetailName: { fontFamily: Fonts.bold, fontSize: rf(17) },
  aiDetailMeta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 4 },
  aiRatingBadgeLg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  aiRatingTextLg: { fontFamily: Fonts.bold, fontSize: rf(13) },
  summaryCard: {},
  summaryText: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 20 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: rf(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  // Score breakdown
  scoreGrid: { gap: 10 },
  scoreItem: { gap: 4 },
  scoreLabel: { fontFamily: Fonts.regular, fontSize: rf(11), textTransform: 'capitalize' },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreNum: { fontFamily: Fonts.bold, fontSize: rf(13), minWidth: 28, textAlign: 'right' },
  // Team ranking
  rankCard: { paddingVertical: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8 },
  rankNum: { fontFamily: Fonts.bold, fontSize: rf(12), width: 22 },
  rankName: { fontFamily: Fonts.medium, fontSize: rf(13), width: 80 },
  rankScore: { fontFamily: Fonts.bold, fontSize: rf(13), width: 32 },
  rankObs: { fontFamily: Fonts.regular, fontSize: rf(11), flex: 1 },
  // Red flags
  flagCard: { borderRadius: 10, padding: 12, borderLeftWidth: 3, marginBottom: 6 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  flagSeverity: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  flagSeverityText: { fontFamily: Fonts.bold, fontSize: rf(10) },
  flagCategory: { fontFamily: Fonts.regular, fontSize: rf(11) },
  flagIssue: { fontFamily: Fonts.medium, fontSize: rf(13) },
  flagEvidence: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 4 },
  // Insights
  insightGroup: { gap: 6, marginBottom: 12 },
  insightLabel: { fontFamily: Fonts.bold, fontSize: rf(11), letterSpacing: 0.5 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { fontFamily: Fonts.regular, fontSize: rf(13), flex: 1, lineHeight: 19 },
});
