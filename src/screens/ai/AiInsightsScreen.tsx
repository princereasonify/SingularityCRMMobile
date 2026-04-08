import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiApi } from '../../api/ai';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const SEVERITY_COLORS: Record<string, string> = {
  High: '#DC2626', Medium: '#F59E0B', Low: '#16A34A', Info: '#2563EB',
};

interface Insight {
  title: string;
  description: string;
  severity?: string;
  category?: string;
}

export const AiInsightsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'ZH') as keyof typeof ROLE_COLORS];

  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = async () => {
    try {
      const res = await aiApi.getInsights();
      setInsights(res.data);
    } catch {
      setInsights(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadInsights(); }, []);

  const renderInsightCard = (insight: Insight, i: number) => (
    <Card key={i} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        {insight.severity && (
          <Badge label={insight.severity} color={SEVERITY_COLORS[insight.severity] || '#9CA3AF'} />
        )}
      </View>
      {insight.category && <Text style={styles.insightCategory}>{insight.category}</Text>}
      <Text style={styles.insightDesc}>{insight.description}</Text>
    </Card>
  );

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading insights..." />;

  const teamInsights: Insight[] = insights?.teamPerformance ?? [];
  const pipelineInsights: Insight[] = insights?.pipelineHealth ?? [];
  const recommendations: Insight[] = insights?.recommendations ?? [];
  const hasAny = teamInsights.length + pipelineInsights.length + recommendations.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="AI Insights" subtitle="Updated daily" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInsights(); }} colors={[COLOR.primary]} />}
      >
        {!hasAny ? (
          <EmptyState title="No insights available" subtitle="AI insights are generated daily based on your team's activity" icon="🧠" />
        ) : (
          <>
            {teamInsights.length > 0 && (
              <Section title="👥 Team Performance" color={COLOR.primary}>
                {teamInsights.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
            {pipelineInsights.length > 0 && (
              <Section title="📊 Pipeline Health" color={COLOR.primary}>
                {pipelineInsights.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
            {recommendations.length > 0 && (
              <Section title="💡 Recommended Actions" color={COLOR.primary}>
                {recommendations.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Section = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 10 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', marginBottom: 4 },
  insightCard: {},
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  insightTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', flex: 1 },
  insightCategory: { fontSize: rf(12), color: '#9CA3AF', marginBottom: 6 },
  insightDesc: { fontSize: rf(13), color: '#374151', lineHeight: 20 },
});
