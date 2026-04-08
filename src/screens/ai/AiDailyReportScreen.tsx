import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Circle } from 'lucide-react-native';
import { aiApi } from '../../api/ai';
import { AiDailyReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

export const AiDailyReportScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
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

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading report..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Daily Report" subtitle={today} color={COLOR.primary} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReport(); }} colors={[COLOR.primary]} />}
      >
        {!report ? (
          <EmptyState title="Report not ready" subtitle="Your AI daily report will be generated at end of day" icon="📊" />
        ) : (
          <>
            {/* Summary */}
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>AI Summary</Text>
              <Text style={styles.summaryText}>{report.summary}</Text>
            </Card>

            {/* Metrics */}
            <Card style={styles.metricsCard}>
              <Text style={styles.sectionTitle}>Time Breakdown</Text>
              <View style={styles.metricsRow}>
                <MetricBox label="Visit Time" value={report.metrics.visitTime} color="#16A34A" />
                <MetricBox label="Travel Time" value={report.metrics.travelTime} color="#2563EB" />
                <MetricBox label="Idle Time" value={report.metrics.idleTime} color="#9CA3AF" />
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Quality Score</Text>
                <View style={[styles.scoreCircle, { borderColor: COLOR.primary }]}>
                  <Text style={[styles.scoreValue, { color: COLOR.primary }]}>{report.metrics.qualityScore}</Text>
                  <Text style={styles.scoreSub}>/100</Text>
                </View>
              </View>
            </Card>

            {/* Completed */}
            {report.completed.length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#16A34A' }]}>✅ Completed ({report.completed.length})</Text>
                {report.completed.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <CheckCircle size={16} color="#16A34A" />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Pending */}
            {report.pending.length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>⏳ Pending ({report.pending.length})</Text>
                {report.pending.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Circle size={16} color="#F59E0B" />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Tomorrow */}
            {report.tomorrowSuggestion && (
              <Card style={{ ...styles.section, ...styles.tomorrowCard }}>
                <Text style={styles.tomorrowTitle}>🔮 Tomorrow's Suggestion</Text>
                <Text style={styles.tomorrowText}>{report.tomorrowSuggestion}</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const MetricBox = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={[metricStyles.box, { borderTopColor: color }]}>
    <Text style={[metricStyles.value, { color }]}>{value}</Text>
    <Text style={metricStyles.label}>{label}</Text>
  </View>
);
const metricStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', borderTopWidth: 3, paddingTop: 8 },
  value: { fontSize: rf(16), fontWeight: '700' },
  label: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  summaryCard: {},
  summaryTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 8 },
  summaryText: { fontSize: rf(14), color: '#374151', lineHeight: 22 },
  metricsCard: {},
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  scoreLabel: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  scoreCircle: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontSize: rf(16), fontWeight: '700' },
  scoreSub: { fontSize: rf(10), color: '#9CA3AF' },
  section: {},
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listText: { flex: 1, fontSize: rf(14), color: '#374151', lineHeight: 20 },
  tomorrowCard: { backgroundColor: '#F0F9FF' },
  tomorrowTitle: { fontSize: rf(14), fontWeight: '700', color: '#0369A1', marginBottom: 8 },
  tomorrowText: { fontSize: rf(14), color: '#0C4A6E', lineHeight: 22 },
});
