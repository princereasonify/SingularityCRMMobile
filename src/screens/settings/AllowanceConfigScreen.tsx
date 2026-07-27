import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react-native';
import { allowanceConfigApi } from '../../api/allowanceConfig';
import { dashboardApi } from '../../api/dashboard';
import { DateInput } from '../../components/common/DateInput';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { Btn, Field, Trigger, Dropdown, FormModal, ConfirmModal, StatusBadge } from '../../components/crud';
import { NumField } from '../../components/common/NumField';
import { Card } from '../../components/common/Card';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { ICON_STROKE } from '../../components/common/Icon';
import { rf } from '../../utils/responsive';

const ROLES = ['FO', 'ZH', 'RH', 'SH', 'SCA'];
const SCOPES = ['Global', 'User'] as const;

const VEHICLE_OPTIONS = [
  { value: '', label: 'All Vehicles' },
  { value: 'TwoWheeler', label: 'Two Wheeler (Activa/Bike)' },
  { value: 'FourWheeler', label: 'Four Wheeler (Car)' },
  { value: 'PublicTransport', label: 'Public Transport' },
  { value: 'Other', label: 'Other' },
];

function fmtCurrency(v: number) { return `₹${Number(v || 0).toFixed(2)}`; }
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const blankForm = {
  scope: 'Global' as typeof SCOPES[number],
  scopeId: '',
  targetRole: '',
  vehicleType: '',
  ratePerKm: '10',
  maxDailyAllowance: '',
  minDistanceKm: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

type Dd = 'scope' | 'role' | 'user' | 'vehicle' | null;

export const AllowanceConfigScreen = ({ route }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();

  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editConfigId, setEditConfigId] = useState<number | null>(null);
  const [openDd, setOpenDd] = useState<Dd>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: number }>({ visible: false, id: -1 });

  const [form, setForm] = useState(blankForm);
  const [reportableUsers, setReportableUsers] = useState<any[]>([]);

  const scopeTone = (scope?: string) =>
    scope === 'User' ? T.warning : scope === 'Zone' ? T.success : scope === 'Region' ? T.info : T.accent;

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

  const openCreate = () => { setEditConfigId(null); setForm(blankForm); setOpenDd(null); setShowForm(true); };

  const closeForm = () => { setShowForm(false); setEditConfigId(null); setForm(blankForm); setOpenDd(null); };

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
    setOpenDd(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.ratePerKm.trim() || isNaN(parseFloat(form.ratePerKm))) { Alert.alert('Error', 'Rate per km is required'); return; }
    setSubmitting(true);
    try {
      if (editConfigId != null) {
        await allowanceConfigApi.update(editConfigId, {
          ratePerKm: parseFloat(form.ratePerKm),
          maxDailyAllowance: form.maxDailyAllowance ? parseFloat(form.maxDailyAllowance) : undefined,
          minDistanceKm: form.minDistanceKm ? parseFloat(form.minDistanceKm) : undefined,
          vehicleType: form.vehicleType || undefined,
          effectiveFrom: form.effectiveFrom || undefined,
          effectiveTo: form.effectiveTo || undefined,
        });
      } else {
        if (form.scope === 'User' && !form.scopeId) { Alert.alert('Error', 'Select a user'); setSubmitting(false); return; }
        const resolvedScopeId = form.scope === 'User' && form.scopeId ? parseInt(form.scopeId) : undefined;
        await allowanceConfigApi.create({
          scope: form.scope,
          scopeId: resolvedScopeId,
          targetRole: form.scope === 'User' ? (form.targetRole || undefined) : undefined,
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

  const handleDelete = async (id: number) => {
    try {
      await allowanceConfigApi.delete(id);
      fetchConfigs();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Delete failed');
    }
  };

  const renderConfig = ({ item: c }: { item: any }) => {
    const st = scopeTone(c.scope);
    const vehicleLabel = VEHICLE_OPTIONS.find(v => v.value === c.vehicleType)?.label;
    return (
      <Card style={s.configCard}>
        <View style={s.configTop}>
          <View style={s.configLeft}>
            <StatusBadge label={c.scope} color={st} />
            {(c.scopeName || c.scopeId != null) && (
              <Text numberOfLines={1} style={[s.scopeTarget, { color: T.sub }]}>{c.scopeName || `#${c.scopeId}`}</Text>
            )}
            {c.targetRole ? <StatusBadge label={c.targetRole} color={T.info} /> : null}
          </View>
          <View style={s.configActions}>
            <TouchableOpacity style={s.actionBtn} hitSlop={8} onPress={() => startFullEdit(c)}>
              <Edit2 size={16} color={T.accent} strokeWidth={ICON_STROKE} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} hitSlop={8} onPress={() => setDeleteConfirm({ visible: true, id: c.id })}>
              <Trash2 size={16} color={T.danger} strokeWidth={ICON_STROKE} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.metricsRow}>
          <View style={[s.metricChip, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
            <Text style={[s.metricVal, { color: T.accent }]}>{fmtCurrency(c.ratePerKm)}/km</Text>
          </View>
          <View style={[s.metricChip, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
            <Text style={[s.metricVal, { color: T.info }]}>{vehicleLabel && vehicleLabel !== 'All Vehicles' ? vehicleLabel : 'All Vehicles'}</Text>
          </View>
          {c.maxDailyAllowance != null && (
            <View style={[s.metricChip, { backgroundColor: withAlpha(T.warning, SOFT_TINT) }]}>
              <Text style={[s.metricVal, { color: T.warning }]}>Max {fmtCurrency(c.maxDailyAllowance)}/day</Text>
            </View>
          )}
          {c.minDistanceKm != null && (
            <View style={[s.metricChip, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
              <Text style={[s.metricVal, { color: T.success }]}>Min {c.minDistanceKm} km</Text>
            </View>
          )}
        </View>

        <View style={[s.configFooter, { borderTopColor: T.line }]}>
          <Text style={[s.dateText, { color: T.sub }]}>
            {fmtDate(c.effectiveFrom)} → {c.effectiveTo ? fmtDate(c.effectiveTo) : 'Ongoing'}
          </Text>
          {c.setByName ? <Text style={[s.setBy, { color: T.dim }]}>Set by {c.setByName}</Text> : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      {/* Stack-pushed from Settings → no AppTopbar; pad for the island. Drawer path (SH/SCA
          sidebar) has no `pushed` param and already gets the inset from AppTopbar. */}
      {route?.params?.pushed && <View style={{ height: insets.top }} />}
      <View style={[s.toolbar, { borderBottomColor: T.line }]}>
        <View style={s.flexMin}>
          <Text style={[s.toolbarTitle, { color: T.text }]}>Allowance Config</Text>
          <Text numberOfLines={1} style={[s.toolbarSub, { color: T.dim }]}>Per-km rates by role or user · default ₹10/km</Text>
        </View>
        <Btn label="Add" onPress={openCreate} small icon={<Plus size={14} color={T.onAccent} strokeWidth={ICON_STROKE} />} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading config..." />
      ) : (
        <FlatList
          data={configs}
          keyExtractor={item => String(item.id)}
          renderItem={renderConfig}
          contentContainerStyle={[s.list, configs.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No configs set" subtitle="Add an allowance configuration for your team" icon="⚙️" />
          }
        />
      )}

      <FormModal
        visible={showForm}
        title={editConfigId != null ? 'Edit Config' : 'New Allowance Config'}
        onClose={closeForm}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={closeForm} small />
            <Btn label={editConfigId != null ? 'Update' : 'Save'} onPress={handleSubmit} loading={submitting} small />
          </>
        }
      >
        {editConfigId != null && (
          <View style={[s.notice, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
            <Text style={[s.noticeTxt, { color: T.info }]}>
              Scope and target are locked while editing — to change them, delete and add a new one.
            </Text>
          </View>
        )}

        {/* Scope */}
        <Field label="Scope *">
          <Trigger label={form.scope} open={openDd === 'scope'} onPress={() => setOpenDd(o => o === 'scope' ? null : 'scope')} />
          {openDd === 'scope' && (
            <Dropdown
              style={{ width: '100%' }}
              value={form.scope}
              onSelect={v => { setField('scope', v); setOpenDd(null); }}
              options={SCOPES.map(sc => ({ label: sc, value: sc }))}
            />
          )}
        </Field>

        {form.scope === 'User' && (
          <>
            <Field label="Role *">
              <Trigger label={form.targetRole || 'Select role'} open={openDd === 'role'} onPress={() => setOpenDd(o => o === 'role' ? null : 'role')} />
              {openDd === 'role' && (
                <Dropdown
                  style={{ width: '100%' }}
                  value={form.targetRole}
                  onSelect={v => { setField('targetRole', v); setOpenDd(null); }}
                  options={ROLES.map(r => ({ label: r, value: r }))}
                />
              )}
            </Field>
            <Field label="User *">
              <Trigger
                label={
                  form.scopeId
                    ? usersForRole.find((u: any) => String(u.id) === form.scopeId)?.name || 'Select user'
                    : form.targetRole ? `Select ${form.targetRole}` : 'Pick role first'
                }
                open={openDd === 'user'}
                onPress={() => setOpenDd(o => o === 'user' ? null : 'user')}
              />
              {openDd === 'user' && (
                <Dropdown
                  style={{ width: '100%' }}
                  maxHeight={240}
                  value={form.scopeId || undefined}
                  onSelect={v => { setField('scopeId', v); setOpenDd(null); }}
                  options={usersForRole.map((u: any) => ({
                    value: String(u.id),
                    label: `${u.name}${u.zone ? ` — ${u.zone}` : u.region ? ` — ${u.region}` : ''}`,
                  }))}
                />
              )}
            </Field>
          </>
        )}

        {/* Vehicle */}
        <Field label="Vehicle Type">
          <Trigger
            label={VEHICLE_OPTIONS.find(v => v.value === form.vehicleType)?.label || 'All Vehicles'}
            open={openDd === 'vehicle'}
            onPress={() => setOpenDd(o => o === 'vehicle' ? null : 'vehicle')}
          />
          {openDd === 'vehicle' && (
            <Dropdown
              style={{ width: '100%' }}
              value={form.vehicleType}
              onSelect={v => { setField('vehicleType', v); setOpenDd(null); }}
              options={VEHICLE_OPTIONS}
            />
          )}
        </Field>

        <Field label="Rate per km (₹) *">
          <NumField value={form.ratePerKm} onChangeText={v => setField('ratePerKm', v)} placeholder="e.g. 8.5" label="Rate per km (₹)" />
        </Field>
        <Field label="Max Daily Allowance (₹)">
          <NumField value={form.maxDailyAllowance} onChangeText={v => setField('maxDailyAllowance', v)} placeholder="No limit" label="Max Daily Allowance (₹)" />
        </Field>
        <Field label="Min Distance (km)">
          <NumField value={form.minDistanceKm} onChangeText={v => setField('minDistanceKm', v)} placeholder="0" label="Min Distance (km)" />
        </Field>

        <Field label="Effective From *">
          <DateInput value={form.effectiveFrom} onChange={v => setField('effectiveFrom', v)} accentColor={T.accent} />
        </Field>
        <Field label="Effective To (blank = ongoing)">
          <DateInput value={form.effectiveTo} onChange={v => setField('effectiveTo', v)} accentColor={T.accent} minDate={form.effectiveFrom} />
        </Field>
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Config"
        message="Delete this allowance configuration? This cannot be undone."
        icon={<AlertTriangle size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        tone="danger"
        confirmLabel="Delete"
        onConfirm={() => { handleDelete(deleteConfirm.id); setDeleteConfirm({ visible: false, id: -1 }); }}
        onCancel={() => setDeleteConfirm({ visible: false, id: -1 })}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarTitle: { fontSize: rf(14), fontWeight: '800' },
  toolbarSub: { fontSize: rf(11), marginTop: 1 },
  flexMin: { flex: 1, minWidth: 0 },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },

  configCard: { padding: 14 },
  configTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  configLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 },
  scopeTarget: { fontSize: rf(12), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  configActions: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  actionBtn: { padding: 6 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  metricVal: { fontSize: rf(12), fontWeight: '700' },
  configFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 },
  dateText: { fontSize: rf(12) },
  setBy: { fontSize: rf(11) },

  notice: { borderRadius: 12, padding: 12, marginBottom: 14 },
  noticeTxt: { fontSize: rf(12), lineHeight: 18 },
});
