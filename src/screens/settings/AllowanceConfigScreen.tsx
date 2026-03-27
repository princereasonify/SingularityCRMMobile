import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Settings, IndianRupee, TrendingUp, ChevronRight } from 'lucide-react-native';
import { allowanceConfigApi } from '../../api/allowanceConfig';
import { AllowanceConfig, CreateAllowanceConfigRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Card } from '../../components/common/Card';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { formatDate } from '../../utils/formatting';

const SCOPES = ['Global', 'Region', 'Zone', 'User'] as const;

const SCOPE_COLORS: Record<string, string> = {
  Global: '#7C3AED', Region: '#2563EB', Zone: '#0D9488', User: '#F59E0B',
};

export const AllowanceConfigScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'SH') as keyof typeof ROLE_COLORS];

  const [configs, setConfigs] = useState<AllowanceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [scope, setScope] = useState<typeof SCOPES[number]>('Global');
  const [scopeId, setScopeId] = useState('');
  const [ratePerKm, setRatePerKm] = useState('');
  const [maxDaily, setMaxDaily] = useState('');
  const [minDistance, setMinDistance] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');

  const loadConfigs = useCallback(async () => {
    try {
      const res = await allowanceConfigApi.getAll();
      setConfigs((res.data as any) ?? []);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const resetForm = () => {
    setScope('Global');
    setScopeId('');
    setRatePerKm('');
    setMaxDaily('');
    setMinDistance('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
  };

  const handleSubmit = async () => {
    if (!ratePerKm.trim() || isNaN(parseFloat(ratePerKm))) {
      return; // require rate
    }
    setSubmitting(true);
    try {
      const payload: CreateAllowanceConfigRequest = {
        scope,
        scopeId: scopeId ? parseInt(scopeId) : undefined,
        ratePerKm: parseFloat(ratePerKm),
        maxDailyAllowance: maxDaily ? parseFloat(maxDaily) : undefined,
        minDistanceKm: minDistance ? parseFloat(minDistance) : undefined,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
      };
      await allowanceConfigApi.create(payload);
      setShowForm(false);
      resetForm();
      await loadConfigs();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const renderConfig = ({ item }: { item: AllowanceConfig }) => (
    <Card style={styles.configCard}>
      <View style={styles.configHeader}>
        <View style={[styles.scopeBadge, { backgroundColor: (SCOPE_COLORS[item.scope] || '#6B7280') + '20' }]}>
          <Text style={[styles.scopeText, { color: SCOPE_COLORS[item.scope] || '#6B7280' }]}>
            {item.scope}
          </Text>
        </View>
        {item.scopeId && (
          <Text style={styles.scopeId}>ID: {item.scopeId}</Text>
        )}
      </View>
      <View style={styles.configMetrics}>
        <View style={styles.metric}>
          <IndianRupee size={14} color={COLOR.primary} />
          <Text style={styles.metricValue}>₹{item.ratePerKm}/km</Text>
        </View>
        {item.maxDailyAllowance != null && (
          <View style={styles.metric}>
            <TrendingUp size={14} color="#F59E0B" />
            <Text style={styles.metricValue}>Max ₹{item.maxDailyAllowance}/day</Text>
          </View>
        )}
        {item.minDistanceKm != null && (
          <View style={styles.metric}>
            <ChevronRight size={14} color="#6B7280" />
            <Text style={styles.metricValue}>Min {item.minDistanceKm} km</Text>
          </View>
        )}
      </View>
      <View style={styles.configDates}>
        <Text style={styles.dateText}>
          From: {formatDate(item.effectiveFrom)}
          {item.effectiveTo ? ` → ${formatDate(item.effectiveTo)}` : ' (Ongoing)'}
        </Text>
        {item.setByName && <Text style={styles.setBy}>Set by {item.setByName}</Text>}
      </View>
    </Card>
  );

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading config..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Allowance Config"
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => setShowForm(true)}
          >
            <Plus size={18} color="#FFF" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={configs}
        keyExtractor={item => String(item.id)}
        renderItem={renderConfig}
        contentContainerStyle={[styles.list, configs.length === 0 && { flex: 1 }]}
        ListEmptyComponent={
          <EmptyState
            title="No configs set"
            subtitle="Add an allowance configuration for your team"
            icon="⚙️"
          />
        }
      />

      {/* Create Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Allowance Config</Text>
              <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Scope */}
              <FormLabel label="Scope *" />
              <View style={styles.chipRow}>
                {SCOPES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, scope === s && { backgroundColor: COLOR.primary }]}
                    onPress={() => setScope(s)}
                  >
                    <Text style={[styles.chipText, scope === s && { color: '#FFF' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {scope !== 'Global' && (
                <FormField
                  label={`${scope} ID (optional)`}
                  value={scopeId}
                  onChange={setScopeId}
                  placeholder="Enter scope ID"
                  keyboardType="numeric"
                />
              )}

              <FormField
                label="Rate per km (₹) *"
                value={ratePerKm}
                onChange={setRatePerKm}
                placeholder="e.g. 8.5"
                keyboardType="decimal-pad"
              />

              <FormField
                label="Max daily allowance (₹)"
                value={maxDaily}
                onChange={setMaxDaily}
                placeholder="Optional cap"
                keyboardType="decimal-pad"
              />

              <FormField
                label="Min distance for allowance (km)"
                value={minDistance}
                onChange={setMinDistance}
                placeholder="e.g. 2"
                keyboardType="decimal-pad"
              />

              <FormField
                label="Effective from *"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                placeholder="YYYY-MM-DD"
              />

              <FormField
                label="Effective to (blank = ongoing)"
                value={effectiveTo}
                onChange={setEffectiveTo}
                placeholder="YYYY-MM-DD"
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: COLOR.primary }, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.submitBtnText}>Save Configuration</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const FormLabel = ({ label }: { label: string }) => (
  <Text style={styles.fieldLabel}>{label}</Text>
);

const FormField = ({ label, value, onChange, placeholder, keyboardType }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, gap: 12 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  configCard: { padding: 14 },
  configHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scopeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  scopeText: { fontSize: rf(12), fontWeight: '700' },
  scopeId: { fontSize: rf(12), color: '#6B7280' },
  configMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: rf(13), color: '#374151', fontWeight: '600' },
  configDates: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, gap: 2 },
  dateText: { fontSize: rf(12), color: '#6B7280' },
  setBy: { fontSize: rf(12), color: '#9CA3AF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  submitBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
});
