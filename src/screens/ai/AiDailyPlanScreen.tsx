import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Check, Zap, ArrowLeft } from 'lucide-react-native';
import { aiApi } from '../../api/ai';
import { AiDailyPlan, AiAgendaItem, AiUsageQuota } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Card, SectionLabel } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';

import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

export const AiDailyPlanScreen = ({ navigation }: any) => {
  useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const [plan, setPlan] = useState<AiDailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [quota, setQuota] = useState<AiUsageQuota | null>(null);

  const loadPlan = async () => {
    try {
      const [planRes, quotaRes] = await Promise.allSettled([
        aiApi.getDailyPlan(),
        aiApi.getUsageQuota('/ai/daily-plan'),
      ]);
      if (planRes.status === 'fulfilled') {
        const data = planRes.value.data;
        setPlan(data);
        if (data?.suggestedAgenda) {
          setSelectedItems(new Set(data.suggestedAgenda.map((_: any, i: number) => i)));
        }
      } else { setPlan(null); }
      if (quotaRes.status === 'fulfilled') setQuota(quotaRes.value.data);
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
    if (quota && quota.used >= quota.limit) {
      Alert.alert('Limit Reached', `Daily AI plan limit reached (${quota.limit}/day). Resets tomorrow.`);
      return;
    }
    setRegenerating(true);
    try {
      const res = await aiApi.regeneratePlan();
      setPlan(res.data);
      if (res.data?.suggestedAgenda) {
        setSelectedItems(new Set(res.data.suggestedAgenda.map((_: any, i: number) => i)));
      }
      if (quota) setQuota({ ...quota, used: quota.used + 1 });
    } catch { Alert.alert('Error', 'Failed to regenerate plan'); }
    finally { setRegenerating(false); }
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading your plan..." />;

  const exhausted = !!quota && quota.used >= quota.limit;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>AI Daily Plan</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{today}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={handleRegenerate} disabled={regenerating}>
            <RefreshCw size={20} color="#FFF" />
          </TouchableOpacity>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlan(); }} tintColor={T.accent} />}
      >
        {/* Quota Banner */}
        {quota && (
          <Card style={[styles.quotaBanner, { backgroundColor: exhausted ? T.danger + '14' : T.accentSoft }]}>
            <Zap size={14} color={exhausted ? T.danger : T.accent} />
            {exhausted ? (
              <Text style={[styles.quotaText, { color: T.danger }]}>Limit reached — resets tomorrow</Text>
            ) : (
              <Text style={[styles.quotaText, { color: T.accent }]}>
                {quota.limit - quota.used} of {quota.limit} regenerations left today
              </Text>
            )}
          </Card>
        )}

        {!plan ? (
          <View style={styles.emptyWrap}>
            <EmptyState title="No plan available" subtitle="Your AI plan will be ready every morning" icon="🤖" />
            <GradientButton
              label={regenerating ? 'Generating...' : 'Generate Plan'}
              onPress={handleRegenerate}
              loading={regenerating}
              disabled={regenerating || (quota?.used ?? 0) >= (quota?.limit ?? 99)}
              style={styles.fullBtn}
            />
          </View>
        ) : (
          <>
            {/* Tips Banner */}
            {plan.dailyTips && (
              <Card style={[styles.tipsBanner, { backgroundColor: T.accentSoft }]}>
                <Text style={styles.tipsIcon}>💡</Text>
                <Text style={[styles.tipsText, { color: T.accent }]}>{plan.dailyTips}</Text>
              </Card>
            )}

            {/* Target Reminder */}
            {plan.targetReminder && (
              <Card style={[styles.targetBanner, { backgroundColor: T.warning + '14' }]}>
                <Text style={styles.targetIcon}>🎯</Text>
                <Text style={[styles.targetText, { color: T.warning }]}>{plan.targetReminder}</Text>
              </Card>
            )}

            {/* Agenda */}
            <SectionLabel>Suggested Agenda ({plan.suggestedAgenda?.length ?? 0} items)</SectionLabel>
            {(plan.suggestedAgenda ?? []).map((item: AiAgendaItem, i: number) => {
              const selected = selectedItems.has(i);
              return (
                <TouchableOpacity key={i} onPress={() => toggleItem(i)} activeOpacity={0.8}>
                  <Card style={selected ? { borderLeftWidth: 4, borderLeftColor: T.accent } : undefined}>
                    <View style={styles.agendaHeader}>
                      <View style={styles.timeBox}>
                        <Text style={[styles.agendaTime, { color: T.accent }]}>{item.time}</Text>
                      </View>
                      <View style={styles.agendaContent}>
                        <Text style={[styles.agendaAction, { color: T.text }]}>{item.action}</Text>
                        <Text style={[styles.agendaSchool, { color: T.sub }]}>🏫 {item.school}</Text>
                        <Text style={[styles.agendaReason, { color: T.dim }]}>💬 {item.reason}</Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        { borderColor: T.line },
                        selected && { backgroundColor: T.accent, borderColor: T.accent },
                      ]}>
                        {selected && <Check size={14} color="#FFF" />}
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

            {plan.suggestedAgenda && plan.suggestedAgenda.length > 0 && (
              <GradientButton
                label={accepting ? 'Accepting...' : `Accept Plan (${selectedItems.size} items)`}
                onPress={handleAccept}
                loading={accepting}
                disabled={accepting || selectedItems.size === 0}
                style={[styles.fullBtn, { marginTop: 8 }]}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

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

  tipsBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipsIcon: { fontSize: rf(18) },
  tipsText: { flex: 1, fontWeight: '600', fontSize: rf(14), lineHeight: 20 },
  targetBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  targetIcon: { fontSize: rf(18) },
  targetText: { flex: 1, fontWeight: '400', fontSize: rf(14), lineHeight: 20 },

  agendaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timeBox: { minWidth: 52, alignItems: 'center', paddingTop: 2 },
  agendaTime: { fontWeight: '700', fontSize: rf(13) },
  agendaContent: { flex: 1 },
  agendaAction: { fontWeight: '700', fontSize: rf(14), marginBottom: 4 },
  agendaSchool: { fontWeight: '400', fontSize: rf(13), marginBottom: 2 },
  agendaReason: { fontWeight: '400', fontSize: rf(12) },
  emptyWrap: { alignItems: 'center', gap: 16, padding: 16 },
  fullBtn: { alignSelf: 'stretch' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  quotaBanner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quotaText: { fontWeight: '600', fontSize: rf(13) },
});
