import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  TextInput, ActivityIndicator, FlatList, Pressable, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Plus, Send, AlertTriangle, DollarSign, Square, CheckSquare, Paperclip, ExternalLink } from 'lucide-react-native';
// Lazy-load image picker so the app compiles before the package is installed
type _PickerAsset = { uri?: string; fileName?: string };
type _PickerResponse = { assets?: _PickerAsset[] };
type _PickerOptions = { mediaType: string; quality: number };
const launchCamera = (opts: _PickerOptions, cb: (r: _PickerResponse) => void) => {
  try { require('react-native-image-picker').launchCamera(opts, cb); } catch { cb({}); }
};
const launchImageLibrary = (opts: _PickerOptions, cb: (r: _PickerResponse) => void) => {
  try { require('react-native-image-picker').launchImageLibrary(opts, cb); } catch { cb({}); }
};
import { useAuth } from '../../context/AuthContext';
import { trackingApi } from '../../api/tracking';
import { expenseClaimsApi } from '../../api/expenseClaims';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

// ─── Constants ──────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'HotelStay', label: 'Hotel / Stay' },
  { value: 'Food', label: 'Food' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Other', label: 'Other' },
];

const EXP_CAT_COLORS: Record<string, { bg: string; text: string }> = {
  HotelStay: { bg: '#EDE9FE', text: '#7C3AED' },
  Food:      { bg: '#FFEDD5', text: '#EA580C' },
  Transport: { bg: '#DBEAFE', text: '#2563EB' },
  Other:     { bg: '#F3F4F6', text: '#6B7280' },
};

const EXP_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending:  { bg: '#FEF3C7', text: '#D97706' },
  Approved: { bg: '#D1FAE5', text: '#059669' },
  Rejected: { bg: '#FEE2E2', text: '#DC2626' },
};

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}

function fmtCurrency(v: number) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`;
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Expense Form Modal ───────────────────────────────────────────────────────

function ExpenseFormModal({ visible, onClose, onSubmit, submitting }: any) {
  const [form, setForm] = useState({ expenseDate: '', category: 'HotelStay', amount: '', description: '' });
  const [billUri, setBillUri] = useState<string | null>(null);
  const [billName, setBillName] = useState<string | null>(null);

  const reset = () => {
    setForm({ expenseDate: '', category: 'HotelStay', amount: '', description: '' });
    setBillUri(null);
    setBillName(null);
  };

  const handlePickBill = () => {
    Alert.alert('Attach Bill', 'Choose source', [
      {
        text: 'Camera',
        onPress: () => launchCamera({ mediaType: 'photo', quality: 0.8 }, res => {
          if (res.assets?.[0]) { setBillUri(res.assets[0].uri ?? null); setBillName(res.assets[0].fileName ?? 'bill.jpg'); }
        }),
      },
      {
        text: 'Photo Library',
        onPress: () => launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, res => {
          if (res.assets?.[0]) { setBillUri(res.assets[0].uri ?? null); setBillName(res.assets[0].fileName ?? 'bill.jpg'); }
        }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handle = () => {
    if (!form.expenseDate || !form.amount) { Alert.alert('Error', 'Date and amount are required'); return; }
    onSubmit({ ...form, amount: Number(form.amount), billUri, billName });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={ef.header}>
          <Text style={ef.title}>Submit Expense Claim</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ef.content}>
          <DateInput
            label="Expense Date *"
            value={form.expenseDate}
            onChange={v => setForm(f => ({ ...f, expenseDate: v }))}
            accentColor="#7C3AED"
          />
          <SelectPicker
            label="Category *"
            options={EXPENSE_CATEGORIES}
            value={form.category}
            onChange={v => setForm(f => ({ ...f, category: String(v) }))}
            accentColor="#7C3AED"
          />
          <Text style={ef.label}>Amount (₹) *</Text>
          <TextInput
            style={ef.input}
            value={form.amount}
            onChangeText={t => setForm(f => ({ ...f, amount: t }))}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
          <Text style={[ef.label, { marginTop: 12 }]}>Description (optional)</Text>
          <TextInput
            style={ef.input}
            value={form.description}
            onChangeText={t => setForm(f => ({ ...f, description: t }))}
            placeholder="Brief description"
            placeholderTextColor="#9CA3AF"
          />

          {/* Upload Bill */}
          <Text style={[ef.label, { marginTop: 12 }]}>Upload Bill (optional)</Text>
          <TouchableOpacity style={ef.billBtn} onPress={handlePickBill}>
            <Paperclip size={16} color="#7C3AED" />
            <Text style={ef.billBtnText}>{billName ? billName : 'Attach receipt / bill'}</Text>
            {billUri && <X size={14} color="#9CA3AF" onPress={(e: any) => { e.stopPropagation?.(); setBillUri(null); setBillName(null); }} />}
          </TouchableOpacity>
          {billUri && (
            <Image source={{ uri: billUri }} style={ef.billPreview} resizeMode="cover" />
          )}

          <TouchableOpacity
            style={[ef.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handle}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={16} color="#FFF" />}
            <Text style={ef.submitText}>{submitting ? 'Submitting...' : 'Submit Claim'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ef = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
  title: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  content: { padding: 16 },
  label: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: rf(14), color: '#111827', marginBottom: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  submitText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
  billBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA', borderStyle: 'dashed' },
  billBtnText: { flex: 1, fontSize: rf(13), color: '#6B7280' },
  billPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
});

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ visible, onClose, onReject, rejecting }: any) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rej.overlay}>
        <View style={rej.box}>
          <Text style={rej.title}>Reject Expense Claim</Text>
          <TextInput
            style={rej.textarea}
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={rej.actions}>
            <TouchableOpacity style={rej.cancelBtn} onPress={onClose}>
              <Text style={rej.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rej.rejectBtn, rejecting && { opacity: 0.6 }]}
              onPress={() => {
                if (!reason.trim()) { Alert.alert('Error', 'Reason required'); return; }
                onReject(reason.trim());
              }}
              disabled={rejecting}
            >
              <Text style={rej.rejectText}>{rejecting ? 'Rejecting...' : 'Reject'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rej = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  title: { fontSize: rf(16), fontWeight: '700', color: '#111827', marginBottom: 12 },
  textarea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: rf(14), color: '#111827', minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
  rejectText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});

// ─── Travel Allowance Card ───────────────────────────────────────────────────

function TravelCard({ item, isManager, selected, onSelect, onApprove, onReject }: any) {
  return (
    <Pressable style={[tc.card, selected && { borderColor: '#0D9488', borderWidth: 1.5 }]} onPress={onSelect}>
      <View style={tc.row}>
        <View style={tc.left}>
          {isManager && onSelect && (
            <View style={{ marginBottom: 4 }}>
              {selected ? <CheckSquare size={16} color="#0D9488" /> : <Square size={16} color="#D1D5DB" />}
            </View>
          )}
          <Text style={tc.name}>{item.userName || '—'}</Text>
          <Text style={tc.meta}>{item.role || ''} · {fmtDate(item.allowanceDate)}</Text>
          <View style={tc.badges}>
            <Text style={tc.dist}>{item.distanceKm != null ? `${Number(item.distanceKm).toFixed(1)} km` : '—'}</Text>
            <Text style={tc.rate}>@ {fmtCurrency(item.ratePerKm)}/km</Text>
          </View>
        </View>
        <View style={tc.right}>
          <Text style={tc.amount}>{fmtCurrency(item.grossAmount)}</Text>
          <View style={[tc.statusBadge, { backgroundColor: item.approved ? '#D1FAE5' : '#FEF3C7' }]}>
            <Text style={[tc.statusText, { color: item.approved ? '#059669' : '#D97706' }]}>
              {item.approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
          {isManager && !item.approved && (
            <View style={tc.actionBtns}>
              <TouchableOpacity style={tc.approveBtn} onPress={() => onApprove(item.id)}>
                <Check size={12} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={tc.rejectBtn} onPress={() => onReject(item.id)}>
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      {item.isSuspicious && (
        <View style={tc.suspRow}>
          <AlertTriangle size={12} color="#DC2626" />
          <Text style={tc.suspText}>Fraud score: {item.fraudScore || 0} — Flagged suspicious</Text>
        </View>
      )}
    </Pressable>
  );
}

const tc = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  name: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  meta: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dist: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  rate: { fontSize: rf(12), color: '#9CA3AF' },
  amount: { fontSize: rf(16), fontWeight: '800', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  statusText: { fontSize: rf(11), fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 4 },
  approveBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  suspRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 6, marginTop: 8 },
  suspText: { fontSize: rf(11), color: '#DC2626' },
});

// ─── Expense Card ────────────────────────────────────────────────────────────

function ExpenseCard({ item, isTeam, isManager, onApprove, onReject }: any) {
  const cc = EXP_CAT_COLORS[item.category] || EXP_CAT_COLORS.Other;
  const sc = EXP_STATUS_COLORS[item.status] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={ec.card}>
      <View style={ec.row}>
        <View style={{ flex: 1 }}>
          {isTeam && <Text style={ec.name}>{item.userName} <Text style={ec.role}>({item.userRole})</Text></Text>}
          <View style={ec.badges}>
            <View style={[ec.badge, { backgroundColor: cc.bg }]}>
              <Text style={[ec.badgeText, { color: cc.text }]}>{EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label || item.category}</Text>
            </View>
            <View style={[ec.badge, { backgroundColor: sc.bg }]}>
              <Text style={[ec.badgeText, { color: sc.text }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={ec.date}>{fmtDate(item.expenseDate)}</Text>
          {item.description ? <Text style={ec.desc}>{item.description}</Text> : null}
          {item.rejectionReason ? <Text style={ec.rejection}>Rejected: {item.rejectionReason}</Text> : null}
          {item.billUrl ? (
            <TouchableOpacity style={ec.billLink} onPress={() => Linking.openURL(item.billUrl)}>
              <ExternalLink size={12} color="#7C3AED" />
              <Text style={ec.billLinkText}>View Bill</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={ec.right}>
          <Text style={ec.amount}>{fmtCurrency(item.amount)}</Text>
          {isManager && isTeam && item.status === 'Pending' && (
            <View style={ec.actionBtns}>
              <TouchableOpacity style={ec.approveBtn} onPress={() => onApprove(item.id)}>
                <Check size={12} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={ec.rejectBtn} onPress={() => onReject(item.id)}>
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const ec = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 4 },
  role: { fontSize: rf(12), color: '#6B7280', fontWeight: '400' },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeText: { fontSize: rf(11), fontWeight: '700' },
  date: { fontSize: rf(12), color: '#6B7280' },
  desc: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  rejection: { fontSize: rf(11), color: '#DC2626', marginTop: 2 },
  billLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  billLinkText: { fontSize: rf(12), color: '#7C3AED', fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: rf(16), fontWeight: '800', color: '#111827' },
  actionBtns: { flexDirection: 'row', gap: 4 },
  approveBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
});

// ─── Summary Cards ───────────────────────────────────────────────────────────

function SummaryRow({ total, approved, pending }: { total: number; approved: number; pending: number }) {
  return (
    <View style={sum.row}>
      <View style={sum.card}>
        <Text style={sum.label}>Total</Text>
        <Text style={sum.val}>{fmtCurrency(total)}</Text>
      </View>
      <View style={[sum.card, { borderColor: '#D1FAE5' }]}>
        <Text style={[sum.label, { color: '#059669' }]}>Approved</Text>
        <Text style={[sum.val, { color: '#059669' }]}>{fmtCurrency(approved)}</Text>
      </View>
      <View style={[sum.card, { borderColor: '#FEF3C7' }]}>
        <Text style={[sum.label, { color: '#D97706' }]}>Pending</Text>
        <Text style={[sum.val, { color: '#D97706' }]}>{fmtCurrency(pending)}</Text>
      </View>
    </View>
  );
}

const sum = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  card: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 10, alignItems: 'center' },
  label: { fontSize: rf(11), color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  val: { fontSize: rf(14), fontWeight: '800', color: '#111827' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const AllowancesScreen = () => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const isManager = role !== 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const { from: defaultFrom, to: defaultTo } = getMonthRange();
  const [mainTab, setMainTab] = useState<'travel' | 'expense'>('travel');

  // ── Travel State ──
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [tStatusFilter, setTStatusFilter] = useState('all');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [tUserFilter, setTUserFilter] = useState('');
  const [tSelected, setTSelected] = useState<Set<number>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // ── Expense State ──
  const [expDateFrom, setExpDateFrom] = useState(defaultFrom);
  const [expDateTo, setExpDateTo] = useState(defaultTo);
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [teamExpenses, setTeamExpenses] = useState<any[]>([]);
  const [eLoading, setELoading] = useState(false);
  const [eStatusFilter, setEStatusFilter] = useState('all');
  const [expSubTab, setExpSubTab] = useState<'my' | 'team'>('my');
  const [showExpForm, setShowExpForm] = useState(false);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [rejectClaimId, setRejectClaimId] = useState<number | null>(null);
  const [rejectTravelId, setRejectTravelId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    authApi.getUsers().then(res => setTeamMembers(res.data || [])).catch(() => {});
  }, [isManager]);

  // ── Travel Fetch ──
  const fetchTravel = useCallback(async () => {
    setTLoading(true);
    try {
      const res = await trackingApi.getAllowances(dateFrom, dateTo, tUserFilter || undefined);
      const data: any = res.data;
      setAllowances(data?.allowances || (Array.isArray(data) ? data : []));
    } catch {
      Alert.alert('Error', 'Failed to load travel allowances');
    } finally {
      setTLoading(false);
    }
  }, [dateFrom, dateTo, tUserFilter]);

  useEffect(() => { if (mainTab === 'travel') fetchTravel(); }, [fetchTravel, mainTab]);

  // ── Expense Fetch ──
  const fetchExpenses = useCallback(async () => {
    setELoading(true);
    try {
      const params: any = { from: expDateFrom, to: expDateTo };
      if (eStatusFilter !== 'all') params.status = eStatusFilter;
      const [myRes, teamRes] = await Promise.all([
        expenseClaimsApi.getMyClaims(params),
        isManager ? expenseClaimsApi.getTeamClaims(params) : Promise.resolve({ data: [] }),
      ]);
      setMyExpenses(myRes.data || []);
      setTeamExpenses((teamRes as any).data || []);
    } catch {
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setELoading(false);
    }
  }, [expDateFrom, expDateTo, eStatusFilter, isManager]);

  useEffect(() => { if (mainTab === 'expense') fetchExpenses(); }, [fetchExpenses, mainTab]);

  // ── Travel Helpers ──
  const tFiltered = allowances.filter(a => {
    if (tStatusFilter === 'pending') return !a.approved;
    if (tStatusFilter === 'approved') return a.approved;
    return true;
  });
  const tTotal = allowances.reduce((s: number, a: any) => s + (a.grossAmount || 0), 0);
  const tApproved = allowances.filter((a: any) => a.approved).reduce((s: number, a: any) => s + (a.grossAmount || 0), 0);
  const tPending = tTotal - tApproved;

  const tPendingItems = tFiltered.filter((a: any) => !a.approved);

  const handleTravelApprove = async (id: number) => {
    try {
      await trackingApi.approveAllowance(id, { approved: true });
      fetchTravel();
    } catch { Alert.alert('Error', 'Failed to approve'); }
  };

  const handleBulkApproveTravel = async () => {
    if (tSelected.size === 0) return;
    setBulkApproving(true);
    try {
      await trackingApi.bulkApproveAllowances({ ids: [...tSelected], approved: true });
      setTSelected(new Set());
      fetchTravel();
    } catch { Alert.alert('Error', 'Failed to bulk approve'); }
    finally { setBulkApproving(false); }
  };

  const toggleTSelect = (id: number) => {
    setTSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTravelReject = async (reason: string) => {
    if (!rejectTravelId) return;
    setRejecting(true);
    try {
      await trackingApi.approveAllowance(rejectTravelId, { approved: false, remarks: reason });
      setRejectTravelId(null);
      fetchTravel();
    } catch { Alert.alert('Error', 'Failed to reject'); }
    finally { setRejecting(false); }
  };

  // ── Expense Helpers ──
  const currentExpenses = expSubTab === 'my' ? myExpenses : teamExpenses;
  const eTotal = currentExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const eApproved = currentExpenses.filter((e: any) => e.status === 'Approved').reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const ePending = eTotal - eApproved;

  const handleSubmitExpense = async (form: any) => {
    setExpSubmitting(true);
    try {
      if (form.billUri) {
        const fd = new FormData();
        fd.append('expenseDate', form.expenseDate);
        fd.append('category', form.category);
        fd.append('amount', String(form.amount));
        if (form.description) fd.append('description', form.description);
        fd.append('bill', { uri: form.billUri, type: 'image/jpeg', name: form.billName || 'bill.jpg' } as any);
        await expenseClaimsApi.createClaimWithBill(fd);
      } else {
        await expenseClaimsApi.createClaim({ expenseDate: form.expenseDate, category: form.category, amount: form.amount, description: form.description });
      }
      Alert.alert('Success', 'Expense claim submitted');
      setShowExpForm(false);
      fetchExpenses();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit');
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleExpenseApprove = async (id: number) => {
    try {
      await expenseClaimsApi.approveClaim(id);
      fetchExpenses();
    } catch { Alert.alert('Error', 'Failed to approve'); }
  };

  const handleExpenseReject = async (reason: string) => {
    if (!rejectClaimId) return;
    setRejecting(true);
    try {
      await expenseClaimsApi.rejectClaim(rejectClaimId, { rejectionReason: reason });
      setRejectClaimId(null);
      fetchExpenses();
    } catch { Alert.alert('Error', 'Failed to reject'); }
    finally { setRejecting(false); }
  };

  const teamMemberOptions = [
    { value: '', label: 'All Members' },
    ...teamMembers.map(m => ({ value: String(m.id), label: `${m.name} (${m.role})` })),
  ];

  const tStatusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
  ];
  const eStatusOptions = [
    { value: 'all', label: 'All' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Header */}
      <View style={s.headerBar}>
        <View>
          <Text style={s.pageTitle}>Allowances</Text>
          <Text style={s.pageSub}>{isManager ? 'Review and approve allowances for your team' : 'View your allowance history'}</Text>
        </View>
      </View>

      {/* Main Tabs */}
      <View style={s.mainTabs}>
        <TouchableOpacity style={[s.mainTab, mainTab === 'travel' && { backgroundColor: COLOR.primary }]} onPress={() => setMainTab('travel')}>
          <Text style={[s.mainTabText, mainTab === 'travel' && { color: '#FFF' }]}>Travel Allowance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.mainTab, mainTab === 'expense' && { backgroundColor: COLOR.primary }]} onPress={() => setMainTab('expense')}>
          <Text style={[s.mainTabText, mainTab === 'expense' && { color: '#FFF' }]}>Expense Claims</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ TRAVEL TAB ═══ */}
      {mainTab === 'travel' && (
        <View style={{ flex: 1 }}>
          <SummaryRow total={tTotal} approved={tApproved} pending={tPending} />
          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <DateInput label="From" value={dateFrom} onChange={setDateFrom} accentColor={COLOR.primary} />
            <DateInput label="To" value={dateTo} onChange={setDateTo} accentColor={COLOR.primary} />
            <SelectPicker
              placeholder="Status"
              options={tStatusOptions}
              value={tStatusFilter}
              onChange={v => setTStatusFilter(String(v))}
              accentColor={COLOR.primary}
              containerStyle={{ width: 120, marginBottom: 0 }}
            />
            {isManager && teamMemberOptions.length > 1 && (
              <SelectPicker
                placeholder="Member"
                options={teamMemberOptions}
                value={tUserFilter}
                onChange={v => setTUserFilter(String(v))}
                accentColor={COLOR.primary}
                containerStyle={{ width: 140, marginBottom: 0 }}
              />
            )}
          </ScrollView>

          {/* Bulk approve row */}
          {isManager && tPendingItems.length > 0 && (
            <View style={s.bulkRow}>
              <Text style={s.bulkCount}>{tSelected.size > 0 ? `${tSelected.size} selected` : `${tPendingItems.length} pending`}</Text>
              <TouchableOpacity
                style={[s.bulkBtn, (tSelected.size === 0 || bulkApproving) && s.bulkBtnDisabled]}
                onPress={handleBulkApproveTravel}
                disabled={tSelected.size === 0 || bulkApproving}
              >
                {bulkApproving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <><Check size={14} color="#FFF" /><Text style={s.bulkBtnText}>Approve Selected ({tSelected.size})</Text></>
                }
              </TouchableOpacity>
            </View>
          )}

          {tLoading ? (
            <LoadingSpinner fullScreen color={COLOR.primary} message="Loading allowances..." />
          ) : (
            <FlatList
              data={tFiltered}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TravelCard
                  item={item}
                  isManager={isManager}
                  selected={tSelected.has(item.id)}
                  onSelect={isManager && !item.approved ? () => toggleTSelect(item.id) : undefined}
                  onApprove={handleTravelApprove}
                  onReject={(id: number) => setRejectTravelId(id)}
                />
              )}
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.empty}>
                  <DollarSign size={40} color="#D1D5DB" />
                  <Text style={s.emptyText}>No travel allowances for selected period</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ═══ EXPENSE TAB ═══ */}
      {mainTab === 'expense' && (
        <View style={{ flex: 1 }}>
          <SummaryRow total={eTotal} approved={eApproved} pending={ePending} />
          {/* Sub-tabs + Submit */}
          <View style={s.expSubRow}>
            <View style={s.expSubTabs}>
              <TouchableOpacity style={[s.subTab, expSubTab === 'my' && { backgroundColor: COLOR.primary }]} onPress={() => setExpSubTab('my')}>
                <Text style={[s.subTabText, expSubTab === 'my' && { color: '#FFF' }]}>My Claims</Text>
              </TouchableOpacity>
              {isManager && (
                <TouchableOpacity style={[s.subTab, expSubTab === 'team' && { backgroundColor: COLOR.primary }]} onPress={() => setExpSubTab('team')}>
                  <Text style={[s.subTabText, expSubTab === 'team' && { color: '#FFF' }]}>Team Claims</Text>
                </TouchableOpacity>
              )}
            </View>
            {expSubTab === 'my' && (
              <TouchableOpacity style={[s.addBtn, { backgroundColor: COLOR.primary }]} onPress={() => setShowExpForm(true)}>
                <Plus size={14} color="#FFF" />
                <Text style={s.addBtnText}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <DateInput label="From" value={expDateFrom} onChange={setExpDateFrom} accentColor={COLOR.primary} />
            <DateInput label="To" value={expDateTo} onChange={setExpDateTo} accentColor={COLOR.primary} />
            <SelectPicker
              placeholder="Status"
              options={eStatusOptions}
              value={eStatusFilter}
              onChange={v => setEStatusFilter(String(v))}
              accentColor={COLOR.primary}
              containerStyle={{ width: 130, marginBottom: 0 }}
            />
          </ScrollView>

          {eLoading ? (
            <LoadingSpinner fullScreen color={COLOR.primary} message="Loading expenses..." />
          ) : (
            <FlatList
              data={currentExpenses}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <ExpenseCard
                  item={item}
                  isTeam={expSubTab === 'team'}
                  isManager={isManager}
                  onApprove={handleExpenseApprove}
                  onReject={(id: number) => setRejectClaimId(id)}
                />
              )}
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>📄</Text>
                  <Text style={s.emptyText}>No expense claims found</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Modals */}
      <ExpenseFormModal
        visible={showExpForm}
        onClose={() => setShowExpForm(false)}
        onSubmit={handleSubmitExpense}
        submitting={expSubmitting}
      />
      <RejectModal
        visible={rejectClaimId !== null}
        onClose={() => setRejectClaimId(null)}
        onReject={handleExpenseReject}
        rejecting={rejecting}
      />
      <RejectModal
        visible={rejectTravelId !== null}
        onClose={() => setRejectTravelId(null)}
        onReject={handleTravelReject}
        rejecting={rejecting}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  headerBar: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  mainTabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mainTab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  mainTabText: { fontSize: rf(13), fontWeight: '700', color: '#6B7280' },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 10, alignItems: 'flex-end' },
  expSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  expSubTabs: { flexDirection: 'row', gap: 6 },
  subTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F3F4F6' },
  subTabText: { fontSize: rf(12), fontWeight: '700', color: '#6B7280' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addBtnText: { fontSize: rf(12), fontWeight: '700', color: '#FFF' },
  list: { padding: 12, paddingBottom: 32 },
  bulkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  bulkCount: { fontSize: rf(12), color: '#6B7280', fontWeight: '600' },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#16A34A', borderRadius: 10 },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnText: { fontSize: rf(12), fontWeight: '700', color: '#FFF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF', textAlign: 'center' },
});
