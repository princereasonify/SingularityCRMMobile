import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, Alert, RefreshControl, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, CreditCard, TrendingUp, Gift, DollarSign } from 'lucide-react-native';
import { paymentsApi } from '../../api/payments';
import { Payment, DirectPayment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const PRIMARY = '#E11D48';

const TAB_TYPES = ['All', 'Bonus', 'Allowance', 'Incentive'] as const;
type TabType = typeof TAB_TYPES[number];

const TYPE_COLORS: Record<string, string> = {
  Bonus: '#16A34A',
  Allowance: '#2563EB',
  Incentive: '#EA580C',
};

const TYPE_ICONS: Record<string, any> = {
  Bonus: Gift,
  Allowance: CreditCard,
  Incentive: TrendingUp,
};

const PAYMENT_TYPE_OPTIONS = [
  { label: 'Bonus', value: 'Bonus' },
  { label: 'Allowance', value: 'Allowance' },
  { label: 'Incentive', value: 'Incentive' },
];

const DEMO_DIRECT_PAYMENTS: DirectPayment[] = [
  { id: 1, userId: 2, userName: 'Arjun Mehta', type: 'Bonus', amount: 15000, description: 'Q1 performance bonus', createdAt: new Date().toISOString() },
  { id: 2, userId: 3, userName: 'Priya Sharma', type: 'Allowance', amount: 5000, description: 'Travel allowance - March', createdAt: new Date().toISOString() },
  { id: 3, userId: 4, userName: 'Rajesh Kumar', type: 'Incentive', amount: 8000, description: '5 deals closed incentive', createdAt: new Date().toISOString() },
];

export const ScaPaymentsScreen = ({ navigation }: any) => {
  const { user } = useAuth();

  const [tab, setTab] = useState<TabType>('All');
  const [directPayments, setDirectPayments] = useState<DirectPayment[]>([]);
  const [dealPayments, setDealPayments] = useState<Payment[]>([]);
  const [mainTab, setMainTab] = useState<'direct' | 'deals'>('direct');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    userId: '',
    type: 'Bonus' as 'Bonus' | 'Allowance' | 'Incentive',
    amount: '',
    description: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [directRes, dealsRes] = await Promise.allSettled([
        paymentsApi.getDirectPayments(),
        paymentsApi.getAll(),
      ]);
      if (directRes.status === 'fulfilled') {
        const items = (directRes.value.data as any)?.items ?? directRes.value.data ?? [];
        setDirectPayments(Array.isArray(items) ? items : DEMO_DIRECT_PAYMENTS);
      } else {
        setDirectPayments(DEMO_DIRECT_PAYMENTS);
      }
      if (dealsRes.status === 'fulfilled') {
        const items = (dealsRes.value.data as any)?.items ?? dealsRes.value.data ?? [];
        setDealPayments(Array.isArray(items) ? items : []);
      }
    } catch {
      setDirectPayments(DEMO_DIRECT_PAYMENTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleCreate = async () => {
    if (!form.userId || !form.amount) {
      Alert.alert('Validation', 'User ID and amount are required');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation', 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.createDirectPayment({
        userId: parseInt(form.userId),
        type: form.type,
        amount: amt,
        description: form.description || undefined,
      });
      setShowCreateModal(false);
      setForm({ userId: '', type: 'Bonus', amount: '', description: '' });
      fetchData();
      Alert.alert('Success', 'Payment recorded successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const filteredDirect = tab === 'All'
    ? directPayments
    : directPayments.filter(p => p.type === tab);

  const totalDirect = directPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalDeals = dealPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const renderDirectPayment = ({ item }: { item: DirectPayment }) => {
    const IconComp = TYPE_ICONS[item.type] || DollarSign;
    const color = TYPE_COLORS[item.type] || '#6B7280';
    return (
      <Card style={styles.payCard}>
        <View style={styles.payRow}>
          <View style={[styles.typeIcon, { backgroundColor: color + '18' }]}>
            <IconComp size={18} color={color} />
          </View>
          <View style={styles.payInfo}>
            <Text style={styles.payUser}>{item.userName || `User #${item.userId}`}</Text>
            {item.description ? <Text style={styles.payDesc}>{item.description}</Text> : null}
            <Text style={styles.payDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.payRight}>
            <Text style={[styles.payAmount, { color }]}>{formatCurrency(item.amount)}</Text>
            <View style={[styles.typePill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.typePillText, { color }]}>{item.type}</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderDealPayment = ({ item }: { item: Payment }) => (
    <Card style={styles.payCard}>
      <View style={styles.payRow}>
        <View style={[styles.typeIcon, { backgroundColor: '#2563EB18' }]}>
          <CreditCard size={18} color="#2563EB" />
        </View>
        <View style={styles.payInfo}>
          <Text style={styles.payUser}>{item.schoolName || `Deal #${item.dealId}`}</Text>
          {item.transactionId ? <Text style={styles.payDesc}>Ref: {item.transactionId}</Text> : null}
          <Text style={styles.payDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.payRight}>
          <Text style={[styles.payAmount, { color: '#111827' }]}>{formatCurrency(item.amount)}</Text>
          <Badge label={item.status} color={{ Completed: '#16A34A', Pending: '#F59E0B', Failed: '#DC2626' }[item.status] || '#9CA3AF'} />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="SCA Payments"
        color={PRIMARY}
        onMenu={() => navigation.toggleDrawer()}
        rightAction={
          mainTab === 'direct' ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, mainTab === 'direct' && { borderColor: PRIMARY, borderWidth: 2 }]}
          onPress={() => setMainTab('direct')}
        >
          <Text style={styles.summaryLabel}>Direct Payments</Text>
          <Text style={[styles.summaryAmount, { color: PRIMARY }]}>{formatCurrency(totalDirect)}</Text>
          <Text style={styles.summaryCount}>{directPayments.length} records</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.summaryCard, mainTab === 'deals' && { borderColor: '#2563EB', borderWidth: 2 }]}
          onPress={() => setMainTab('deals')}
        >
          <Text style={styles.summaryLabel}>Deal Payments</Text>
          <Text style={[styles.summaryAmount, { color: '#2563EB' }]}>{formatCurrency(totalDeals)}</Text>
          <Text style={styles.summaryCount}>{dealPayments.length} records</Text>
        </TouchableOpacity>
      </View>

      {/* Type Filter (Direct tab only) */}
      {mainTab === 'direct' && (
        <View style={styles.filterRow}>
          {TAB_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, tab === t && { backgroundColor: PRIMARY }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.filterText, tab === t && { color: '#FFF' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <LoadingSpinner fullScreen color={PRIMARY} message="Loading payments..." />
      ) : mainTab === 'direct' ? (
        <FlatList
          data={filteredDirect}
          keyExtractor={item => String(item.id)}
          renderItem={renderDirectPayment}
          contentContainerStyle={[styles.list, filteredDirect.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[PRIMARY]} />}
          ListEmptyComponent={<EmptyState title="No direct payments" subtitle="Tap + to record a bonus, allowance or incentive" icon="💳" />}
        />
      ) : (
        <FlatList
          data={dealPayments}
          keyExtractor={item => String(item.id)}
          renderItem={renderDealPayment}
          contentContainerStyle={[styles.list, dealPayments.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[PRIMARY]} />}
          ListEmptyComponent={<EmptyState title="No deal payments" icon="🤝" />}
        />
      )}

      {/* Create Direct Payment Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Direct Payment</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="User ID *"
                value={form.userId}
                onChangeText={v => set('userId', v)}
                placeholder="Enter user ID"
                keyboardType="numeric"
                accentColor={PRIMARY}
              />
              <SelectPicker
                label="Payment Type *"
                options={PAYMENT_TYPE_OPTIONS}
                value={form.type}
                onChange={v => set('type', v)}
                accentColor={PRIMARY}
              />
              <Input
                label="Amount (₹) *"
                value={form.amount}
                onChangeText={v => set('amount', v)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                accentColor={PRIMARY}
              />
              <Input
                label="Description"
                value={form.description}
                onChangeText={v => set('description', v)}
                placeholder="Optional description"
                accentColor={PRIMARY}
              />
              <Button
                title={saving ? 'Recording...' : 'Record Payment'}
                onPress={handleCreate}
                loading={saving}
                color={PRIMARY}
                size="lg"
                style={{ marginTop: 8, marginBottom: 32 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 12 },
  summaryCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryLabel: { fontSize: rf(12), color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: rf(18), fontWeight: '800', marginBottom: 2 },
  summaryCount: { fontSize: rf(11), color: '#9CA3AF' },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 10, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#E5E7EB',
  },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '600' },
  list: { padding: 12, gap: 8 },
  payCard: { padding: 14 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payInfo: { flex: 1 },
  payUser: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  payDesc: { fontSize: rf(12), color: '#6B7280', marginTop: 1 },
  payDate: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  payRight: { alignItems: 'flex-end', gap: 4 },
  payAmount: { fontSize: rf(16), fontWeight: '700' },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  typePillText: { fontSize: rf(11), fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
});
