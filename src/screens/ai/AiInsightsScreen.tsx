import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { aiApi } from '../../api/ai';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card, Badge, SectionLabel } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';

import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';
import type { AppTheme } from '../../theme';

interface Insight {
  title: string;
  description: string;
  severity?: string;
  category?: string;
}

export const AiInsightsScreen = ({ navigation }: any) => {
  useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const severityColor = (sev?: string): string => {
    switch (sev) {
      case 'High': return T.danger;
      case 'Medium': return T.warning;
      case 'Low': return T.success;
      case 'Info': return T.info;
      default: return T.dim;
    }
  };

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
    <Card key={i}>
      <View style={styles.insightHeader}>
        <Text style={[styles.insightTitle, { color: T.text }]}>{insight.title}</Text>
        {insight.severity && (
          <Badge label={insight.severity} color={severityColor(insight.severity)} />
        )}
      </View>
      {insight.category && <Text style={[styles.insightCategory, { color: T.dim }]}>{insight.category}</Text>}
      <Text style={[styles.insightDesc, { color: T.sub }]}>{insight.description}</Text>
    </Card>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading insights..." />;

  const teamInsights: Insight[] = insights?.teamPerformance ?? [];
  const pipelineInsights: Insight[] = insights?.pipelineHealth ?? [];
  const recommendations: Insight[] = insights?.recommendations ?? [];
  const hasAny = teamInsights.length + pipelineInsights.length + recommendations.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>AI Insights</Text>
            <Text style={styles.headerSub} numberOfLines={1}>Updated daily</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInsights(); }} tintColor={T.accent} />}
      >
        {!hasAny ? (
          <EmptyState title="No insights available" subtitle="AI insights are generated daily based on your team's activity" icon="🧠" />
        ) : (
          <>
            {teamInsights.length > 0 && (
              <Section title="👥 Team Performance" T={T}>
                {teamInsights.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
            {pipelineInsights.length > 0 && (
              <Section title="📊 Pipeline Health" T={T}>
                {pipelineInsights.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
            {recommendations.length > 0 && (
              <Section title="💡 Recommended Actions" T={T}>
                {recommendations.map((ins, i) => renderInsightCard(ins, i))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const Section = ({ title, T, children }: { title: string; T: AppTheme; children: React.ReactNode }) => (
  <View style={styles.section}>
    <SectionLabel style={{ color: T.accent }}>{title}</SectionLabel>
    {children}
  </View>
);

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
  content: { padding: 16, gap: 16 },
  contentWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  section: { gap: 10 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  insightTitle: { fontWeight: '700', fontSize: rf(14), flex: 1 },
  insightCategory: { fontWeight: '400', fontSize: rf(12), marginBottom: 6 },
  insightDesc: { fontWeight: '400', fontSize: rf(13), lineHeight: 20 },
});
