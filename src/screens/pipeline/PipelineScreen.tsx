import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, KANBAN_COLUMNS, STAGE_COLORS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, isOverdue } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

export const PipelineScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await leadsApi.getPipeline();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
      setLeads(data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const getLeadsForColumn = (stages: string[]) =>
    leads.filter((l) => stages.includes(l.stage));

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <Text style={styles.headerTitle}>Pipeline</Text>
        <Text style={styles.headerSub}>{leads.length} leads • {formatCurrency(leads.reduce((s, l) => s + l.value, 0))}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kanban}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />
        }
      >
        <View style={styles.columnsRow}>
          {KANBAN_COLUMNS.map((col) => {
            const colLeads = getLeadsForColumn(col.stages as any);
            const colValue = colLeads.reduce((s, l) => s + l.value, 0);
            const isWon = col.id === 'col5';
            return (
              <View key={col.id} style={[styles.column, { width: tablet ? 280 : 220 }]}>
                <View style={[styles.colHeader, isWon && { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.colTitle, isWon && { color: '#16A34A' }]}>{col.title}</Text>
                  <View style={[styles.colBadge, { backgroundColor: isWon ? '#22C55E' : COLOR.primary }]}>
                    <Text style={styles.colCount}>{colLeads.length}</Text>
                  </View>
                </View>
                {colValue > 0 && (
                  <Text style={styles.colValue}>{formatCurrency(colValue)}</Text>
                )}

                <ScrollView
                  style={styles.colScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {colLeads.length === 0 ? (
                    <View style={styles.emptyCol}>
                      <Text style={styles.emptyColText}>No leads</Text>
                    </View>
                  ) : (
                    colLeads.map((lead) => {
                      const overdue = isOverdue(lead.lastActivityDate, 5);
                      const hot = lead.score >= 70;
                      return (
                        <TouchableOpacity
                          key={lead.id}
                          style={[
                            styles.leadCard,
                            hot && styles.hotCard,
                            overdue && !isWon && styles.overdueCard,
                            isWon && styles.wonCard,
                          ]}
                          onPress={() => navigation.navigate('LeadDetail', { leadId: lead.id })}
                          activeOpacity={0.8}
                        >
                          {hot && <Text style={styles.hotBadge}>🔥 Hot</Text>}
                          {overdue && !isWon && (
                            <View style={styles.overdueDot} />
                          )}
                          <Text style={styles.cardSchool} numberOfLines={2}>{lead.school}</Text>
                          <Text style={styles.cardCity}>{lead.city} • {lead.board}</Text>
                          <View style={styles.cardFooter}>
                            <Text style={styles.cardValue}>{formatCurrency(lead.value)}</Text>
                            <View style={[styles.scoreChip, { backgroundColor: getScoreColor(lead.score) + '22' }]}>
                              <Text style={[styles.scoreText, { color: getScoreColor(lead.score) }]}>{lead.score}</Text>
                            </View>
                          </View>
                          {lead.lastActivityDate && (
                            <Text style={styles.cardDate}>{formatRelativeDate(lead.lastActivityDate)}</Text>
                          )}
                          {lead.foName && role !== 'FO' && (
                            <Text style={styles.cardFO} numberOfLines={1}>👤 {lead.foName}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  kanban: { flex: 1 },
  columnsRow: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'flex-start' },
  column: { backgroundColor: '#F9FAFB', borderRadius: 16, overflow: 'hidden' },
  colHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#F3F4F6',
  },
  colTitle: { fontSize: rf(13), fontWeight: '700', color: '#374151', flex: 1 },
  colBadge: { borderRadius: 100, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  colCount: { fontSize: rf(11), fontWeight: '700', color: '#FFF' },
  colValue: { fontSize: rf(12), color: '#6B7280', paddingHorizontal: 12, paddingTop: 4 },
  colScroll: { maxHeight: 500, padding: 8 },
  emptyCol: { padding: 16, alignItems: 'center' },
  emptyColText: { fontSize: rf(12), color: '#D1D5DB' },
  leadCard: {
    backgroundColor: '#FFF',
    borderRadius: 12, padding: 12,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    position: 'relative',
  },
  hotCard: {
    borderWidth: 1.5, borderColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOpacity: 0.15,
  },
  overdueCard: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  wonCard: { borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  hotBadge: { fontSize: rf(10), color: '#D97706', fontWeight: '700', marginBottom: 4 },
  overdueDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
  },
  cardSchool: { fontSize: rf(13), fontWeight: '700', color: '#111827', marginBottom: 3 },
  cardCity: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardValue: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  scoreChip: { borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  scoreText: { fontSize: rf(11), fontWeight: '700' },
  cardDate: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  cardFO: { fontSize: rf(10), color: '#6B7280', marginTop: 2 },
});
