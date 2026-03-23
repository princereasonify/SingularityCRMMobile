import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, Check } from 'lucide-react-native';
import { aiApi } from '../../api/ai';
import { AiDailyPlan, AiAgendaItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

export const AiDailyPlanScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const [plan, setPlan] = useState<AiDailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadPlan = async () => {
    try {
      const res = await aiApi.getDailyPlan();
      const data = res.data;
      setPlan(data);
      if (data?.suggestedAgenda) {
        setSelectedItems(new Set(data.suggestedAgenda.map((_: any, i: number) => i)));
      }
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadPlan(); }, []);

  const toggleItem = (index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAccept = async () => {
    if (!plan) return;
    setAccepting(true);
    try {
      await aiApi.acceptPlan(plan.id, Array.from(selectedItems));
      Alert.alert('Plan Accepted', 'Your daily plan has been confirmed!');
    } catch { Alert.alert('Error', 'Failed to accept plan'); }
    finally { setAccepting(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await aiApi.regeneratePlan();
      setPlan(res.data);
      if (res.data?.suggestedAgenda) {
        setSelectedItems(new Set(res.data.suggestedAgenda.map((_: any, i: number) => i)));
      }
    } catch { Alert.alert('Error', 'Failed to regenerate plan'); }
    finally { setRegenerating(false); }
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading your plan..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="AI Daily Plan"
        subtitle={today}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleRegenerate} disabled={regenerating}>
            <RefreshCw size={20} color="#FFF" />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlan(); }} colors={[COLOR.primary]} />}
      >
        {!plan ? (
          <View style={styles.emptyWrap}>
            <EmptyState title="No plan available" subtitle="Your AI plan will be ready every morning" icon="🤖" />
            <Button title={regenerating ? 'Generating...' : 'Generate Plan'} onPress={handleRegenerate} variant="primary" disabled={regenerating} />
          </View>
        ) : (
          <>
            {/* Tips Banner */}
            {plan.dailyTips && (
              <View style={[styles.tipsBanner, { backgroundColor: COLOR.light }]}>
                <Text style={styles.tipsIcon}>💡</Text>
                <Text style={[styles.tipsText, { color: COLOR.primary }]}>{plan.dailyTips}</Text>
              </View>
            )}

            {/* Target Reminder */}
            {plan.targetReminder && (
              <View style={styles.targetBanner}>
                <Text style={styles.targetIcon}>🎯</Text>
                <Text style={styles.targetText}>{plan.targetReminder}</Text>
              </View>
            )}

            {/* Agenda */}
            <Text style={styles.sectionTitle}>Suggested Agenda ({plan.suggestedAgenda?.length ?? 0} items)</Text>
            {(plan.suggestedAgenda ?? []).map((item: AiAgendaItem, i: number) => {
              const selected = selectedItems.has(i);
              return (
                <TouchableOpacity key={i} onPress={() => toggleItem(i)} activeOpacity={0.8}>
                  <Card style={selected ? { ...styles.agendaCard, borderLeftWidth: 4, borderLeftColor: COLOR.primary } : styles.agendaCard}>
                    <View style={styles.agendaHeader}>
                      <View style={styles.timeBox}>
                        <Text style={[styles.agendaTime, { color: COLOR.primary }]}>{item.time}</Text>
                      </View>
                      <View style={styles.agendaContent}>
                        <Text style={styles.agendaAction}>{item.action}</Text>
                        <Text style={styles.agendaSchool}>🏫 {item.school}</Text>
                        <Text style={styles.agendaReason}>💬 {item.reason}</Text>
                      </View>
                      <View style={[styles.checkbox, selected && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}>
                        {selected && <Check size={14} color="#FFF" />}
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

            {plan.suggestedAgenda && plan.suggestedAgenda.length > 0 && (
              <Button
                title={accepting ? 'Accepting...' : `Accept Plan (${selectedItems.size} items)`}
                onPress={handleAccept}
                variant="primary"
                disabled={accepting || selectedItems.size === 0}
                style={{ marginTop: 8 }}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  tipsBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, padding: 14,
  },
  tipsIcon: { fontSize: rf(18) },
  tipsText: { flex: 1, fontSize: rf(14), lineHeight: 20, fontWeight: '500' },
  targetBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14,
  },
  targetIcon: { fontSize: rf(18) },
  targetText: { flex: 1, fontSize: rf(14), color: '#92400E', lineHeight: 20 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  agendaCard: { overflow: 'hidden' },
  agendaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timeBox: { minWidth: 52, alignItems: 'center', paddingTop: 2 },
  agendaTime: { fontSize: rf(13), fontWeight: '700' },
  agendaContent: { flex: 1 },
  agendaAction: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 4 },
  agendaSchool: { fontSize: rf(13), color: '#6B7280', marginBottom: 2 },
  agendaReason: { fontSize: rf(12), color: '#9CA3AF' },
  emptyWrap: { alignItems: 'center', gap: 16, padding: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
});
