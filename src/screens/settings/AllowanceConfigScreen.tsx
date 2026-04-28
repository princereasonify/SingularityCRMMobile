import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Edit2, Trash2, IndianRupee, ArrowLeft } from 'lucide-react-native';
import { allowanceConfigApi } from '../../api/allowanceConfig';
import { dashboardApi } from '../../api/dashboard';
import { useAuth } from '../../context/AuthContext';
import { SelectPicker } from '../../components/common/SelectPicker';
import { DateInput } from '../../components/common/DateInput';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const ROLES = ['FO', 'ZH', 'RH', 'SH', 'SCA'];
// Backend AllowanceScope.Role uses int — keep in sync with UserRole enum
const ROLE_TO_INT: Record<string, number> = { FO: 0, ZH: 1, RH: 2, SH: 3, SCA: 4 };

const SCOPES = ['Role', 'User', 'Zone', 'Region', 'Global'] as const;

const VEHICLE_OPTIONS = [
  { value: '', label: 'All Vehicles' },
  { value: 'TwoWheeler', label: 'Two Wheeler (Activa/Bike)' },
  { value: 'FourWheeler', label: 'Four Wheeler (Car)' },
  { value: 'PublicTransport', label: 'Public Transport' },
  { value: 'Other', label: 'Other' },
];

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  Global: { bg: '#EDE9FE', text: '#7C3AED' },
  Region: { bg: '#DBEAFE', text: '#2563EB' },
  Zone:   { bg: '#CCFBF1', text: '#0D9488' },
  User:   { bg: '#FEF3C7', text: '#D97706' },
  Role:   { bg: '#D1FAE5', text: '#059669' },
};

function fmtCurrency(v: number) { return `₹${Number(v || 0).toFixed(2)}`; }
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const blankForm = {
  scope: 'Role' as typeof SCOPES[number],
  scopeId: '',
  targetRole: '',
  vehicleType: '',
  ratePerKm: '10',
  maxDailyAllowance: '',
  minDistanceKm: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

export const AllowanceConfigScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'SH') as keyof typeof ROLE_COLORS];

  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editConfigId, setEditConfigId] = useState<number | null>(null);

  const [form, setForm] = useState(blankForm);

  // For User scope: list of reportable users filtered by targetRole
  const [reportableUsers, setReportableUsers] = useState<any[]>([]);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await allowanceConfigApi.getAll();
      const d = res.data as any;
      setConfigs(Array.isArray(d) ? d : (d?.configs ?? []));
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  useEffect(() => {
    dashboardApi.getReportableUsers()
      .then(res => setReportableUsers(res.data || []))
      .catch(() => setReportableUsers([]));
  }, []);

  const usersForRole = useMemo(() => {
    if (form.scope !== 'User') return [];
    if (!form.targetRole) return reportableUsers;
    return reportableUsers.filter((u: any) => u.role === form.targetRole);
  }, [form.scope, form.targetRole, reportableUsers]);

  const setField = (key: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'scope') { next.scopeId = ''; next.targetRole = ''; }
      if (key === 'targetRole') { next.scopeId = ''; }
      return next;
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditConfigId(null);
    setForm(blankForm);
  };

  const startFullEdit = (c: any) => {
    setEditConfigId(c.id);
    setForm({
      scope: c.scope,
      scopeId: c.scopeId != null ? String(c.scopeId) : '',
      targetRole: c.targetRole || '',
      vehicleType: c.vehicleType || '',
      ratePerKm: String(c.ratePerKm),
      maxDailyAllowance: c.maxDailyAllowance != null ? String(c.maxDailyAllowance) : '',
      minDistanceKm: c.minDistanceKm != null ? String(c.minDistanceKm) : '',
      effectiveFrom: c.effectiveFrom ? new Date(c.effectiveFrom).toISOString().split('T')[0] : '',
      effectiveTo: c.effectiveTo ? new Date(c.effectiveTo).toISOString().split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.ratePerKm.trim() || isNaN(parseFloat(form.ratePerKm))) {
      Alert.alert('Error', 'Rate per km is required'); return;
    }

    setSubmitting(true);
    try {
      if (editConfigId != null) {
        // Edit mode: only update rate/limits/vehicle/dates
        await allowanceConfigApi.update(editConfigId, {
          ratePerKm: parseFloat(form.ratePerKm),
          maxDailyAllowance: form.maxDailyAllowance ? parseFloat(form.maxDailyAllowance) : undefined,
          minDistanceKm: form.minDistanceKm ? parseFloat(form.minDistanceKm) : undefined,
          vehicleType: form.vehicleType || undefined,
          effectiveFrom: form.effectiveFrom || undefined,
          effectiveTo: form.effectiveTo || undefined,
        });
      } else {
        // Create mode: validate scope identity
        if (form.scope === 'User' && !form.scopeId) { Alert.alert('Error', 'Select a user'); setSubmitting(false); return; }
        if (form.scope === 'Role' && !form.targetRole) { Alert.alert('Error', 'Select a role'); setSubmitting(false); return; }
        if ((form.scope === 'Region' || form.scope === 'Zone') && !form.scopeId) {
          Alert.alert('Error', `${form.scope} ID is required`); setSubmitting(false); return;
        }
        const resolvedScopeId = form.scope === 'Role'
          ? ROLE_TO_INT[form.targetRole]
          : (form.scopeId ? parseInt(form.scopeId) : undefined);

        await allowanceConfigApi.create({
          scope: form.scope,
          scopeId: resolvedScopeId,
          targetRole: (form.scope === 'User' || form.scope === 'Role') ? (form.targetRole || undefined) : undefined,
          vehicleType: form.vehicleType || undefined,
          ratePerKm: parseFloat(form.ratePerKm),
          maxDailyAllowance: form.maxDailyAllowance ? parseFloat(form.maxDailyAllowance) : undefined,
          minDistanceKm: form.minDistanceKm ? parseFloat(form.minDistanceKm) : undefined,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
        } as any);
      }
      closeForm();
      fetchConfigs();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save config');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Config', 'Delete this allowance config?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await allowanceConfigApi.delete(id);
            fetchConfigs();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  const renderConfig = ({ item: c }: { item: any }) => {
    const sc = SCOPE_COLORS[c.scope] || SCOPE_COLORS.Global;
    const vehicleLabel = VEHICLE_OPTIONS.find(v => v.value === c.vehicleType)?.label;
    return (
      <View style={s.configCard}>
        {/* Top row: scope badge + target + actions */}
        <View style={s.configTop}>
          <View style={s.configLeft}>
            <View style={[s.scopeBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.scopeText, { color: sc.text }]}>{c.scope}</Text>
            </View>
            {(c.scopeName || c.scopeId != null) && (
              <Text style={s.scopeTarget}>{c.scopeName || `#${c.scopeId}`}</Text>
            )}
            {c.targetRole ? (
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>{c.targetRole}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.configActions}>
            <TouchableOpacity style={s.editBtn} onPress={() => startFullEdit(c)}>
              <Edit2 size={14} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(c.id)}>
              <Trash2 size={14} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Vehicle + Rate row */}
        <View style={s.metricsRow}>
          <View style={s.metricChip}>
            <IndianRupee size={13} color={COLOR.primary} />
            <Text style={[s.metricVal, { color: COLOR.primary }]}>{fmtCurrency(c.ratePerKm)}/km</Text>
          </View>
          {vehicleLabel && vehicleLabel !== 'All Vehicles' ? (
            <View style={[s.metricChip, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[s.metricVal, { color: '#2563EB' }]}>{vehicleLabel}</Text>
            </View>
          ) : (
            <View style={[s.metricChip, { backgroundColor: '#F9FAFB' }]}>
              <Text style={[s.metricVal, { color: '#9CA3AF' }]}>All Vehicles</Text>
            </View>
          )}
          {c.maxDailyAllowance != null && (
            <View style={[s.metricChip, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[s.metricVal, { color: '#D97706' }]}>Max {fmtCurrency(c.maxDailyAllowance)}/day</Text>
            </View>
          )}
          {c.minDistanceKm != null && (
            <View style={[s.metricChip, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[s.metricVal, { color: '#16A34A' }]}>Min {c.minDistanceKm} km</Text>
            </View>
          )}
        </View>

        {/* Dates + set by */}
        <View style={s.configFooter}>
          <Text style={s.dateText}>
            {fmtDate(c.effectiveFrom)} → {c.effectiveTo ? fmtDate(c.effectiveTo) : 'Ongoing'}
          </Text>
          {c.setByName ? <Text style={s.setBy}>Set by {c.setByName}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
          <View>
            <Text style={s.pageTitle}>Allowance Config</Text>
            <Text style={s.pageSub}>Set per-km rates per role or user. Default: ₹10/km.</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: COLOR.primary }]}
          onPress={() => { setEditConfigId(null); setForm(blankForm); setShowForm(true); }}
        >
          <Plus size={18} color="#FFF" />
          <Text style={s.addBtnText}>Add Config</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading config..." />
      ) : (
        <FlatList
          data={configs}
          keyExtractor={item => String(item.id)}
          renderItem={renderConfig}
          contentContainerStyle={[s.list, configs.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState title="No configs set" subtitle="Add an allowance configuration for your team" icon="⚙️" />
          }
        />
      )}

      {/* Create / Edit Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editConfigId != null ? 'Edit Config' : 'New Allowance Config'}</Text>
              <TouchableOpacity onPress={closeForm} hitSlop={8}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editConfigId != null && (
                <View style={s.editNotice}>
                  <Text style={s.editNoticeText}>
                    Editing config #{editConfigId}. Scope and target are locked — to change them, delete and add a new one.
                  </Text>
                </View>
              )}

              {/* Scope */}
              <SelectPicker
                label="Scope *"
                placeholder="Select scope"
                options={SCOPES.map(s => ({ value: s, label: s }))}
                value={form.scope}
                onChange={v => setField('scope', String(v))}
                accentColor={COLOR.primary}
              />

              {/* Role picker — when scope = Role or User */}
              {(form.scope === 'Role' || form.scope === 'User') && (
                <SelectPicker
                  label="Role *"
                  placeholder="Select role"
                  options={ROLES.map(r => ({ value: r, label: r }))}
                  value={form.targetRole}
                  onChange={v => setField('targetRole', String(v))}
                  accentColor={COLOR.primary}
                />
              )}

              {/* User picker — when scope = User (needs targetRole first) */}
              {form.scope === 'User' && (
                <SelectPicker
                  label="User *"
                  placeholder={form.targetRole ? `Select ${form.targetRole}` : 'Pick role first'}
                  options={usersForRole.map((u: any) => ({
                    value: u.id,
                    label: `${u.name}${u.zone ? ` — ${u.zone}` : u.region ? ` — ${u.region}` : ''}`,
                  }))}
                  value={form.scopeId ? Number(form.scopeId) : undefined}
                  onChange={v => setField('scopeId', String(v))}
                  accentColor={COLOR.primary}
                />
              )}

              {/* Zone / Region ID */}
              {(form.scope === 'Zone' || form.scope === 'Region') && (
                <Field
                  label={`${form.scope} ID *`}
                  value={form.scopeId}
                  onChange={v => setField('scopeId', v)}
                  placeholder="Enter numeric ID"
                  keyboardType="numeric"
                />
              )}

              {/* Vehicle Type */}
              <SelectPicker
                label="Vehicle Type"
                placeholder="All Vehicles"
                options={VEHICLE_OPTIONS}
                value={form.vehicleType}
                onChange={v => setField('vehicleType', String(v))}
                accentColor={COLOR.primary}
              />

              {/* Rate / Max Daily / Min Distance */}
              <Field label="Rate per km (₹) *" value={form.ratePerKm} onChange={v => setField('ratePerKm', v)} placeholder="e.g. 8.5" keyboardType="decimal-pad" />
              <Field label="Max Daily Allowance (₹)" value={form.maxDailyAllowance} onChange={v => setField('maxDailyAllowance', v)} placeholder="No limit" keyboardType="decimal-pad" />
              <Field label="Min Distance (km)" value={form.minDistanceKm} onChange={v => setField('minDistanceKm', v)} placeholder="0" keyboardType="decimal-pad" />

              {/* Dates */}
              <DateInput label="Effective From *" value={form.effectiveFrom} onChange={v => setField('effectiveFrom', v)} accentColor={COLOR.primary} />
              <DateInput label="Effective To (blank = ongoing)" value={form.effectiveTo} onChange={v => setField('effectiveTo', v)} accentColor={COLOR.primary} />

              {/* Submit */}
              <View style={s.formBtns}>
                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: COLOR.primary }, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={s.submitBtnText}>{editConfigId != null ? 'Update' : 'Save Config'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={closeForm}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Small reusable field ──
const Field = ({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
}) => (
  <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

// ── Styles ──
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  pageTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2, maxWidth: 220 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
  list: { padding: 14, gap: 10 },

  configCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  configTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  configLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 },
  scopeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  scopeText: { fontSize: rf(12), fontWeight: '700' },
  scopeTarget: { fontSize: rf(12), color: '#374151', fontWeight: '500' },
  roleBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  roleBadgeText: { fontSize: rf(11), fontWeight: '700', color: '#7C3AED' },
  configActions: { flexDirection: 'row', gap: 4 },
  editBtn: { padding: 7, backgroundColor: '#DBEAFE', borderRadius: 8 },
  deleteBtn: { padding: 7, backgroundColor: '#FEE2E2', borderRadius: 8 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  metricVal: { fontSize: rf(12), fontWeight: '700' },
  configFooter: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, gap: 2 },
  dateText: { fontSize: rf(12), color: '#6B7280' },
  setBy: { fontSize: rf(11), color: '#9CA3AF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  editNotice: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, marginBottom: 14 },
  editNoticeText: { fontSize: rf(12), color: '#1D4ED8', lineHeight: 18 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA' },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  submitBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelBtnText: { color: '#374151', fontSize: rf(15), fontWeight: '600' },
});
