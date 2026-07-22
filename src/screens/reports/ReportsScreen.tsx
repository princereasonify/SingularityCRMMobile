import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { generatePDF } from 'react-native-html-to-pdf';
import RNShare from 'react-native-share';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  TrendingUp, ArrowLeft, Users, Clock, Target, Download, Sparkles,
  XCircle, BarChart3, AlertCircle, Calendar,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, Field, Trigger, Dropdown, StatusBadge, FormModal, Pagination, ListCard,
} from '../../components/crud';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';
import { getAppTheme, AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { Sunstone } from '../../theme/fonts';
import { aiReportsApi, AiReportType } from '../../api/aiReports';
import { dashboardApi } from '../../api/dashboard';

/**
 * AI Reports — web parity with Sales_CRM_Web/src/pages/common/Reports.jsx.
 *
 * This screen uses aiReportsApi (src/api/aiReports.ts) — NOT reportsApi. That is
 * deliberate and load-bearing:
 *   AiReportsController.cs
 *     [HttpGet]        GetReports([FromQuery] AiReportFilterDto filters)
 *        → return Ok(ApiResponse<List<AiReportListDto>>.Ok(data));
 *        AiReportFilterDto binds: ReportType, UserId, DateFrom, DateTo, Page, PageSize.
 *     [HttpGet("{id}")] GetReport(int id)
 *        → return Ok(ApiResponse<AiReportDetailDto>.Ok(data));   (404 → ApiResponse.Fail)
 *     [HttpPost("generate")] Generate([FromQuery] string type, [FromQuery] int? foId,
 *                                     [FromQuery] string? date, [FromQuery] string? dateFrom,
 *                                     [FromQuery] string? dateTo)
 *        → return Ok(ApiResponse<AiReportDetailDto>.Ok(MapReport(report)));
 *        `foId` is genuinely bound here (AiReportsController.cs:39), which is why the
 *        manager "Generate for" selector works. src/api/reports.ts declares foId/period
 *        that ReportFilters never binds — it has zero consumers and must stay that way.
 *   DashboardController.GetReportableUsers [HttpGet("reportable-users")]
 *        → return Ok(ApiResponse<List<ReportableUserDto>>.Ok(users));  ({id,name,role,zone,region})
 * apiClient unwraps the {success,data,message} envelope, so `res.data` is the payload.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

type ReportKey = 'ai-fo-daily' | 'ai-fo-weekly' | 'ai-fo-monthly' | 'ai-management';

const TYPE_LABEL: Record<ReportKey, string> = {
  'ai-fo-daily': 'FO Daily Reports',
  'ai-fo-weekly': 'FO Weekly Reports',
  'ai-fo-monthly': 'FO Monthly Reports',
  'ai-management': 'Management Weekly Reports',
};
const GENERATE_LABEL: Record<ReportKey, string> = {
  'ai-fo-daily': 'FO Daily Report',
  'ai-fo-weekly': 'FO Weekly Report',
  'ai-fo-monthly': 'FO Monthly Report',
  'ai-management': 'Management Weekly Report',
};
/** Only FO keys carry a reportType filter — web sends none for ai-management. */
const FILTER_TYPE: Partial<Record<ReportKey, string>> = {
  'ai-fo-daily': 'FoDaily',
  'ai-fo-weekly': 'FoWeekly',
  'ai-fo-monthly': 'FoMonthly',
};
const MGMT_TYPE_FOR_ROLE: Record<string, AiReportType> = {
  ZH: 'ZhWeekly', RH: 'RhWeekly', SH: 'ShWeekly', SCA: 'ScaWeekly',
};
const ROLE_GROUP_LABEL: Record<string, string> = {
  FO: 'Field Officers', ZH: 'Zonal Heads', RH: 'Regional Heads', SH: 'Sales Heads',
};

const MANAGER_ROLES = ['ZH', 'RH', 'SH', 'SCA'];
const PAGE_SIZE = 10;
const DASH = '—';
const GUTTER = 12;

const todayStr = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};
const sixDaysAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
};

const fmtCurrency = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** Score → status hue on the Sunstone status ramp. Adjacent tiers never share one. */
const scoreColor = (T: AppTheme, s: number) => (s >= 70 ? T.success : s >= 50 ? T.warning : T.danger);

/** Spec badge: colour @15% fill + solid colour text — always via withAlpha. */
const ratingTint = (T: AppTheme, r: string) => {
  if (!r) return { bg: T.cardAlt, text: T.sub };
  const l = r.toLowerCase();
  if (l.includes('good') || l.includes('excellent')) return { bg: withAlpha(T.success, SOFT_TINT), text: T.success };
  if (l.includes('average')) return { bg: withAlpha(T.warning, SOFT_TINT), text: T.warning };
  return { bg: withAlpha(T.danger, SOFT_TINT), text: T.danger };
};
const severityColor = (T: AppTheme, s: string) =>
  s === 'HIGH' ? T.danger : s === 'MEDIUM' ? T.warning : T.info;
const severityTint = (T: AppTheme, s: string) => {
  const c = severityColor(T, s);
  return { bg: withAlpha(c, SOFT_TINT), text: c };
};
const riskColor = (T: AppTheme, r: string) =>
  r === 'HIGH' ? T.danger : r === 'MEDIUM' ? T.warning : T.success;

const typeName = (t?: string) =>
  t === 'FoDaily' ? 'Daily Report' :
  t === 'FoWeekly' ? 'FO Weekly Report' :
  t === 'FoMonthly' ? 'FO Monthly Report' :
  (t?.replace(/([A-Z])/g, ' $1').trim() || 'Management Report');

const typeShort = (t?: string) =>
  t === 'FoDaily' ? 'Daily' :
  t === 'FoWeekly' ? 'FO Weekly' :
  t === 'FoMonthly' ? 'FO Monthly' :
  (t?.replace('Weekly', ' Weekly') ?? 'Report');

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

// ─── Output normalisers (support both the old and the new report format) ────
function getScore(o: any) {
  if (o?.score?.breakdown) return o.score;
  const sb = o?.scoreBreakdown || {};
  return {
    current: o?.overallScore || 0, max: 100, previous: null, trend: 'stable',
    rating: o?.overallRating || '',
    breakdown: Object.entries(sb).map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').trim(), score: v, max: 100 })),
  };
}
const getKpis = (o: any) => o?.kpis || null;
const getTargets = (o: any) => o?.targets || null;
const getAnalytics = (o: any) => o?.analytics || null;
function getRedFlags(o: any) {
  const raw = o?.red_flags || o?.redFlags || [];
  return (Array.isArray(raw) ? raw : []).map((f: any) =>
    typeof f === 'string'
      ? { severity: 'MEDIUM', category: 'General', issue: f, evidence: '' }
      : {
          severity: f.level || f.severity || 'MEDIUM',
          category: f.category || '',
          issue: f.msg || f.issue || f.message || '',
          evidence: f.evidence || '',
        },
  );
}
function getActionItems(o: any) {
  const raw = o?.action_items || o?.actionItems || o?.aiInsights?.tomorrowPriorities || o?.aiInsights?.actionItems || [];
  return Array.isArray(raw) ? raw : [];
}
function parseSections(output: any) {
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
function parseInsights(output: any) {
  const raw = output?.aiInsights || {};
  return Array.isArray(raw) ? { problems: raw, strengths: [], recommendations: [] } : raw;
}

// ─── Score Circle ───────────────────────────────────────────────────────────
const ScoreCircle = ({ score, size = 56 }: { score: number; size?: number }) => {
  const T = useAppTheme();
  const s = Math.min(100, Math.max(0, score || 0));
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  const color = scoreColor(T, s);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.cardAlt} strokeWidth={strokeWidth} />
        <SvgCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <Text style={{ position: 'absolute', fontWeight: '800', fontSize: rf(size > 60 ? 18 : 14), color }}>{s}</Text>
    </View>
  );
};

// ─── Section Accordion ──────────────────────────────────────────────────────
const SectionAccordion = ({ section }: { section: any }) => {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);
  if (!section) return null;
  const rc = ratingTint(T, section.rating || '');
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
        {open
          ? <ChevronUp size={16} color={T.dim} strokeWidth={ICON_STROKE} />
          : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>
      {open && (
        <View style={[acc.body, { backgroundColor: T.card }]}>
          {section.narrative ? <Text style={[acc.narrative, { color: T.sub }]}>{section.narrative}</Text> : null}
          {section.flags?.length > 0 && (
            <View style={acc.flagRow}>
              {section.flags.map((f: string, i: number) => (
                <View key={i} style={[acc.flag, { backgroundColor: withAlpha(T.danger, 0.1), borderColor: withAlpha(T.danger, 0.2) }]}>
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
                  backgroundColor: scoreColor(T, section.compliancePercent),
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
  title: { fontWeight: '700', fontSize: rf(13) },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  ratingText: { fontWeight: '700', fontSize: rf(10) },
  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  narrative: { fontWeight: '400', fontSize: rf(13), lineHeight: 20 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  flagText: { fontWeight: '600', fontSize: rf(10) },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  complianceBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  complianceFill: { height: 6, borderRadius: 3 },
  compliancePct: { fontWeight: '600', fontSize: rf(12) },
});

// ─── Generate modal ─────────────────────────────────────────────────────────
function GenerateModal({ reportType, role, isManager, teamFos, onGenerate, onClose }: {
  reportType: ReportKey;
  role: string;
  isManager: boolean;
  teamFos: any[];
  onGenerate: (params: any) => void;
  onClose: () => void;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const isFoReport = reportType.startsWith('ai-fo');
  const isDaily = reportType === 'ai-fo-daily';

  const [genDate, setGenDate] = useState(todayStr());
  const [genFrom, setGenFrom] = useState(sixDaysAgo());
  const [genTo, setGenTo] = useState(todayStr());
  const [genFoId, setGenFoId] = useState('');
  const [openDd, setOpenDd] = useState(false);

  const getApiType = (): AiReportType => {
    if (reportType === 'ai-management') return MGMT_TYPE_FOR_ROLE[role] || 'ZhWeekly';
    return ({ 'ai-fo-daily': 'FoDaily', 'ai-fo-weekly': 'FoWeekly', 'ai-fo-monthly': 'FoMonthly' } as any)[reportType] || 'FoDaily';
  };

  // Grouped exactly like web: "<Role label> — <zone|region>".
  const foOptions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (teamFos || []).forEach(u => {
      const g = ROLE_GROUP_LABEL[u.role] || u.role || 'Team';
      const sub = u.zone || u.region || '';
      const key = sub ? `${g} — ${sub}` : g;
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    });
    const out: { label: string; value: string }[] = [{ label: 'All (batch)', value: '' }];
    Object.entries(groups).forEach(([g, list]) => {
      list.forEach(u => out.push({ label: `${u.name} (${u.role}) · ${g}`, value: String(u.id) }));
    });
    return out;
  }, [teamFos]);

  const selectedFo = foOptions.find(o => o.value === genFoId);

  const handleSubmit = () => {
    const params: any = { type: getApiType() };
    if (isFoReport && isManager && genFoId) params.foId = Number(genFoId);
    if (isDaily) params.date = genDate;
    else { params.dateFrom = genFrom; params.dateTo = genTo; }
    onGenerate(params);
  };

  return (
    <FormModal
      visible
      title="Generate Report"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label="Generate"
            onPress={handleSubmit}
            small
            icon={<Sparkles size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <View style={[s.typeTile, { backgroundColor: T.accentSoft }]}>
          <Sparkles size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          <Text style={[s.typeTileTxt, { color: T.accent }]}>{GENERATE_LABEL[reportType]}</Text>
        </View>

        {isFoReport && isManager && (
          <Field label="Generate for">
            <Trigger
              label={selectedFo ? selectedFo.label : 'All (batch)'}
              open={openDd}
              onPress={() => setOpenDd(o => !o)}
              icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
            {openDd && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={220}
                value={genFoId}
                onSelect={v => { setGenFoId(v); setOpenDd(false); }}
                options={foOptions}
              />
            )}
          </Field>
        )}

        {isDaily ? (
          <Field label="Report Date">
            {/* Reports can't cover a future date — latest selectable day is today. */}
            <DateInput value={genDate} onChange={setGenDate} accentColor={T.accent} maxDate={todayStr()} />
          </Field>
        ) : (
          <View style={wide ? s.row2 : s.col2}>
            <Field label="From" style={{ flex: 1 }}>
              {/* From cannot be after To, and neither can be in the future. */}
              <DateInput value={genFrom} onChange={setGenFrom} accentColor={T.accent} maxDate={genTo || todayStr()} />
            </Field>
            <Field label="To" style={{ flex: 1 }}>
              <DateInput value={genTo} onChange={setGenTo} accentColor={T.accent} minDate={genFrom} maxDate={todayStr()} />
            </Field>
          </View>
        )}
      </View>
    </FormModal>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export const ReportsScreen = (_: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the real table — never a card grid. Phones get kit list rows. */
  const table = isTabletDevice;
  const role = user?.role || 'FO';
  /** Web renders "Generate Report" for EVERY role — no manager gate on the button. */
  const isManager = MANAGER_ROLES.includes(role);

  const [reportType, setReportType] = useState<ReportKey>('ai-fo-daily');
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(todayStr());
  const [openTypeDd, setOpenTypeDd] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [aiReports, setAiReports] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  const [viewingAi, setViewingAi] = useState<any>(null);
  const [aiDetail, setAiDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [teamFos, setTeamFos] = useState<any[]>([]);

  // Web offers Management Reports only to ZH/RH/SH/SCA — mirror exactly.
  const typeOptions: { label: string; value: ReportKey }[] = [
    { label: TYPE_LABEL['ai-fo-daily'], value: 'ai-fo-daily' },
    { label: TYPE_LABEL['ai-fo-weekly'], value: 'ai-fo-weekly' },
    { label: TYPE_LABEL['ai-fo-monthly'], value: 'ai-fo-monthly' },
    ...(isManager ? [{ label: TYPE_LABEL['ai-management'], value: 'ai-management' as ReportKey }] : []),
  ];

  useEffect(() => {
    if (!isManager) return;
    dashboardApi.getReportableUsers()
      .then(res => setTeamFos(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [isManager]);

  // ─── Fetch AI reports ──────────────────────────────────────────────────────
  const fetchAiReports = useCallback(async (type: ReportKey, from: string, to: string) => {
    setLoadFailed(false);
    try {
      // AiReportFilterDto binds DateFrom / DateTo / ReportType / PageSize (whole DTO).
      // Server defaults PageSize=20, so without this the list was silently capped at 20
      // (client paginates the returned set at 10). Request the full window; the client
      // then pages over all of it.
      const filters: any = { dateFrom: from, dateTo: to, pageSize: 500 };
      const ft = FILTER_TYPE[type];
      if (ft) filters.reportType = ft;
      const res = await aiReportsApi.getReports(filters);
      let list: any[] = Array.isArray(res.data) ? res.data : [];
      // Web filters management reports client-side — it sends no reportType for them.
      if (type === 'ai-management') list = list.filter(r => !String(r.reportType || '').startsWith('Fo'));
      setAiReports(list);
    } catch {
      setAiReports([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchAiReports(reportType, dateFrom, dateTo);
  }, [reportType, dateFrom, dateTo, fetchAiReports]);

  const handleGenerate = useCallback(async (params: any) => {
    setShowGenerate(false);
    setGenerating(true);
    try {
      // POST /ai-reports/generate — every field is [FromQuery] on the controller.
      await aiReportsApi.generate(params);
      Alert.alert('Report generated', 'Your report has been generated successfully.');
      setLoading(true);
      fetchAiReports(reportType, dateFrom, dateTo);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [reportType, dateFrom, dateTo, fetchAiReports]);

  // ─── Download PDF (unchanged pipeline: html-to-pdf → RNShare) ──────────────
  const downloadPDF = async (report: any) => {
    setPdfLoadingId(report.id);
    try {
      const res = await aiReportsApi.getReport(report.id);
      const d: any = res.data;
      const output = safeParseJSON(d?.outputJson || report.outputJson) || {};
      const sections = parseSections(output);
      const redFlags = getRedFlags(output);
      const insights = parseInsights(output);
      const actionItems = getActionItems(output);
      const summary = output.summary || output.executiveSummary || '';
      const score = getScore(output);
      const teamRanking: any[] = output.teamRanking || [];

      // A PDF is a printed artefact — it always renders on the LIGHT palette,
      // regardless of the in-app theme the user is currently viewing.
      const LT = getAppTheme('light');
      const sc = (v: number) => scoreColor(LT, v);
      const rtBg = (r: string) => {
        const t = ratingTint(LT, r || '');
        return { bg: t.bg, fg: t.text };
      };
      const rc = rtBg(report.overallRating || '');
      const tName = typeName(report.reportType);

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
          <div class="card-title" style="color:${LT.danger}">⚠ Red Flags (${redFlags.length})</div>
          ${redFlags.map((f: any) => {
            const sev = severityTint(LT, f.severity || 'MEDIUM');
            return `<div class="flag-card" style="border-left-color:${sev.text}">
              <div style="margin-bottom:4px"><span class="badge" style="background:${sev.bg};color:${sev.text}">${f.severity || 'MEDIUM'}</span>${f.category ? ` <span style="color:${LT.sub};font-size:12px">${f.category}</span>` : ''}</div>
              <div style="font-weight:600;font-size:13px">${f.issue || ''}</div>
              ${f.evidence ? `<div style="color:${LT.sub};font-size:12px;margin-top:4px">${f.evidence}</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : '';

      const insightsHtml = (insights.strengths?.length || insights.problems?.length || insights.recommendations?.length) ? `
        <div class="card">
          <div class="card-title">AI Insights</div>
          ${insights.strengths?.length ? `<div class="insight-group"><div class="insight-label" style="color:${LT.success}">STRENGTHS</div>${insights.strengths.map((i: string) => `<div class="insight-row"><span style="color:${LT.success}">✓</span> ${i}</div>`).join('')}</div>` : ''}
          ${(insights.problems || insights.problemAreas)?.length ? `<div class="insight-group"><div class="insight-label" style="color:${LT.danger}">PROBLEMS</div>${(insights.problems || insights.problemAreas).map((i: string) => `<div class="insight-row"><span style="color:${LT.danger}">✗</span> ${i}</div>`).join('')}</div>` : ''}
          ${insights.recommendations?.length ? `<div class="insight-group"><div class="insight-label" style="color:${LT.info}">RECOMMENDATIONS</div>${insights.recommendations.map((i: string) => `<div class="insight-row"><span style="color:${LT.info}">→</span> ${i}</div>`).join('')}</div>` : ''}
        </div>` : '';

      const actionItemsHtml = actionItems.length ? `
        <div class="card">
          <div class="card-title">Action Items</div>
          ${actionItems.map((item: any, i: number) => `
            <div class="insight-row"><span style="color:${LT.accent};font-weight:700">${i + 1}.</span> ${typeof item === 'string' ? item : item.action || ''}</div>`).join('')}
        </div>` : '';

      const scoreBdHtml = score.breakdown?.length ? `
        <div class="card">
          <div class="card-title">Score Breakdown</div>
          ${score.breakdown.map((b: any) => `
            <div class="score-row">
              <span class="score-key">${b.label}</span>
              <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${Math.min(100, (Number(b.score) / (b.max || 100)) * 100)}%;background:${sc((Number(b.score) / (b.max || 100)) * 100)}"></div></div>
              <span class="score-val" style="color:${sc((Number(b.score) / (b.max || 100)) * 100)}">${b.score}</span>
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
body { font-family: -apple-system, Arial, sans-serif; color:${LT.text}; background:${LT.bg}; padding:24px; font-size:13px; }
.header { background:linear-gradient(135deg, ${Sunstone.deep} 0%, ${Sunstone.from} 55%, ${Sunstone.to} 100%); color:#FFF; border-radius:12px; padding:20px 24px; margin-bottom:20px; display:flex; align-items:center; gap:20px; }
.header-score { text-align:center; }
.score-circle { position:relative; width:80px; height:80px; }
.score-circle svg { transform:rotate(-90deg); }
.score-num { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:22px; font-weight:800; color:${sc(scorePercent)}; }
.header-info { flex:1; }
.header-name { font-size:20px; font-weight:800; margin-bottom:4px; }
.header-meta { font-size:12px; opacity:0.85; margin-bottom:8px; }
.rating-badge { display:inline-block; padding:4px 12px; border-radius:100px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.92); color:${rc.fg}; }
.card { background:${LT.card}; border-radius:12px; padding:16px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,0.07); }
.card-title { font-size:12px; font-weight:700; color:${LT.sub}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; }
.summary { background:${LT.card}; border-radius:12px; padding:16px; margin-bottom:14px; font-size:13px; color:${LT.text}; line-height:1.6; }
.section-item { border:1px solid ${LT.line}; border-radius:10px; overflow:hidden; margin-bottom:8px; }
.section-header { background:${LT.cardAlt}; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; }
.section-title { font-size:13px; font-weight:700; color:${LT.text}; }
.badge { display:inline-block; padding:2px 8px; border-radius:100px; font-size:11px; font-weight:700; }
.narrative { padding:10px 14px; font-size:12px; color:${LT.sub}; line-height:1.5; }
.progress-row { display:flex; align-items:center; gap:8px; padding:8px 14px; }
.progress-bg { flex:1; height:6px; background:${LT.cardAlt}; border-radius:3px; overflow:hidden; }
.progress-fill { height:6px; border-radius:3px; }
.progress-pct { font-size:12px; font-weight:600; color:${LT.sub}; min-width:32px; text-align:right; }
.flag-row { padding:8px 14px; display:flex; flex-wrap:wrap; gap:6px; }
.flag-chip { background:${withAlpha(LT.danger, 0.1)}; border:1px solid ${withAlpha(LT.danger, 0.2)}; padding:2px 8px; border-radius:100px; font-size:11px; color:${LT.danger}; font-weight:600; }
.flag-card { background:${LT.cardAlt}; border-left:3px solid; border-radius:8px; padding:10px 12px; margin-bottom:8px; }
.score-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.score-key { font-size:12px; color:${LT.sub}; text-transform:capitalize; width:120px; flex-shrink:0; }
.score-bar-wrap { flex:1; height:6px; background:${LT.cardAlt}; border-radius:3px; overflow:hidden; }
.score-bar-fill { height:6px; border-radius:3px; }
.score-val { font-size:13px; font-weight:700; min-width:28px; text-align:right; }
.insight-group { margin-bottom:12px; }
.insight-label { font-size:11px; font-weight:700; letter-spacing:0.5px; margin-bottom:6px; }
.insight-row { font-size:12px; color:${LT.text}; padding:2px 0; display:flex; gap:6px; line-height:1.5; }
.rank-table { width:100%; border-collapse:collapse; }
.rank-header th { font-size:11px; color:${LT.dim}; font-weight:700; text-transform:uppercase; padding:6px 8px; text-align:left; border-bottom:1px solid ${LT.line}; }
.rank-row-even { background:${LT.cardAlt}; }
.rank-table td { padding:8px 8px; font-size:12px; vertical-align:middle; }
.rank-num { font-weight:700; color:${LT.dim}; width:28px; }
.rank-name { font-weight:600; color:${LT.text}; max-width:100px; }
.rank-score { font-weight:700; width:40px; }
.rank-obs { color:${LT.sub}; font-size:11px; }
.footer { text-align:center; color:${LT.dim}; font-size:11px; margin-top:24px; }
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
    <div class="header-meta">${report.userRole} · ${tName} · ${report.reportDate || ''}</div>
    <span class="rating-badge">${report.overallRating || 'N/A'}</span>
  </div>
</div>

${summary ? `<div class="summary">${summary}</div>` : ''}

${scoreBdHtml}

${rankHtml}

${sections.length ? `<div class="card"><div class="card-title">Detailed Analysis</div>${sectionsHtml}</div>` : ''}

${redFlagsHtml}

${insightsHtml}

${actionItemsHtml}

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
      setAiDetail(res.data as any);
    } catch {
      Alert.alert('Error', 'Failed to load report details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(aiReports.length / PAGE_SIZE));
  const paged = useMemo(
    () => aiReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [aiReports, page],
  );

  // ─── Row actions (identical on the table and the phone list rows) ──────────
  const reportActions = (report: any) => (
    <View style={s.actions}>
      {report.status === 'Completed' && (
        <>
          <TouchableOpacity onPress={() => viewAiReport(report)} hitSlop={8}>
            <Eye size={16} color={T.accent} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => downloadPDF(report)}
            hitSlop={8}
            disabled={pdfLoadingId === report.id}
          >
            {pdfLoadingId === report.id
              ? <ActivityIndicator size="small" color={T.sub} />
              : <Download size={16} color={T.sub} strokeWidth={ICON_STROKE} />}
          </TouchableOpacity>
        </>
      )}
      {report.status === 'Generating' && <ActivityIndicator size="small" color={T.warning} />}
      {report.status === 'Failed' && (
        <Text style={[s.failTxt, { color: T.danger }]}>Failed</Text>
      )}
    </View>
  );

  // ─── Table (tablet) ────────────────────────────────────────────────────────
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cScore]}>Score</Text>
        <Text style={[s.th, { color: T.dim }, s.cName]}>Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cType]}>Report Type</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Report Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cRating]}>Rating</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        <Text style={[s.th, { color: T.dim }, s.cAct]}>Actions</Text>
      </View>

      {paged.map(report => {
        const rc = ratingTint(T, report.overallRating || '');
        return (
          <TouchableOpacity
            key={report.id}
            activeOpacity={0.7}
            onPress={() => viewAiReport(report)}
            style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
          >
            <View style={s.cScore}>
              <ScoreCircle score={report.overallScore} size={44} />
            </View>
            <View style={s.cName}>
              <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>
                {report.userName || DASH}
              </Text>
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                {report.userRole || DASH}
              </Text>
            </View>
            <View style={[s.cType, s.typeCell]}>
              {String(report.reportType || '').startsWith('Fo')
                ? <Clock size={12} color={T.dim} strokeWidth={ICON_STROKE} />
                : <Users size={12} color={T.dim} strokeWidth={ICON_STROKE} />}
              <Text style={[s.td, { color: T.sub, flexShrink: 1 }]} numberOfLines={1}>
                {typeShort(report.reportType)}
              </Text>
            </View>
            <Text style={[s.td, { color: T.sub }, s.cDate]} numberOfLines={1}>
              {formatDate(report.reportDate)}
            </Text>
            <View style={s.cRating}>
              <View style={[s.aiRatingBadge, { backgroundColor: rc.bg }]}>
                <Text style={[s.aiRatingText, { color: rc.text }]} numberOfLines={1}>
                  {report.overallRating || 'N/A'}
                </Text>
              </View>
            </View>
            <View style={s.cStatus}>
              <StatusBadge label={report.status || DASH} color={T.sub} />
            </View>
            <View style={s.cAct}>{reportActions(report)}</View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── List rows (phone) ─────────────────────────────────────────────────────
  const renderRows = () => (
    <View style={{ gap: 10 }}>
      {paged.map(report => {
        const rc = ratingTint(T, report.overallRating || '');
        return (
          <ListCard key={report.id} onPress={() => viewAiReport(report)}>
            <ScoreCircle score={report.overallScore} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.aiCardNameRow}>
                <Text style={[s.tdName, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
                  {report.userName || DASH}
                </Text>
                <StatusBadge label={report.userRole} color={T.sub} />
              </View>
              <View style={s.aiCardMeta}>
                {String(report.reportType || '').startsWith('Fo')
                  ? <Clock size={12} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <Users size={12} color={T.dim} strokeWidth={ICON_STROKE} />}
                <Text style={[s.aiMetaText, { color: T.sub }]}>{typeShort(report.reportType)}</Text>
                <Text style={[s.aiMetaText, { color: T.dim }]}>{formatDate(report.reportDate)}</Text>
              </View>
              <View style={[s.aiRatingBadge, { backgroundColor: rc.bg, marginTop: 6 }]}>
                <Text style={[s.aiRatingText, { color: rc.text }]} numberOfLines={1}>
                  {report.overallRating || 'N/A'}
                </Text>
              </View>
            </View>
            {reportActions(report)}
          </ListCard>
        );
      })}
    </View>
  );

  // ─── Detail ────────────────────────────────────────────────────────────────
  const renderAiDetail = () => {
    if (!viewingAi) return null;
    const report = aiDetail || viewingAi;
    const output = safeParseJSON(report.outputJson) || {};
    const meta = output.meta || {};
    const score = getScore(output);
    const kpis = getKpis(output);
    const targets = getTargets(output);
    const analytics = getAnalytics(output);
    const redFlags = getRedFlags(output);
    const actionItems = getActionItems(output);
    const sections = parseSections(output);
    const insights = parseInsights(output);
    const teamRanking = output.teamRanking || [];
    const summary = output.summary || output.executiveSummary || '';
    const tb = output.data?.time_breakdown;
    const rating = report.overallRating || score.rating || '';
    const rt = ratingTint(T, rating);
    const foName = meta.fo_name || report.userName || '';
    const period = meta.period || formatDate(report.reportDate);

    const tbTotal = tb
      ? (tb.in_school_min || 0) + (tb.travelling_min || 0) + (tb.idle_min || 0) + (tb.unaccounted_min || 0)
      : 0;
    const tbItems = tb ? [
      { label: 'In School', value: tb.in_school_min || 0, color: T.success },
      { label: 'Travelling', value: tb.travelling_min || 0, color: T.info },
      { label: 'Idle', value: tb.idle_min || 0, color: T.warning },
      { label: 'Unaccounted', value: tb.unaccounted_min || 0, color: T.danger },
    ] : [];

    const maxFunnel = analytics?.conversion_funnel?.length
      ? Math.max(...analytics.conversion_funnel.map((f: any) => f.count || 0), 1)
      : 1;

    return (
      <Modal
        visible={!!viewingAi}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewingAi(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top', 'bottom']}>
          <View style={[s.detailBar, { borderBottomColor: T.line }]}>
            <TouchableOpacity onPress={() => setViewingAi(null)} style={s.backBtn} hitSlop={8}>
              <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.backTxt, { color: T.accent }]}>Back to list</Text>
            </TouchableOpacity>
            <Btn
              label="Download PDF"
              small
              onPress={() => downloadPDF(report)}
              loading={pdfLoadingId === report.id}
              icon={<Download size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </View>

          {loadingDetail ? (
            <View style={s.loadCenter}><ActivityIndicator size="large" color={T.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={[s.detailContent, wide && s.detailWide]}>
              <Card style={s.scoreHeader}>
                <ScoreCircle score={score.current || report.overallScore} size={72} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.detailName, { color: T.text }]} numberOfLines={1}>{foName}</Text>
                  <Text style={[s.detailMeta, { color: T.sub }]} numberOfLines={2}>
                    {[meta.zone, meta.region].filter(Boolean).join(' · ') || report.userRole} · {typeShort(report.reportType)} · {period}
                  </Text>
                  {score.previous != null && (
                    <Text style={[s.detailPrev, { color: T.dim }]}>
                      Previous: {score.previous} ({score.trend === 'up' ? '↑' : score.trend === 'down' ? '↓' : '→'})
                    </Text>
                  )}
                </View>
                <View style={[s.aiRatingBadgeLg, { backgroundColor: rt.bg }]}>
                  <Text style={[s.aiRatingTextLg, { color: rt.text }]}>{rating || 'N/A'}</Text>
                </View>
              </Card>

              {!!summary && (
                <Card><Text style={[s.summaryText, { color: T.text }]}>{summary}</Text></Card>
              )}

              {!!kpis && Object.keys(kpis).length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <BarChart3 size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Key Metrics</Text>
                  </View>
                  <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
                    {Object.entries(kpis).map(([key, v]: [string, any]) => (
                      <View key={key} style={{ width: wide ? '20%' : '50%', padding: GUTTER / 2 }}>
                        <Card style={s.kpiCard}>
                          <Text style={[s.kpiLabel, { color: T.dim }]} numberOfLines={2}>{key.replace(/_/g, ' ')}</Text>
                          <Text style={[s.kpiVal, { color: T.text }]} numberOfLines={1}>
                            {v?.unit === '₹' ? fmtCurrency(v?.value) : `${v?.value ?? DASH}`}
                            {v?.unit && v.unit !== '₹' ? ` ${v.unit}` : ''}
                          </Text>
                          {v?.target != null && (
                            <Text style={[s.kpiSub, { color: T.dim }]} numberOfLines={1}>
                              Target: {v.target}{v.unit && v.unit !== '₹' ? v.unit : ''}
                            </Text>
                          )}
                        </Card>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!!targets?.revenue?.target && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Target size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Target Achievement</Text>
                  </View>
                  <Card style={{ gap: 14 }}>
                    <View>
                      <View style={s.betweenRow}>
                        <Text style={[s.tLabel, { color: T.sub }]}>Revenue</Text>
                        <Text style={[s.tVal, { color: T.text }]}>
                          {fmtCurrency(targets.revenue.achieved || 0)} / {fmtCurrency(targets.revenue.target)}
                        </Text>
                      </View>
                      <View style={[s.bar, { backgroundColor: T.cardAlt }]}>
                        <View style={[s.barFill, {
                          width: `${Math.min(100, targets.revenue.pct || 0)}%`,
                          backgroundColor: scoreColor(T, targets.revenue.pct || 0),
                        }]} />
                      </View>
                      <Text style={[s.kpiSub, { color: T.dim }]}>{targets.revenue.pct || 0}% achieved</Text>
                    </View>
                    {!!targets.visits_monthly?.target && (
                      <View>
                        <View style={s.betweenRow}>
                          <Text style={[s.tLabel, { color: T.sub }]}>Schools Visited</Text>
                          <Text style={[s.tVal, { color: T.text }]}>
                            {targets.visits_monthly.achieved || 0} / {targets.visits_monthly.target}
                          </Text>
                        </View>
                        <View style={[s.bar, { backgroundColor: T.cardAlt }]}>
                          <View style={[s.barFill, {
                            width: `${Math.min(100, targets.visits_monthly.pct || 0)}%`,
                            backgroundColor: scoreColor(T, targets.visits_monthly.pct || 0),
                          }]} />
                        </View>
                        <Text style={[s.kpiSub, { color: T.dim }]}>
                          {targets.visits_monthly.pct || 0}% | {targets.days_remaining || 0} days left
                        </Text>
                      </View>
                    )}
                  </Card>
                </View>
              )}

              {score.breakdown?.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Target size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Score Breakdown</Text>
                  </View>
                  <Card style={{ gap: 10 }}>
                    {score.breakdown.map((b: any, i: number) => {
                      const p = b.max > 0 ? Math.min(100, (Number(b.score) / b.max) * 100) : 0;
                      return (
                        <View key={i} style={{ gap: 4 }}>
                          <Text style={[s.scoreLabel, { color: T.sub }]}>{b.label}</Text>
                          <View style={s.scoreBarRow}>
                            <View style={[s.bar, { backgroundColor: T.cardAlt, flex: 1, marginTop: 0 }]}>
                              <View style={[s.barFill, { width: `${p}%`, backgroundColor: scoreColor(T, p) }]} />
                            </View>
                            <Text style={[s.scoreNum, { color: scoreColor(T, p) }]}>
                              {Number(b.score).toFixed(0)}/{b.max}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </View>
              )}

              {!!tb && tbTotal > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Clock size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Time Utilization</Text>
                  </View>
                  <Card style={{ gap: 10 }}>
                    <View style={[s.stack, { backgroundColor: T.cardAlt }]}>
                      {tbItems.filter(it => it.value > 0).map(it => (
                        <View
                          key={it.label}
                          style={{ width: `${(it.value / tbTotal) * 100}%`, backgroundColor: it.color }}
                        />
                      ))}
                    </View>
                    <View style={s.legendWrap}>
                      {tbItems.map(it => (
                        <View key={it.label} style={s.legend}>
                          <View style={[s.legendDot, { backgroundColor: it.color }]} />
                          <Text style={[s.legendTxt, { color: T.sub }]}>{it.label}: {it.value}m</Text>
                        </View>
                      ))}
                    </View>
                    {tb.productive_pct != null && (
                      <Text style={[s.legendTxt, { color: T.sub, textAlign: 'center' }]}>
                        Productive: <Text style={{ fontWeight: '800', color: scoreColor(T, tb.productive_pct) }}>{tb.productive_pct}%</Text>
                      </Text>
                    )}
                  </Card>
                </View>
              )}

              {analytics?.deal_aging?.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <AlertTriangle size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Deal Aging</Text>
                  </View>
                  <Card style={{ gap: 8 }}>
                    {analytics.deal_aging.map((d: any, i: number) => {
                      const c = riskColor(T, d.risk);
                      return (
                        <View key={i} style={[s.agingRow, { backgroundColor: withAlpha(c, 0.06), borderColor: withAlpha(c, 0.18) }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.agingName, { color: T.text }]} numberOfLines={1}>{d.school}</Text>
                            <Text style={[s.kpiSub, { color: T.sub }]} numberOfLines={1}>
                              {d.stage} · {fmtCurrency(d.value)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 3 }}>
                            <Text style={[s.agingDays, { color: c }]}>{d.days_in_stage}d</Text>
                            <StatusBadge label={d.risk} color={c} />
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </View>
              )}

              {analytics?.conversion_funnel?.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <TrendingUp size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Pipeline Funnel</Text>
                  </View>
                  <Card style={{ gap: 8 }}>
                    {analytics.conversion_funnel.map((f: any) => (
                      <View key={f.stage} style={s.funnelRow}>
                        <Text style={[s.funnelStage, { color: T.sub }]} numberOfLines={1}>{f.stage}</Text>
                        <View style={[s.funnelTrack, { backgroundColor: T.cardAlt }]}>
                          <View style={[s.funnelFill, {
                            width: `${((f.count || 0) / maxFunnel) * 100}%`,
                            backgroundColor: T.accent,
                          }]} />
                          <Text style={[s.funnelCount, { color: T.text }]}>{f.count || 0}</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {analytics?.top_visits?.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <CheckCircle size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Top Visits</Text>
                  </View>
                  <Card style={{ gap: 8 }}>
                    {analytics.top_visits.map((v: any, i: number) => (
                      <View key={i} style={[s.visitRow, { backgroundColor: T.cardAlt }]}>
                        <View style={[s.visitScore, { backgroundColor: T.accentSoft }]}>
                          <Text style={[s.visitScoreTxt, { color: T.accent }]}>{v.quality_score}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.agingName, { color: T.text }]} numberOfLines={1}>{v.school}</Text>
                          <Text style={[s.kpiSub, { color: T.dim }]} numberOfLines={1}>
                            {v.duration_min}m · {v.outcome}{v.person_met && v.person_met !== 'None' ? ` · ${v.person_met}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {analytics?.lost_deals?.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <XCircle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.danger }]}>Lost Deals ({analytics.lost_deals.length})</Text>
                  </View>
                  <Card style={{ gap: 8 }}>
                    {analytics.lost_deals.map((d: any, i: number) => (
                      <View key={i} style={[s.agingRow, { backgroundColor: withAlpha(T.danger, 0.06), borderColor: withAlpha(T.danger, 0.18) }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.agingName, { color: T.text }]} numberOfLines={1}>{d.school}</Text>
                          <Text style={[s.kpiSub, { color: T.sub }]} numberOfLines={2}>
                            {d.reason || 'Unknown reason'}{d.fo ? ` · ${d.fo}` : ''}{d.stage_lost_at ? ` · Lost at ${d.stage_lost_at}` : ''}
                          </Text>
                        </View>
                        <Text style={[s.agingDays, { color: T.danger }]}>{fmtCurrency(d.value)}</Text>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {teamRanking.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Team Ranking</Text>
                  </View>
                  <Card padded={false} style={s.rankCard}>
                    {teamRanking.slice(0, 15).map((fo: any, i: number) => (
                      <View key={i} style={[s.rankRow, i % 2 === 0 && { backgroundColor: T.cardAlt }]}>
                        <Text style={[s.rankNum, { color: T.dim }]}>{fo.rank || i + 1}</Text>
                        <Text style={[s.rankName, { color: T.text }]} numberOfLines={1}>{fo.foName}</Text>
                        <Text style={[s.rankScore, { color: scoreColor(T, fo.avgDailyScore || 0) }]}>{fo.avgDailyScore || 0}</Text>
                        <Text style={[s.rankObs, { color: T.sub }]} numberOfLines={2}>{fo.keyObservation || ''}</Text>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {sections.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={[s.sectionTitle, { color: T.sub }]}>Detailed Analysis</Text>
                  </View>
                  {sections.map((sec: any, i: number) => <SectionAccordion key={i} section={sec} />)}
                </View>
              )}

              {redFlags.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <AlertTriangle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.danger }]}>Red Flags ({redFlags.length})</Text>
                  </View>
                  {redFlags.map((f: any, i: number) => {
                    const sev = severityTint(T, f.severity || 'MEDIUM');
                    return (
                      <View key={i} style={[s.flagCard, { backgroundColor: T.cardAlt, borderLeftColor: sev.text }]}>
                        <View style={s.flagHeader}>
                          <View style={[s.flagSeverity, { backgroundColor: sev.bg }]}>
                            <Text style={[s.flagSeverityText, { color: sev.text }]}>{f.severity || 'MEDIUM'}</Text>
                          </View>
                          {!!f.category && <Text style={[s.flagCategory, { color: T.sub }]}>{f.category}</Text>}
                        </View>
                        <Text style={[s.flagIssue, { color: T.text }]}>{f.issue}</Text>
                        {!!f.evidence && <Text style={[s.flagEvidence, { color: T.sub }]}>{f.evidence}</Text>}
                      </View>
                    );
                  })}
                </View>
              )}

              {(insights.strengths?.length > 0 || insights.problems?.length > 0 || insights.recommendations?.length > 0) && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={[s.sectionTitle, { color: T.sub }]}>AI Insights</Text>
                  </View>
                  {insights.strengths?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.success }]}>STRENGTHS</Text>
                      {insights.strengths.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}>
                          <CheckCircle size={12} color={T.success} strokeWidth={ICON_STROKE} />
                          <Text style={[s.insightText, { color: T.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {(insights.problems || insights.problemAreas)?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.danger }]}>PROBLEMS</Text>
                      {(insights.problems || insights.problemAreas).map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}>
                          <AlertTriangle size={12} color={T.danger} strokeWidth={ICON_STROKE} />
                          <Text style={[s.insightText, { color: T.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {insights.recommendations?.length > 0 && (
                    <View style={s.insightGroup}>
                      <Text style={[s.insightLabel, { color: T.info }]}>RECOMMENDATIONS</Text>
                      {insights.recommendations.map((item: string, i: number) => (
                        <View key={i} style={s.insightRow}>
                          <TrendingUp size={12} color={T.info} strokeWidth={ICON_STROKE} />
                          <Text style={[s.insightText, { color: T.text }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {actionItems.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Sparkles size={14} color={T.accent} strokeWidth={ICON_STROKE} />
                    <Text style={[s.sectionTitle, { color: T.accent }]}>Action Items</Text>
                  </View>
                  <Card style={{ gap: 8 }}>
                    {actionItems.map((item: any, i: number) => (
                      <View key={i} style={s.insightRow}>
                        <Text style={[s.actionNum, { color: T.accent }]}>{i + 1}.</Text>
                        <Text style={[s.insightText, { color: T.text }]}>
                          {typeof item === 'string' ? item : item.action || ''}
                        </Text>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAiReports(reportType, dateFrom, dateTo); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Analytics and AI-powered performance insights</Text>

        {/* Filter bar */}
        <View style={[s.filterCard, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={wide ? s.filterRowWide : undefined}>
            <Field label="Report Type" style={wide ? { flex: 1.4 } : undefined}>
              <Trigger
                label={TYPE_LABEL[reportType]}
                open={openTypeDd}
                onPress={() => setOpenTypeDd(o => !o)}
                icon={<BarChart3 size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              />
              {openTypeDd && (
                <Dropdown
                  style={{ width: '100%' }}
                  value={reportType}
                  onSelect={v => { setReportType(v); setOpenTypeDd(false); }}
                  options={typeOptions}
                />
              )}
            </Field>

            <View style={wide ? s.dateRowWide : s.dateRow}>
              <Field label="From" style={{ flex: 1 }}>
                <DateInput value={dateFrom} onChange={setDateFrom} accentColor={T.accent} maxDate={dateTo || todayStr()} />
              </Field>
              <Field label="To" style={{ flex: 1 }}>
                <DateInput value={dateTo} onChange={setDateTo} accentColor={T.accent} minDate={dateFrom} maxDate={todayStr()} />
              </Field>
            </View>
          </View>

          {/* Ungated, matching web: Reports.jsx renders Generate Report for every role. */}
          <Btn
            label={generating ? 'Generating…' : 'Generate Report'}
            onPress={() => setShowGenerate(true)}
            loading={generating}
            small
            icon={<Sparkles size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
            style={wide ? { alignSelf: 'flex-start' } : undefined}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : loadFailed ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>Couldn't load reports</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Check your connection and pull down to retry.</Text>
          </View>
        ) : aiReports.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Sparkles size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No AI reports found for this date range</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Reports are auto-generated daily at 11 PM IST.</Text>
          </View>
        ) : (
          <>
            <Text style={[s.count, { color: T.dim }]}>
              {aiReports.length} report{aiReports.length !== 1 ? 's' : ''} found
            </Text>
            {table ? renderTable() : renderRows()}
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  Showing {(page - 1) * PAGE_SIZE + 1}{DASH}{Math.min(page * PAGE_SIZE, aiReports.length)} of {aiReports.length}
                </Text>
                <Pagination page={page} pageCount={totalPages} onChange={setPage} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showGenerate && (
        <GenerateModal
          reportType={reportType}
          role={role}
          isManager={isManager}
          teamFos={teamFos}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {renderAiDetail()}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour is applied inline from the theme) ──────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },

  filterCard: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  filterRowWide: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dateRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  dateRowWide: { flexDirection: 'row', gap: 12, flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },

  count: { fontSize: rf(11.5), fontWeight: '600' },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  loadCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // ── iPad table ──
  // Every text column carries flexShrink:1 + minWidth:0 in its SHARED constant, so the
  // header cell and the body cell always resolve to the same width. RN defaults
  // flexShrink to 0: without it a long name refuses to shrink and shoves every later
  // column out of alignment with its header.
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  // Fixed columns keep a width and never shrink — the circle and the icons are
  // intrinsically sized and must not collapse.
  cScore: { width: 48 },
  cName: { flex: 2, flexShrink: 1, minWidth: 0 },
  cType: { flex: 1.5, flexShrink: 1, minWidth: 0 },
  cDate: { flex: 1.6, flexShrink: 1, minWidth: 0 },
  cRating: { flex: 1.2, flexShrink: 1, minWidth: 0 },
  cStatus: { flex: 1.1, flexShrink: 1, minWidth: 0 },
  cAct: { width: 64 },
  typeCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  failTxt: { fontWeight: '700', fontSize: rf(11) },

  // report row
  aiCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  aiMetaText: { fontWeight: '500', fontSize: rf(11.5) },
  aiRatingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, alignSelf: 'flex-start' },
  aiRatingText: { fontWeight: '700', fontSize: rf(11) },

  // detail
  detailBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backTxt: { fontWeight: '700', fontSize: rf(13) },
  detailContent: { padding: 14, gap: 14, paddingBottom: 32 },
  detailWide: { maxWidth: 900, width: '100%', alignSelf: 'center' },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailName: { fontWeight: '800', fontSize: rf(17), letterSpacing: -0.3 },
  detailMeta: { fontWeight: '500', fontSize: rf(11.5), marginTop: 3 },
  detailPrev: { fontWeight: '500', fontSize: rf(10.5), marginTop: 2 },
  aiRatingBadgeLg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  aiRatingTextLg: { fontWeight: '700', fontSize: rf(12.5) },
  summaryText: { fontWeight: '400', fontSize: rf(13), lineHeight: 20 },

  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontWeight: '700', fontSize: rf(11.5), textTransform: 'uppercase', letterSpacing: 0.5 },

  kpiCard: { flex: 1, padding: 12 },
  kpiLabel: { fontWeight: '700', fontSize: rf(9.5), letterSpacing: 0.3, textTransform: 'uppercase' },
  kpiVal: { fontWeight: '800', fontSize: rf(16), letterSpacing: -0.3, marginTop: 4 },
  kpiSub: { fontWeight: '500', fontSize: rf(10.5), marginTop: 3 },

  betweenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tLabel: { fontWeight: '600', fontSize: rf(11.5) },
  tVal: { fontWeight: '700', fontSize: rf(11.5) },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6, flexDirection: 'row' },
  barFill: { height: 8, borderRadius: 4 },

  scoreLabel: { fontWeight: '500', fontSize: rf(11), textTransform: 'capitalize' },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreNum: { fontWeight: '700', fontSize: rf(12), minWidth: 46, textAlign: 'right' },

  stack: { height: 22, borderRadius: 7, overflow: 'hidden', flexDirection: 'row' },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { fontWeight: '500', fontSize: rf(10.5) },

  agingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 13, borderWidth: 1 },
  agingName: { fontWeight: '700', fontSize: rf(12.5) },
  agingDays: { fontWeight: '800', fontSize: rf(13) },

  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  funnelStage: { fontWeight: '600', fontSize: rf(11), width: 84 },
  funnelTrack: { flex: 1, height: 22, borderRadius: 7, overflow: 'hidden', justifyContent: 'center' },
  funnelFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7 },
  funnelCount: { fontWeight: '700', fontSize: rf(10.5), marginLeft: 8 },

  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 13 },
  visitScore: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  visitScoreTxt: { fontWeight: '800', fontSize: rf(11.5) },

  rankCard: { paddingVertical: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8 },
  rankNum: { fontWeight: '700', fontSize: rf(12), width: 22 },
  rankName: { fontWeight: '700', fontSize: rf(12.5), width: 88 },
  rankScore: { fontWeight: '800', fontSize: rf(12.5), width: 32 },
  rankObs: { fontWeight: '400', fontSize: rf(10.5), flex: 1 },

  flagCard: { borderRadius: 12, padding: 12, borderLeftWidth: 3, marginBottom: 6 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  flagSeverity: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  flagSeverityText: { fontWeight: '700', fontSize: rf(10) },
  flagCategory: { fontWeight: '500', fontSize: rf(11) },
  flagIssue: { fontWeight: '700', fontSize: rf(12.5) },
  flagEvidence: { fontWeight: '400', fontSize: rf(11.5), marginTop: 4, lineHeight: 17 },

  insightGroup: { gap: 6, marginBottom: 12 },
  insightLabel: { fontWeight: '700', fontSize: rf(10.5), letterSpacing: 0.5 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { fontWeight: '400', fontSize: rf(12.5), flex: 1, lineHeight: 19 },
  actionNum: { fontWeight: '800', fontSize: rf(12.5) },

  // generate modal
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  typeTile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, borderRadius: 13 },
  typeTileTxt: { fontWeight: '700', fontSize: rf(12.5) },
});
