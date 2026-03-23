import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { paymentsApi } from '../../api/payments';
import { Payment, CreatePaymentRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'Pending', 'Completed', 'Failed'];
const METHODS = ['Cash', 'Cheque', 'Online', 'NEFT', 'UPI'];

const STATUS_COLORS: Record<string, string> = {
  Pending: '#F59E0B', Completed: '#16A34A', Failed: '#DC2626', Processing: '#2563EB',
};
const METHOD_COLORS: Record<string, string> = {
  Cash: '#16A34A', Cheque: '#7C3AED', Online: '#2563EB', NEFT: '#0D9488', UPI: '#EA580C',
};

export const PaymentsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const [dealId, setDealId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Online');
  const [transactionId, setTransactionId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'All') params.status = filter;
      const res = await paymentsApi.getAll(params);
      const items: Payment[] = (res.data as any)?.items ?? res.data ?? [];
      setPayments(items);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchPayments();
  }, [filter]);

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const handleCreate = async () => {
    if (!dealId || !amount) { Alert.alert('Validation', 'Deal ID and amount are required'); return; }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) { Alert.alert('Validation', 'Enter a valid amount'); return; }
    setSaving(true);
    try {
      await paymentsApi.create({
        dealId: parseInt(dealId),
        amount: amtNum,
        method,
        transactionId: transactionId || undefined,
        chequeNumber: method === 'Cheque' ? chequeNumber || undefined : undefined,
        chequeDate: method === 'Cheque' ? chequeDate || undefined : undefined,
        bankName: method === 'Cheque' ? bankName || undefined : undefined,
        notes: notes || undefined,
      });
      setShowModal(false);
      setDealId(''); setAmount(''); setTransactionId(''); setChequeNumber(''); setChequeDate(''); setBankName(''); setNotes('');
      fetchPayments();
    } catch { Alert.alert('Error', 'Failed to record payment'); }
    finally { setSaving(false); }
  };

  const renderPayment = ({ item }: { item: Payment }) => (
    <Card>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          {item.schoolName && <Text style={styles.school}>{item.schoolName}</Text>}
        </View>
        <View style={styles.cardRight}>
          <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
          <Badge label={item.method} color={METHOD_COLORS[item.method] || '#9CA3AF'} />
        </View>
      </View>
      <View style={styles.cardMeta}>
        {item.transactionId && <Text style={styles.txId}>Ref: {item.transactionId}</Text>}
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Payments"
        color={COLOR.primary}
        rightAction={
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <Plus size={22} color="#FFF" />
          </TouchableOpacity>
        }
      />

      {/* Summary */}
      <View style={[styles.summaryBar, { backgroundColor: COLOR.primary + '18' }]}>
        <Text style={[styles.summaryLabel, { color: COLOR.primary }]}>Total: <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text></Text>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && { backgroundColor: COLOR.primary }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading payments..." />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={item => String(item.id)}
          renderItem={renderPayment}
          contentContainerStyle={[styles.list, payments.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} colors={[COLOR.primary]} />}
          ListEmptyComponent={<EmptyState title="No payments found" subtitle="Record a payment by tapping +" icon="💰" />}
        />
      )}

      {/* Create Payment Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Field label="Deal ID *" value={dealId} onChange={setDealId} placeholder="Deal ID" keyboardType="numeric" />
            <Field label="Amount (₹) *" value={amount} onChange={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.chipRow}>
              {METHODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, method === m && { backgroundColor: COLOR.primary }]}
                  onPress={() => setMethod(m)}
                >
                  <Text style={[styles.chipText, method === m && { color: '#FFF' }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {method !== 'Cash' && (
              <Field label="Transaction ID" value={transactionId} onChange={setTransactionId} placeholder="Reference number" />
            )}
            {method === 'Cheque' && (
              <>
                <Field label="Cheque Number" value={chequeNumber} onChange={setChequeNumber} placeholder="Cheque number" />
                <Field label="Cheque Date" value={chequeDate} onChange={setChequeDate} placeholder="YYYY-MM-DD" />
                <Field label="Bank Name" value={bankName} onChange={setBankName} placeholder="Bank name" />
              </>
            )}
            <Field label="Notes" value={notes} onChange={setNotes} placeholder="Optional notes" multiline />
            <Button title={saving ? 'Recording...' : 'Record Payment'} onPress={handleCreate} variant="primary" disabled={saving} style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, keyboardType, multiline }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { height: 60, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  summaryBar: { padding: 14, gap: 10 },
  summaryLabel: { fontSize: rf(14), fontWeight: '600' },
  summaryAmount: { fontWeight: '700', fontSize: rf(16) },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#E5E7EB',
  },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: {},
  amount: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  school: { fontSize: rf(13), color: '#6B7280', marginTop: 2 },
  cardRight: { gap: 4, alignItems: 'flex-end' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txId: { fontSize: rf(12), color: '#9CA3AF' },
  date: { fontSize: rf(12), color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
});
