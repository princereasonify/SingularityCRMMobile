import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Circle, ArrowLeft } from 'lucide-react-native';
import { aiApi } from '../../api/ai';
import { AiDailyReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card, SectionLabel } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';

import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';
import type { AppTheme } from '../../theme';

export const AiDailyReportScreen = ({ navigation }: any) => {
  useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const [report, setReport] = useState<AiDailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = async () => {
    try {
      const res = await aiApi.getDailyReport();
      setReport(res.data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading report..." />;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>Daily Report</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{today}</Text>
          </View>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
          wide && styles.contentWide,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReport(); }} tintColor={T.accent} />}
      >
        {!report ? (
          <EmptyState title="Report not ready" subtitle="Your AI daily report will be generated at end of day" icon="📊" />
        ) : (
          <>
            {/* Summary */}
            <Card>
              <Text style={[styles.summaryTitle, { color: T.text }]}>AI Summary</Text>
              <Text style={[styles.summaryText, { color: T.sub }]}>{report.summary}</Text>
            </Card>

            {/* Metrics */}
            <Card>
              <SectionLabel>Time Breakdown</SectionLabel>
              <View style={styles.metricsRow}>
                <MetricBox label="Visit Time" value={report.metrics.visitTime} color={T.success} T={T} />
                <MetricBox label="Travel Time" value={report.metrics.travelTime} color={T.info} T={T} />
                <MetricBox label="Idle Time" value={report.metrics.idleTime} color={T.dim} T={T} />
              </View>
              <View style={[styles.scoreRow, { borderTopColor: T.line }]}>
                <Text style={[styles.scoreLabel, { color: T.text }]}>Quality Score</Text>
                <View style={[styles.scoreCircle, { borderColor: T.accent }]}>
                  <Text style={[styles.scoreValue, { color: T.accent }]}>{report.metrics.qualityScore}</Text>
                  <Text style={[styles.scoreSub, { color: T.dim }]}>/100</Text>
                </View>
              </View>
            </Card>

            {/* Completed */}
            {report.completed.length > 0 && (
              <Card>
                <Text style={[styles.sectionTitle, { color: T.success }]}>✅ Completed ({report.completed.length})</Text>
                {report.completed.map((item, i) => (
                  <View key={i} style={[styles.listItem, { borderBottomColor: T.line }]}>
                    <CheckCircle size={16} color={T.success} />
                    <Text style={[styles.listText, { color: T.sub }]}>{item}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Pending */}
            {report.pending.length > 0 && (
              <Card>
                <Text style={[styles.sectionTitle, { color: T.warning }]}>⏳ Pending ({report.pending.length})</Text>
                {report.pending.map((item, i) => (
                  <View key={i} style={[styles.listItem, { borderBottomColor: T.line }]}>
                    <Circle size={16} color={T.warning} />
                    <Text style={[styles.listText, { color: T.sub }]}>{item}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Tomorrow */}
            {report.tomorrowSuggestion && (
              <Card style={{ backgroundColor: T.info + '14' }}>
                <Text style={[styles.tomorrowTitle, { color: T.info }]}>🔮 Tomorrow's Suggestion</Text>
                <Text style={[styles.tomorrowText, { color: T.text }]}>{report.tomorrowSuggestion}</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const MetricBox = ({ label, value, color, T }: { label: string; value: string; color: string; T: AppTheme }) => (
  <View style={[metricStyles.box, { borderTopColor: color }]}>
    <Text style={[metricStyles.value, { color }]}>{value}</Text>
    <Text style={[metricStyles.label, { color: T.dim }]}>{label}</Text>
  </View>
);
const metricStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', borderTopWidth: 3, paddingTop: 8 },
  value: { fontWeight: '700', fontSize: rf(16) },
  label: { fontWeight: '400', fontSize: rf(11), marginTop: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontWeight: '700', fontSize: rf(20), color: '#FFF', letterSpacing: -0.4 },
  headerSub: { fontWeight: '400', fontSize: rf(12.5), color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },

  summaryTitle: { fontWeight: '700', fontSize: rf(14), marginBottom: 8 },
  summaryText: { fontWeight: '400', fontSize: rf(14), lineHeight: 22 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  scoreLabel: { fontWeight: '600', fontSize: rf(14) },
  scoreCircle: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontWeight: '700', fontSize: rf(16) },
  scoreSub: { fontWeight: '400', fontSize: rf(10) },
  sectionTitle: { fontWeight: '700', fontSize: rf(14), marginBottom: 12 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1 },
  listText: { flex: 1, fontWeight: '400', fontSize: rf(14), lineHeight: 20 },
  tomorrowTitle: { fontWeight: '700', fontSize: rf(14), marginBottom: 8 },
  tomorrowText: { fontWeight: '400', fontSize: rf(14), lineHeight: 22 },
});
