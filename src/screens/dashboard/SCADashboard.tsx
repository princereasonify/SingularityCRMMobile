import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity, Modal, TextInput, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell, LogOut, TrendingUp, Building2, DollarSign,
  Users, Zap, Plus, X, MapPin, CreditCard, Menu,
} from 'lucide-react-native';
import { dashboardApi } from '../../api/dashboard';
import { paymentsApi } from '../../api/payments';
import { aiApi } from '../../api/ai';
import { ScaDashboardDto, DirectPayment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { KPICard } from '../../components/common/KPICard';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, getStatusColor, getProgressColor } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { rf, getCardWidth } from '../../utils/responsive';

const COLOR = ROLE_COLORS.SCA;

export const SCADashboard = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [data, setData] = useState<ScaDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'MTD' | 'QTD' | 'FY'>('MTD');
  const [directPayments, setDirectPayments] = useState<DirectPayment[]>([]);

  // Direct payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [dpUserId, setDpUserId] = useState('');
  const [dpType, setDpType] = useState<'Bonus' | 'Allowance' | 'Incentive'>('Bonus');
  const [dpAmount, setDpAmount] = useState('');
  const [dpDescription, setDpDescription] = useState('');
  const [dpSaving, setDpSaving] = useState(false);

  // AI generation
  const [generatingAi, setGeneratingAi] = useState<'daily' | 'management' | null>(null);

  const fetchData = useCallback(async () => {
    const [dashRes, paymentsRes] = await Promise.allSettled([
      dashboardApi.getScaDashboard(),
      paymentsApi.getDirectPayments(),
    ]);
    setData(dashRes.status === 'fulfilled' ? dashRes.value.data : DEMO_DATA);
    if (paymentsRes.status === 'fulfilled') {
      const d = paymentsRes.value.data as any;
      setDirectPayments(Array.isArray(d) ? d : d?.items ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateAi = (type: 'daily' | 'management') => {
    const title = type === 'daily' ? 'Generate Daily Reports' : 'Generate Management Reports';
    const msg = type === 'daily'
      ? 'This will trigger AI daily report generation for all FOs. Continue?'
      : 'This will trigger management bi-weekly report generation. Continue?';
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        onPress: async () => {
          setGeneratingAi(type);
          try {
            if (type === 'daily') await aiApi.generateDailyReports();
            else await aiApi.generateManagementReports();
            Alert.alert('Success', 'Report generation triggered successfully.');
          } catch {
            Alert.alert('Error', 'Failed to trigger report generation.');
          } finally {
            setGeneratingAi(null);
          }
        },
      },
    ]);
  };

  const handleCreateDirectPayment = async () => {
    if (!dpUserId || !dpAmount) {
      Alert.alert('Validation', 'User ID and amount are required.');
      return;
    }
    const amt = parseFloat(dpAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    setDpSaving(true);
    try {
      await paymentsApi.createDirectPayment({
        userId: parseInt(dpUserId, 10),
        type: dpType,
        amount: amt,
        description: dpDescription || undefined,
      });
      setShowPaymentModal(false);
      setDpUserId(''); setDpAmount(''); setDpDescription(''); setDpType('Bonus');
      fetchData();
      Alert.alert('Success', 'Direct payment created.');
    } catch {
      Alert.alert('Error', 'Failed to create direct payment.');
    } finally {
      setDpSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading SCA dashboard..." />;

  const cols = tablet ? 4 : 2;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32 + 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.toggleDrawer()}>
              <Menu size={20} color="#FFF" />
            </TouchableOpacity>
            <Avatar initials={user?.avatar || 'SA'} color="#FFF" size={42} />
            <View>
              <Text style={styles.greeting}>SuperSale Admin</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Bell size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={logout}>
              <LogOut size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.periodRow}>
          {(['MTD', 'QTD', 'FY'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && { color: COLOR.primary }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={[COLOR.primary]}
          />
        }
      >
        {/* ── KPI Grid ────────────────────────────────────────────────────── */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Revenue MTD"
            value={formatCurrency(data?.revenueMTD ?? 0)}
            subtitle={`${data?.targetPct ?? 0}% of target`}
            progress={data?.targetPct ?? 0}
            progressColor={COLOR.primary}
            icon={<DollarSign size={16} color={COLOR.primary} />}
            iconBg={COLOR.light}
            style={{ width: cardW }}
          />
          <KPICard
            title="Schools Won"
            value={String(data?.schoolsWon ?? 0)}
            subtitle="This period"
            icon={<Building2 size={16} color="#22C55E" />}
            iconBg="#F0FDF4"
            style={{ width: cardW }}
          />
          <KPICard
            title="Total Users"
            value={String(data?.totalUsers ?? '—')}
            subtitle={`${data?.activeUsers ?? 0} active`}
            icon={<Users size={16} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            style={{ width: cardW }}
          />
          <KPICard
            title="Regions / Zones"
            value={String(data?.totalRegions ?? '—')}
            subtitle={`${data?.totalZones ?? 0} zones`}
            icon={<MapPin size={16} color="#F59E0B" />}
            iconBg="#FFFBEB"
            style={{ width: cardW }}
          />
        </View>

        {/* ── AI Report Generation ─────────────────────────────────────────── */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ AI Report Generation</Text>
          <View style={styles.aiRow}>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: COLOR.primary, opacity: generatingAi ? 0.7 : 1 }]}
              onPress={() => handleGenerateAi('daily')}
              disabled={generatingAi !== null}
            >
              {generatingAi === 'daily'
                ? <ActivityIndicator size="small" color="#FFF" />
                : <><Zap size={15} color="#FFF" /><Text style={styles.aiBtnText}>Daily Reports</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: '#7C3AED', opacity: generatingAi ? 0.7 : 1 }]}
              onPress={() => handleGenerateAi('management')}
              disabled={generatingAi !== null}
            >
              {generatingAi === 'management'
                ? <ActivityIndicator size="small" color="#FFF" />
                : <><Zap size={15} color="#FFF" /><Text style={styles.aiBtnText}>Management Report</Text></>
              }
            </TouchableOpacity>
          </View>
          <Text style={styles.aiHint}>Daily reports auto-generate at 23:00 IST · Management reports on 1st & 16th</Text>
        </Card>

        {/* ── Direct Payments ──────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💳 Direct Payments</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: COLOR.primary }]}
              onPress={() => setShowPaymentModal(true)}
            >
              <Plus size={13} color="#FFF" />
              <Text style={styles.addBtnText}>New</Text>
            </TouchableOpacity>
          </View>
          {directPayments.length === 0 ? (
            <Text style={styles.emptyText}>No direct payments recorded yet.</Text>
          ) : (
            directPayments.slice(0, 5).map((p, i) => (
              <View key={p.id ?? i} style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  <View style={[styles.paymentTypePill, { backgroundColor: typeColor(p.type) + '22' }]}>
                    <Text style={[styles.paymentTypeText, { color: typeColor(p.type) }]}>{p.type}</Text>
                  </View>
                  <Text style={styles.paymentUser}>{p.userName ?? `User #${p.userId}`}</Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[styles.paymentAmount, { color: COLOR.primary }]}>{formatCurrency(p.amount)}</Text>
                  <Text style={styles.paymentDate}>{formatDate(p.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* ── Regional Scorecard ────────────────────────────────────────────── */}
        {(data?.regions?.length ?? 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🗺️ Regional Scorecard</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={[styles.tableHeader, { width: tablet ? '100%' : 560 }]}>
                  {['Region', 'Revenue', 'Target %', 'Schools', 'Win Rate', 'Health'].map((h, i) => (
                    <Text key={h} style={[styles.thCell, i === 0 ? { flex: 2 } : { flex: 1.2 }]}>{h}</Text>
                  ))}
                </View>
                {(data?.regions ?? []).map((reg) => (
                  <View key={reg.id} style={[styles.tableRow, { width: tablet ? '100%' : 560 }]}>
                    <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>{reg.name}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{formatCurrency(reg.revenue)}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2, color: getProgressColor(reg.targetPct) }]}>{reg.targetPct}%</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{reg.schools}</Text>
                    <Text style={[styles.tdCell, { flex: 1.2 }]}>{reg.winRate}%</Text>
                    <View style={{ flex: 1.2 }}>
                      <Badge label={reg.health} color={getStatusColor(reg.health)} size="sm" />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* ── Revenue Trend ────────────────────────────────────────────────── */}
        {(data?.revenueChart?.length ?? 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Revenue Trend</Text>
            <View style={styles.chartArea}>
              {(data?.revenueChart ?? []).map((point) => {
                const maxVal = Math.max(...(data?.revenueChart ?? []).map((p) => p.value));
                const pct = maxVal > 0 ? (point.value / maxVal) * 100 : 0;
                return (
                  <View key={point.label} style={styles.barWrap}>
                    <Text style={styles.barValue}>{formatCurrency(point.value)}</Text>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${pct}%` as any, backgroundColor: COLOR.primary }]} />
                    </View>
                    <Text style={styles.barLabel}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* ── Pipeline & Win Stats ─────────────────────────────────────────── */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 National Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <TrendingUp size={20} color={COLOR.primary} />
              <Text style={styles.statVal}>{formatCurrency(data?.pipelineValue ?? 0)}</Text>
              <Text style={styles.statLbl}>Pipeline</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <CreditCard size={20} color="#22C55E" />
              <Text style={styles.statVal}>{data?.winRate ?? 0}%</Text>
              <Text style={styles.statLbl}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Building2 size={20} color="#F59E0B" />
              <Text style={styles.statVal}>{data?.schoolsWon ?? 0}</Text>
              <Text style={styles.statLbl}>Schools Won</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Direct Payment Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Direct Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>User ID *</Text>
            <TextInput
              style={styles.input}
              value={dpUserId}
              onChangeText={setDpUserId}
              placeholder="Enter user ID"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Payment Type</Text>
            <View style={styles.typeRow}>
              {(['Bonus', 'Allowance', 'Incentive'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, dpType === t && { backgroundColor: COLOR.primary }]}
                  onPress={() => setDpType(t)}
                >
                  <Text style={[styles.typeChipText, dpType === t && { color: '#FFF' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={dpAmount}
              onChangeText={setDpAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 76, textAlignVertical: 'top' }]}
              value={dpDescription}
              onChangeText={setDpDescription}
              placeholder="Optional note..."
              multiline
              placeholderTextColor="#9CA3AF"
            />

            <Button
              title="Create Payment"
              onPress={handleCreateDirectPayment}
              loading={dpSaving}
              color={COLOR.primary}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeColor = (type: string) => {
  if (type === 'Bonus') return '#22C55E';
  if (type === 'Incentive') return '#8B5CF6';
  return '#F59E0B'; // Allowance
};

// ─── Demo fallback ────────────────────────────────────────────────────────────

const DEMO_DATA: ScaDashboardDto = {
  revenueMTD: 68000000,
  revenueTarget: 200000000,
  targetPct: 34,
  schoolsWon: 84,
  pipelineValue: 145000000,
  winRate: 33,
  totalUsers: 48,
  activeUsers: 35,
  totalRegions: 4,
  totalZones: 12,
  regions: [],
  revenueChart: [
    { label: 'Oct', value: 42000000 }, { label: 'Nov', value: 55000000 },
    { label: 'Dec', value: 38000000 }, { label: 'Jan', value: 61000000 },
    { label: 'Feb', value: 52000000 }, { label: 'Mar', value: 68000000 },
  ],
  lossReasons: [],
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: rf(12), color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  periodRow: { flexDirection: 'row', gap: 6 },
  periodBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  periodBtnActive: { backgroundColor: '#FFF' },
  periodText: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 14 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },

  // AI
  aiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 10,
  },
  aiBtnText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
  aiHint: { fontSize: rf(11), color: '#9CA3AF', textAlign: 'center' },

  // Direct payments
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  addBtnText: { fontSize: rf(12), fontWeight: '700', color: '#FFF' },
  emptyText: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center', paddingVertical: 10 },
  paymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paymentTypeText: { fontSize: rf(11), fontWeight: '700' },
  paymentUser: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  paymentRight: { alignItems: 'flex-end', gap: 2 },
  paymentAmount: { fontSize: rf(14), fontWeight: '700' },
  paymentDate: { fontSize: rf(10), color: '#9CA3AF' },

  // Table
  tableHeader: {
    flexDirection: 'row', paddingBottom: 8,
    borderBottomWidth: 2, borderBottomColor: '#F3F4F6',
  },
  thCell: { fontSize: rf(11), fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  tdCell: { fontSize: rf(13), color: '#374151', fontWeight: '500' },

  // Chart
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barWrap: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 80, justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 4, alignSelf: 'center', minHeight: 4 },
  barLabel: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  barValue: { fontSize: rf(8), color: '#6B7280', marginBottom: 2 },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, height: 40, backgroundColor: '#F3F4F6' },
  statVal: { fontSize: rf(14), fontWeight: '700', color: '#111827', textAlign: 'center' },
  statLbl: { fontSize: rf(11), color: '#9CA3AF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  inputLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: -4 },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1,
    borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12,
    fontSize: rf(14), color: '#111827',
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  typeChipText: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
});
