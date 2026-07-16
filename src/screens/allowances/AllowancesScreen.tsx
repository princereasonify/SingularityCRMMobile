import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  TextInput, ActivityIndicator, FlatList, Pressable, Image, Linking,
  Platform, PermissionsAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, Plus, Send, AlertTriangle, DollarSign, Square, CheckSquare, Paperclip, ExternalLink } from 'lucide-react-native';
import { launchCamera as _launchCamera, launchImageLibrary as _launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { trackingApi } from '../../api/tracking';
import { expenseClaimsApi } from '../../api/expenseClaims';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Badge } from '../../components/ui';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { rf } from '../../utils/responsive';

// ─── Constants ──────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'HotelStay', label: 'Hotel / Stay' },
  { value: 'Food', label: 'Food' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Other', label: 'Other' },
];

// Category accent per expense type, resolved against the active theme tokens.
function categoryColor(T: AppTheme, category: string): string {
  switch (category) {
    case 'HotelStay': return T.info;
    case 'Food': return T.warning;
    case 'Transport': return T.accent;
    default: return T.dim;
  }
}

// Status accent — pending → warning, approved → success, rejected → danger.
function statusColor(T: AppTheme, status: string): string {
  if (status === 'Approved') return T.success;
  if (status === 'Rejected') return T.danger;
  return T.warning;
}

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
  const T = useAppTheme();
  const [form, setForm] = useState({ expenseDate: '', category: 'HotelStay', amount: '', description: '' });
  const [billUri, setBillUri] = useState<string | null>(null);
  const [billName, setBillName] = useState<string | null>(null);

  const reset = () => {
    setForm({ expenseDate: '', category: 'HotelStay', amount: '', description: '' });
    setBillUri(null);
    setBillName(null);
  };

  const openCamera = async () => {
    if (Platform.OS === 'android') {
      try {
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (!already) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission Required',
              message: 'The app needs camera access to capture your bill.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Camera Permission Blocked',
              'Camera access is blocked. Please enable it in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return;
          }
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Camera access is required to capture bill photos.');
            return;
          }
        }
      } catch {
        Alert.alert('Error', 'Could not request camera permission.');
        return;
      }
    }

    _launchCamera(
      { mediaType: 'photo', quality: 0.8, saveToPhotos: false, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode === 'permission') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera access in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        if (res.errorCode === 'camera_unavailable') {
          Alert.alert('Camera Unavailable', 'No camera found on this device.');
          return;
        }
        if (res.errorCode) {
          Alert.alert('Camera Error', res.errorMessage ?? 'Could not open camera.');
          return;
        }
        const asset = res.assets?.[0];
        if (asset?.uri) {
          setBillUri(asset.uri);
          setBillName(asset.fileName ?? `bill_${Date.now()}.jpg`);
        }
      },
    );
  };

  const openPhotoLibrary = async () => {
    if (Platform.OS === 'android') {
      try {
        const permission = Number(Platform.Version) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        const already = await PermissionsAndroid.check(permission);
        if (!already) {
          const result = await PermissionsAndroid.request(permission, {
            title: 'Photo Library Permission Required',
            message: 'The app needs access to your photos to attach a bill.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          });
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Photo Permission Blocked',
              'Photo access is blocked. Please enable it in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return;
          }
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Photo library access is required to attach a bill.');
            return;
          }
        }
      } catch {
        Alert.alert('Error', 'Could not request photo library permission.');
        return;
      }
    }

    _launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode === 'permission') {
          Alert.alert(
            'Photo Permission Required',
            'Please enable photo library access in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        if (res.errorCode) {
          Alert.alert('Error', res.errorMessage ?? 'Could not open photo library.');
          return;
        }
        const asset = res.assets?.[0];
        if (asset?.uri) {
          setBillUri(asset.uri);
          setBillName(asset.fileName ?? `bill_${Date.now()}.jpg`);
        }
      },
    );
  };

  const handlePickBill = () => {
    Alert.alert('Attach Bill', 'Choose source', [
      { text: 'Camera', onPress: openCamera },
      { text: 'Photo Library', onPress: openPhotoLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handle = () => {
    if (!form.expenseDate || !form.amount) { Alert.alert('Error', 'Date and amount are required'); return; }
    onSubmit({ ...form, amount: Number(form.amount), billUri, billName });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
        <View style={[ef.header, { backgroundColor: T.card, borderBottomColor: T.line }]}>
          <Text style={[ef.title, { color: T.text }]}>Submit Expense Claim</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <X size={22} color={T.sub} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ef.content}>
          <DateInput
            label="Expense Date *"
            value={form.expenseDate}
            onChange={v => setForm(f => ({ ...f, expenseDate: v }))}
            accentColor={T.accent}
          />
          <SelectPicker
            label="Category *"
            options={EXPENSE_CATEGORIES}
            value={form.category}
            onChange={v => setForm(f => ({ ...f, category: String(v) }))}
            accentColor={T.accent}
          />
          <Text style={[ef.label, { color: T.sub }]}>Amount (₹) *</Text>
          <TextInput
            style={[ef.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={form.amount}
            onChangeText={t => setForm(f => ({ ...f, amount: t }))}
            placeholder="0"
            placeholderTextColor={T.dim}
            keyboardType="numeric"
          />
          <Text style={[ef.label, { color: T.sub, marginTop: 12 }]}>Description (optional)</Text>
          <TextInput
            style={[ef.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={form.description}
            onChangeText={t => setForm(f => ({ ...f, description: t }))}
            placeholder="Brief description"
            placeholderTextColor={T.dim}
          />

          {/* Upload Bill */}
          <Text style={[ef.label, { color: T.sub, marginTop: 12 }]}>Upload Bill (optional)</Text>
          <TouchableOpacity style={[ef.billBtn, { backgroundColor: T.cardAlt, borderColor: T.line }]} onPress={handlePickBill}>
            <Paperclip size={16} color={T.accent} />
            <Text style={[ef.billBtnText, { color: T.sub }]}>{billName ? billName : 'Attach receipt / bill'}</Text>
            {billUri && <X size={14} color={T.dim} onPress={(e: any) => { e.stopPropagation?.(); setBillUri(null); setBillName(null); }} />}
          </TouchableOpacity>
          {billUri && (
            <Image source={{ uri: billUri }} style={[ef.billPreview, { borderColor: T.line }]} resizeMode="cover" />
          )}

          <GradientButton
            label={submitting ? 'Submitting...' : 'Submit Claim'}
            onPress={handle}
            loading={submitting}
            icon={<Send size={16} color="#FFF" />}
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ef = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontFamily: Fonts.bold, fontSize: rf(17) },
  content: { padding: 16 },
  label: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontFamily: Fonts.regular, fontSize: rf(14), marginBottom: 4 },
  billBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderStyle: 'dashed' },
  billBtnText: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(13) },
  billPreview: { width: '100%', height: 160, borderRadius: 14, marginTop: 10, borderWidth: 1 },
});

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ visible, onClose, onReject, rejecting }: any) {
  const T = useAppTheme();
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rej.overlay}>
        <View style={[rej.box, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[rej.title, { color: T.text }]}>Reject Expense Claim</Text>
          <TextInput
            style={[rej.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor={T.dim}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={rej.actions}>
            <TouchableOpacity style={[rej.cancelBtn, { backgroundColor: T.cardAlt }]} onPress={onClose}>
              <Text style={[rej.cancelText, { color: T.sub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rej.rejectBtn, { backgroundColor: T.danger }, rejecting && { opacity: 0.6 }]}
              onPress={() => {
                if (!reason.trim()) { Alert.alert('Error', 'Reason required'); return; }
                onReject(reason.trim());
              }}
              disabled={rejecting}
            >
              <Text style={[rej.rejectText, { color: '#FFF' }]}>{rejecting ? 'Rejecting...' : 'Reject'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rej = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1 },
  title: { fontFamily: Fonts.bold, fontSize: rf(16), marginBottom: 12 },
  textarea: { borderWidth: 1, borderRadius: 14, padding: 12, fontFamily: Fonts.regular, fontSize: rf(14), minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelText: { fontFamily: Fonts.medium, fontSize: rf(14) },
  rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  rejectText: { fontFamily: Fonts.medium, fontSize: rf(14) },
});

// ─── Travel Allowance Card ───────────────────────────────────────────────────

function TravelCard({ item, isManager, selected, onSelect, onApprove, onReject }: any) {
  const T = useAppTheme();
  return (
    <Pressable
      style={[tc.card, { backgroundColor: T.card, borderColor: T.line }, selected && { borderColor: T.accent, borderWidth: 1.5 }]}
      onPress={onSelect}
    >
      <View style={tc.row}>
        <View style={tc.left}>
          {isManager && onSelect && (
            <View style={{ marginBottom: 4 }}>
              {selected ? <CheckSquare size={16} color={T.accent} /> : <Square size={16} color={T.dim} />}
            </View>
          )}
          <Text style={[tc.name, { color: T.text }]}>{item.userName || '—'}</Text>
          <Text style={[tc.meta, { color: T.sub }]}>{item.role || ''} · {fmtDate(item.allowanceDate)}</Text>
          <View style={tc.badges}>
            <Text style={[tc.dist, { color: T.text }]}>{item.distanceKm != null ? `${Number(item.distanceKm).toFixed(1)} km` : '—'}</Text>
            <Text style={[tc.rate, { color: T.dim }]}>@ {fmtCurrency(item.ratePerKm)}/km</Text>
          </View>
        </View>
        <View style={tc.right}>
          <Text style={[tc.amount, { color: T.text }]}>{fmtCurrency(item.grossAmount)}</Text>
          <Badge label={item.approved ? 'Approved' : 'Pending'} color={item.approved ? T.success : T.warning} />
          {isManager && onApprove && onReject && !item.approved && (
            <View style={tc.actionBtns}>
              <TouchableOpacity style={[tc.approveBtn, { backgroundColor: T.success }]} onPress={() => onApprove(item.id)}>
                <Check size={12} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[tc.rejectBtn, { backgroundColor: T.danger }]} onPress={() => onReject(item.id)}>
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      {item.isSuspicious && (
        <View style={[tc.suspRow, { backgroundColor: T.danger + '22' }]}>
          <AlertTriangle size={12} color={T.danger} />
          <Text style={[tc.suspText, { color: T.danger }]}>Fraud score: {item.fraudScore || 0} — Flagged suspicious</Text>
        </View>
      )}
    </Pressable>
  );
}

const tc = StyleSheet.create({
  card: { borderRadius: 18, marginBottom: 10, padding: 14, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  name: { fontFamily: Fonts.bold, fontSize: rf(14) },
  meta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dist: { fontFamily: Fonts.medium, fontSize: rf(13) },
  rate: { fontFamily: Fonts.regular, fontSize: rf(12) },
  amount: { fontFamily: Fonts.bold, fontSize: rf(16) },
  actionBtns: { flexDirection: 'row', gap: 4 },
  approveBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  suspRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 6, marginTop: 8 },
  suspText: { fontFamily: Fonts.regular, fontSize: rf(11) },
});

// ─── Expense Card ────────────────────────────────────────────────────────────

function ExpenseCard({ item, isTeam, isManager, onApprove, onReject }: any) {
  const T = useAppTheme();
  const catLabel = EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label || item.category;
  return (
    <View style={[ec.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={ec.row}>
        <View style={{ flex: 1 }}>
          {isTeam && <Text style={[ec.name, { color: T.text }]}>{item.userName} <Text style={[ec.role, { color: T.sub }]}>({item.userRole})</Text></Text>}
          <View style={ec.badges}>
            <Badge label={catLabel} color={categoryColor(T, item.category)} />
            <Badge label={item.status} color={statusColor(T, item.status)} />
          </View>
          <Text style={[ec.date, { color: T.sub }]}>{fmtDate(item.expenseDate)}</Text>
          {item.description ? <Text style={[ec.desc, { color: T.dim }]}>{item.description}</Text> : null}
          {item.rejectionReason ? <Text style={[ec.rejection, { color: T.danger }]}>Rejected: {item.rejectionReason}</Text> : null}
          {item.billUrl ? (
            <TouchableOpacity style={ec.billLink} onPress={() => Linking.openURL(item.billUrl)}>
              <ExternalLink size={12} color={T.accent} />
              <Text style={[ec.billLinkText, { color: T.accent }]}>View Bill</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={ec.right}>
          <Text style={[ec.amount, { color: T.text }]}>{fmtCurrency(item.amount)}</Text>
          {isManager && isTeam && item.status === 'Pending' && (
            <View style={ec.actionBtns}>
              <TouchableOpacity style={[ec.approveBtn, { backgroundColor: T.success }]} onPress={() => onApprove(item.id)}>
                <Check size={12} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[ec.rejectBtn, { backgroundColor: T.danger }]} onPress={() => onReject(item.id)}>
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
  card: { borderRadius: 18, marginBottom: 10, padding: 14, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontFamily: Fonts.bold, fontSize: rf(14), marginBottom: 4 },
  role: { fontFamily: Fonts.regular, fontSize: rf(12) },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  date: { fontFamily: Fonts.regular, fontSize: rf(12) },
  desc: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  rejection: { fontFamily: Fonts.regular, fontSize: rf(11), marginTop: 2 },
  billLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  billLinkText: { fontFamily: Fonts.medium, fontSize: rf(12) },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontFamily: Fonts.bold, fontSize: rf(16) },
  actionBtns: { flexDirection: 'row', gap: 4 },
  approveBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ─── Summary Cards ───────────────────────────────────────────────────────────

function SummaryRow({ total, approved, pending }: { total: number; approved: number; pending: number }) {
  const T = useAppTheme();
  return (
    <View style={sum.row}>
      <View style={[sum.card, { backgroundColor: T.card, borderColor: T.line }]}>
        <Text style={[sum.label, { color: T.sub }]}>Total</Text>
        <Text style={[sum.val, { color: T.text }]}>{fmtCurrency(total)}</Text>
      </View>
      <View style={[sum.card, { backgroundColor: T.card, borderColor: T.line }]}>
        <Text style={[sum.label, { color: T.success }]}>Approved</Text>
        <Text style={[sum.val, { color: T.success }]}>{fmtCurrency(approved)}</Text>
      </View>
      <View style={[sum.card, { backgroundColor: T.card, borderColor: T.line }]}>
        <Text style={[sum.label, { color: T.warning }]}>Pending</Text>
        <Text style={[sum.val, { color: T.warning }]}>{fmtCurrency(pending)}</Text>
      </View>
    </View>
  );
}

const sum = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  card: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, alignItems: 'center' },
  label: { fontFamily: Fonts.medium, fontSize: rf(11), marginBottom: 4 },
  val: { fontFamily: Fonts.bold, fontSize: rf(14) },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const AllowancesScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const isManager = role === 'ZH' || role === 'RH' || role === 'SH' || role === 'SCA';

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
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.pageTitle}>Allowances</Text>
        <Text style={s.pageSub}>{isManager ? 'Review and approve allowances for your team' : 'View your allowance history'}</Text>
      </GradientBackground>

      {/* Main Tabs */}
      <View style={s.mainTabs}>
        <TouchableOpacity
          style={[s.mainTab, { backgroundColor: mainTab === 'travel' ? T.accent : T.cardAlt, borderColor: mainTab === 'travel' ? T.accent : T.line }]}
          onPress={() => setMainTab('travel')}
        >
          <Text style={[s.mainTabText, { color: mainTab === 'travel' ? '#FFF' : T.sub }]}>Travel Allowance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.mainTab, { backgroundColor: mainTab === 'expense' ? T.accent : T.cardAlt, borderColor: mainTab === 'expense' ? T.accent : T.line }]}
          onPress={() => setMainTab('expense')}
        >
          <Text style={[s.mainTabText, { color: mainTab === 'expense' ? '#FFF' : T.sub }]}>Expense Claims</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ TRAVEL TAB ═══ */}
      {mainTab === 'travel' && (
        <View style={{ flex: 1 }}>
          <SummaryRow total={tTotal} approved={tApproved} pending={tPending} />
          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <DateInput label="From" value={dateFrom} onChange={setDateFrom} accentColor={T.accent} />
            <DateInput label="To" value={dateTo} onChange={setDateTo} accentColor={T.accent} />
            <SelectPicker
              placeholder="Status"
              options={tStatusOptions}
              value={tStatusFilter}
              onChange={v => setTStatusFilter(String(v))}
              accentColor={T.accent}
              containerStyle={{ width: 120, marginBottom: 0 }}
            />
            {isManager && teamMemberOptions.length > 1 && (
              <SelectPicker
                placeholder="Member"
                options={teamMemberOptions}
                value={tUserFilter}
                onChange={v => setTUserFilter(String(v))}
                accentColor={T.accent}
                containerStyle={{ width: 140, marginBottom: 0 }}
              />
            )}
          </ScrollView>

          {/* Bulk approve row */}
          {isManager && tPendingItems.length > 0 && (
            <View style={[s.bulkRow, { backgroundColor: T.card, borderBottomColor: T.line }]}>
              <Text style={[s.bulkCount, { color: T.sub }]}>{tSelected.size > 0 ? `${tSelected.size} selected` : `${tPendingItems.length} pending`}</Text>
              <TouchableOpacity
                style={[s.bulkBtn, { backgroundColor: T.success }, (tSelected.size === 0 || bulkApproving) && s.bulkBtnDisabled]}
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
            <LoadingSpinner fullScreen color={T.accent} message="Loading allowances..." />
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
                  onApprove={isManager ? handleTravelApprove : undefined}
                  onReject={isManager ? (id: number) => setRejectTravelId(id) : undefined}
                />
              )}
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.empty}>
                  <DollarSign size={40} color={T.dim} />
                  <Text style={[s.emptyText, { color: T.sub }]}>No travel allowances for selected period</Text>
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
              <TouchableOpacity
                style={[s.subTab, { backgroundColor: expSubTab === 'my' ? T.accent : T.cardAlt, borderColor: expSubTab === 'my' ? T.accent : T.line }]}
                onPress={() => setExpSubTab('my')}
              >
                <Text style={[s.subTabText, { color: expSubTab === 'my' ? '#FFF' : T.sub }]}>My Claims</Text>
              </TouchableOpacity>
              {isManager && (
                <TouchableOpacity
                  style={[s.subTab, { backgroundColor: expSubTab === 'team' ? T.accent : T.cardAlt, borderColor: expSubTab === 'team' ? T.accent : T.line }]}
                  onPress={() => setExpSubTab('team')}
                >
                  <Text style={[s.subTabText, { color: expSubTab === 'team' ? '#FFF' : T.sub }]}>Team Claims</Text>
                </TouchableOpacity>
              )}
            </View>
            {expSubTab === 'my' && (
              <TouchableOpacity style={[s.addBtn, { backgroundColor: T.accent }]} onPress={() => setShowExpForm(true)}>
                <Plus size={14} color="#FFF" />
                <Text style={s.addBtnText}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <DateInput label="From" value={expDateFrom} onChange={setExpDateFrom} accentColor={T.accent} />
            <DateInput label="To" value={expDateTo} onChange={setExpDateTo} accentColor={T.accent} />
            <SelectPicker
              placeholder="Status"
              options={eStatusOptions}
              value={eStatusFilter}
              onChange={v => setEStatusFilter(String(v))}
              accentColor={T.accent}
              containerStyle={{ width: 130, marginBottom: 0 }}
            />
          </ScrollView>

          {eLoading ? (
            <LoadingSpinner fullScreen color={T.accent} message="Loading expenses..." />
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
                  <Text style={[s.emptyText, { color: T.sub }]}>No expense claims found</Text>
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
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  pageTitle: { fontFamily: Fonts.bold, fontSize: rf(22), color: '#FFF', letterSpacing: -0.4 },
  pageSub: { fontFamily: Fonts.regular, fontSize: rf(12.5), color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  mainTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  mainTab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  mainTabText: { fontFamily: Fonts.bold, fontSize: rf(13) },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 10, alignItems: 'flex-end' },
  expSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  expSubTabs: { flexDirection: 'row', gap: 6 },
  subTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  subTabText: { fontFamily: Fonts.bold, fontSize: rf(12) },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontFamily: Fonts.bold, fontSize: rf(12), color: '#FFF' },
  list: { padding: 12, paddingBottom: 32 },
  bulkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  bulkCount: { fontFamily: Fonts.medium, fontSize: rf(12) },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnText: { fontFamily: Fonts.bold, fontSize: rf(12), color: '#FFF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: Fonts.regular, fontSize: rf(14), textAlign: 'center' },
});
