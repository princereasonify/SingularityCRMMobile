import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  useWindowDimensions, Modal, ActivityIndicator, Linking, Share,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Download, Eye, BarChart2, TrendingUp, Users, Map,
  DollarSign, GraduationCap, Settings, X, FileText,
  Share2, Filter,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS, REPORTS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatting';
import { rf, getCardWidth } from '../../utils/responsive';
import { reportsApi, ReportFilters } from '../../api/reports';
import { API_BASE_URL } from '../../utils/constants';

const CATEGORIES = ['All', 'Performance', 'Pipeline', 'Analysis', 'Territory', 'Finance', 'Onboarding', 'Custom'];
const PERIODS = ['monthly', 'weekly', 'quarterly', 'yearly'] as const;

const ICONS: Record<number, React.ReactNode> = {
  1: <BarChart2 size={24} color="#3B82F6" />,
  2: <TrendingUp size={24} color="#F59E0B" />,
  3: <Users size={24} color="#8B5CF6" />,
  4: <TrendingUp size={24} color="#EF4444" />,
  5: <Map size={24} color="#22C55E" />,
  6: <Users size={24} color="#F97316" />,
  7: <DollarSign size={24} color="#14B8A6" />,
  8: <GraduationCap size={24} color="#6366F1" />,
  9: <Settings size={24} color="#6B7280" />,
};

const ICON_BG: Record<number, string> = {
  1: '#EFF6FF', 2: '#FFFBEB', 3: '#F5F3FF', 4: '#FEF2F2',
  5: '#F0FDF4', 6: '#FFF7ED', 7: '#ECFDF5', 8: '#EEF2FF', 9: '#F9FAFB',
};

// ─── Report Viewer ─────────────────────────────────────────────────────────────

const ReportViewer = ({
  report,
  data,
  color,
}: {
  report: typeof REPORTS[0];
  data: any;
  color: { primary: string; light: string };
}) => {
  if (!data) return (
    <View style={viewerStyles.empty}>
      <Text style={viewerStyles.emptyText}>No data available for this report.</Text>
    </View>
  );

  // Render rows / items as a generic table
  const renderValue = (val: any): string => {
    if (val == null) return '—';
    if (typeof val === 'number') return val % 1 !== 0 ? val.toFixed(1) : String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  // Try to find a summary object and an items/rows array
  const summary: Record<string, any> = data.summary ?? data.totals ?? data.metrics ?? {};
  const items: any[] = data.items ?? data.rows ?? data.data ?? data.results ?? [];
  const hasSummary = Object.keys(summary).length > 0;
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <ScrollView style={viewerStyles.scroll} contentContainerStyle={viewerStyles.content}>
      {/* Summary Cards */}
      {hasSummary && (
        <View style={viewerStyles.section}>
          <Text style={[viewerStyles.sectionTitle, { color: color.primary }]}>Summary</Text>
          <View style={viewerStyles.summaryGrid}>
            {Object.entries(summary).slice(0, 8).map(([key, val]) => (
              <View key={key} style={[viewerStyles.summaryBox, { borderTopColor: color.primary }]}>
                <Text style={[viewerStyles.summaryValue, { color: color.primary }]}>
                  {typeof val === 'number' && key.toLowerCase().includes('revenue')
                    ? formatCurrency(val)
                    : renderValue(val)}
                </Text>
                <Text style={viewerStyles.summaryLabel}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Items Table */}
      {hasItems && (
        <View style={viewerStyles.section}>
          <Text style={[viewerStyles.sectionTitle, { color: color.primary }]}>
            Details ({items.length} records)
          </Text>
          {items.map((row, idx) => {
            const entries = Object.entries(row).filter(([k]) =>
              !['id', 'userId', 'foId', 'zoneId', 'regionId'].includes(k)
            );
            return (
              <View key={idx} style={[viewerStyles.tableRow, idx % 2 === 0 && viewerStyles.tableRowAlt]}>
                <Text style={viewerStyles.rowIndex}>{idx + 1}</Text>
                <View style={viewerStyles.rowContent}>
                  {entries.slice(0, 5).map(([key, val]) => (
                    <View key={key} style={viewerStyles.rowField}>
                      <Text style={viewerStyles.rowKey}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                      </Text>
                      <Text style={viewerStyles.rowVal} numberOfLines={1}>
                        {typeof val === 'number' && key.toLowerCase().includes('revenue')
                          ? formatCurrency(val as number)
                          : renderValue(val)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Fallback — raw top-level fields */}
      {!hasSummary && !hasItems && (
        <View style={viewerStyles.section}>
          <Text style={[viewerStyles.sectionTitle, { color: color.primary }]}>Report Data</Text>
          {Object.entries(data).slice(0, 20).map(([key, val]) => (
            <View key={key} style={viewerStyles.tableRow}>
              <Text style={viewerStyles.rowKey}>
                {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
              </Text>
              <Text style={viewerStyles.rowVal}>{renderValue(val)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const viewerStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF', textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', marginBottom: 4 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryBox: {
    minWidth: '45%', flex: 1, backgroundColor: '#FFF', borderRadius: 12,
    padding: 12, borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1,
  },
  summaryValue: { fontSize: rf(18), fontWeight: '700', marginBottom: 4 },
  summaryLabel: { fontSize: rf(11), color: '#9CA3AF', textTransform: 'capitalize' },
  tableRow: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  rowIndex: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '700', minWidth: 24, paddingTop: 2 },
  rowContent: { flex: 1, gap: 4 },
  rowField: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowKey: { fontSize: rf(12), color: '#6B7280', flex: 1, textTransform: 'capitalize' },
  rowVal: { fontSize: rf(12), color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const ReportsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'RH';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [category, setCategory] = useState('All');

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingReport, setViewingReport] = useState<typeof REPORTS[0] | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<typeof PERIODS[number]>('monthly');

  // Export state
  const [exportingId, setExportingId] = useState<number | null>(null);

  const accessible = REPORTS.filter((r) => r.roles.includes(role));
  const filtered = category === 'All' ? accessible : accessible.filter((r) => r.category === category);

  const cols = tablet ? 3 : 1;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32);

  // ─── View Report ──────────────────────────────────────────────────────────

  const handleView = useCallback(async (report: typeof REPORTS[0]) => {
    setViewingReport(report);
    setReportData(null);
    setViewModalVisible(true);
    setLoadingView(true);
    try {
      const filters: ReportFilters = { period: selectedPeriod };
      const res = await reportsApi.getReport(report.id, filters);
      setReportData(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        // Report endpoint not yet on backend — show friendly message
        setReportData({ _message: 'This report is not yet available from the server.' });
      } else {
        Alert.alert('Error', 'Failed to load report data. Please try again.');
        setViewModalVisible(false);
      }
    } finally {
      setLoadingView(false);
    }
  }, [selectedPeriod]);

  const handleRefreshView = useCallback(async () => {
    if (!viewingReport) return;
    setLoadingView(true);
    try {
      const res = await reportsApi.getReport(viewingReport.id, { period: selectedPeriod });
      setReportData(res.data);
    } catch {
      // keep existing data
    } finally {
      setLoadingView(false);
    }
  }, [viewingReport, selectedPeriod]);

  // ─── Export Report ────────────────────────────────────────────────────────

  const handleExport = useCallback(async (report: typeof REPORTS[0], format: 'pdf' | 'csv' = 'pdf') => {
    setExportingId(report.id);
    try {
      // Try to get a signed export URL from the backend
      const res = await reportsApi.getExportUrl(report.id, format, { period: selectedPeriod });
      const { url, filename } = res.data ?? {};

      if (url) {
        // Option 1: Open the URL in the browser (triggers download)
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Option 2: Share the URL
          await Share.share({
            title: filename || `${report.title}.${format}`,
            message: `Download ${report.title}: ${url}`,
            url,
          });
        }
      } else {
        throw new Error('No download URL returned');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 501) {
        // Backend export not implemented — fall back to sharing API base URL
        await _fallbackShare(report, format);
      } else if (err?.message !== 'No download URL returned') {
        await _fallbackShare(report, format);
      }
    } finally {
      setExportingId(null);
    }
  }, [selectedPeriod]);

  const _fallbackShare = async (report: typeof REPORTS[0], format: string) => {
    try {
      // Build the export URL manually with the API base
      const exportUrl = `${API_BASE_URL}/reports/${report.id}/export?format=${format}&period=${selectedPeriod}`;
      await Share.share({
        title: `${report.title} — ${format.toUpperCase()}`,
        message: `Export link for ${report.title} (${format.toUpperCase()}): ${exportUrl}`,
        url: exportUrl,
      });
    } catch {
      Alert.alert('Export', `Report export for "${report.title}" is not yet available on the server.`);
    }
  };

  const handleExportChoice = (report: typeof REPORTS[0]) => {
    Alert.alert(
      `Export: ${report.title}`,
      'Choose export format',
      [
        { text: 'PDF', onPress: () => handleExport(report, 'pdf') },
        { text: 'CSV', onPress: () => handleExport(report, 'csv') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <Text style={styles.headerTitle}>Reports Library</Text>
        <Text style={styles.headerSub}>{accessible.length} reports available</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && { backgroundColor: '#FFF' }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && { color: COLOR.primary }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, tablet && { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }]}>
          {filtered.map((report) => (
            <Card key={report.id} style={tablet ? { ...styles.reportCard, width: cardW } : styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={[styles.iconWrap, { backgroundColor: ICON_BG[report.id] }]}>
                  {ICONS[report.id]}
                </View>
                <View style={styles.reportMeta}>
                  <Badge label={report.category} color="#6B7280" size="sm" />
                  <View style={styles.rolesList}>
                    {report.roles.map((r) => (
                      <View key={r} style={[styles.rolePill, { backgroundColor: ROLE_COLORS[r as keyof typeof ROLE_COLORS]?.primary || '#6B7280' }]}>
                        <Text style={styles.rolePillText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportDesc} numberOfLines={2}>{report.description}</Text>
              <View style={styles.reportActions}>
                <TouchableOpacity
                  style={[styles.reportBtn, { borderColor: COLOR.primary }]}
                  onPress={() => handleView(report)}
                >
                  <Eye size={14} color={COLOR.primary} />
                  <Text style={[styles.reportBtnText, { color: COLOR.primary }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportBtn, { borderColor: '#6B7280', opacity: exportingId === report.id ? 0.6 : 1 }]}
                  onPress={() => handleExportChoice(report)}
                  disabled={exportingId === report.id}
                >
                  {exportingId === report.id
                    ? <ActivityIndicator size="small" color="#6B7280" />
                    : <Download size={14} color="#6B7280" />}
                  <Text style={[styles.reportBtnText, { color: '#6B7280' }]}>
                    {exportingId === report.id ? 'Exporting...' : 'Export'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No reports in this category</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ─── View Report Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: COLOR.primary }]}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle} numberOfLines={1}>{viewingReport?.title}</Text>
                <Text style={styles.modalSub}>{viewingReport?.category}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setViewModalVisible(false)}>
                <X size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Period Picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodChip, selectedPeriod === p && { backgroundColor: '#FFF' }]}
                  onPress={() => {
                    setSelectedPeriod(p);
                    if (viewingReport) {
                      setTimeout(() => handleRefreshView(), 100);
                    }
                  }}
                >
                  <Text style={[styles.periodText, selectedPeriod === p && { color: COLOR.primary }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Content */}
          {loadingView ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLOR.primary} />
              <Text style={[styles.loadingText, { color: COLOR.primary }]}>Loading report...</Text>
            </View>
          ) : reportData?._message ? (
            <View style={styles.notAvailBox}>
              <Text style={styles.notAvailIcon}>📊</Text>
              <Text style={styles.notAvailTitle}>{viewingReport?.title}</Text>
              <Text style={styles.notAvailText}>{reportData._message}</Text>
              <TouchableOpacity
                style={[styles.exportFromModal, { borderColor: COLOR.primary }]}
                onPress={() => viewingReport && handleExportChoice(viewingReport)}
              >
                <Share2 size={16} color={COLOR.primary} />
                <Text style={[styles.exportFromModalText, { color: COLOR.primary }]}>Export Report Instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ReportViewer report={viewingReport!} data={reportData} color={COLOR} />
          )}

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <Button
              title="Refresh"
              onPress={handleRefreshView}
              variant="secondary"
              color={COLOR.primary}
              disabled={loadingView}
              style={{ flex: 1 }}
            />
            <Button
              title="Export PDF"
              onPress={() => viewingReport && handleExport(viewingReport, 'pdf')}
              variant="primary"
              color={COLOR.primary}
              disabled={!viewingReport || exportingId === viewingReport?.id}
              style={{ flex: 1 }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2, marginBottom: 12 },
  catScroll: {},
  catChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 6,
  },
  catText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 10 },
  contentTablet: { padding: 24 },
  grid: { gap: 10 },
  reportCard: { padding: 16 },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reportMeta: { flex: 1, gap: 4 },
  rolesList: { flexDirection: 'row', gap: 4 },
  rolePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  rolePillText: { fontSize: rf(10), fontWeight: '700', color: '#FFF' },
  reportTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827', marginBottom: 6 },
  reportDesc: { fontSize: rf(13), color: '#6B7280', lineHeight: 19, marginBottom: 14 },
  reportActions: { flexDirection: 'row', gap: 8 },
  reportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
  },
  reportBtnText: { fontSize: rf(13), fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: rf(16), fontWeight: '600', color: '#374151', textAlign: 'center' },
  // Modal
  modalSafe: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalTitleWrap: { flex: 1 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#FFF' },
  modalSub: { fontSize: rf(12), color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  modalClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  periodScroll: {},
  periodChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 6,
  },
  periodText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: rf(14), fontWeight: '600' },
  notAvailBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  notAvailIcon: { fontSize: 56 },
  notAvailTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  notAvailText: { fontSize: rf(14), color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  exportFromModal: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  exportFromModalText: { fontSize: rf(14), fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    backgroundColor: '#FFF',
  },
});
