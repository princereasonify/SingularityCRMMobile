import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, User as UserIcon, CalendarDays, CheckCircle2, ClipboardList,
} from 'lucide-react-native';

import { onboardingApi } from '../../api/onboarding';
import { OnboardAssignment, parseModules } from '../../types';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Trigger, Dropdown, StatusBadge, FilterChip,
} from '../../components/crud';
import { NumField } from '../../components/common/NumField';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

const DASH = '—';

const STATUS_OPTIONS = ['Assigned', 'InProgress', 'Completed', 'OnHold', 'Cancelled'];

/** Status ramp — spec tokens only, same five states the list screen paints. */
const statusColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'Assigned':   return T.warning;
    case 'InProgress': return T.info;
    case 'Completed':  return T.success;
    case 'Cancelled':  return T.danger;
    default:           return T.sub;   // OnHold
  }
};

/** Attainment ramp — three distinct spec hues, never two adjacent tiers sharing one. */
const attainColor = (T: AppTheme, p: number) => (p >= 100 ? T.success : p >= 50 ? T.info : T.warning);

export const OnboardDetailScreen = ({ navigation, route }: any) => {
  const { onboardId } = route.params;
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [item, setItem] = useState<OnboardAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressInput, setProgressInput] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    onboardingApi.getById(onboardId)
      .then(res => {
        setItem(res.data);
        setProgressInput(String(res.data.completionPercentage));
        setSelectedStatus(res.data.status);
      })
      .catch(() => Alert.alert('Error', 'Failed to load onboarding'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [onboardId]);

  const handleUpdateProgress = async () => {
    const pct = parseInt(progressInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('Validation', 'Enter a percentage between 0 and 100');
      return;
    }
    setUpdating(true);
    try {
      await onboardingApi.updateProgress(onboardId, pct, progressNotes || undefined);
      Alert.alert('Success', 'Progress updated');
      load();
    } catch { Alert.alert('Error', 'Failed to update progress'); }
    finally { setUpdating(false); }
  };

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      await onboardingApi.updateStatus(onboardId, selectedStatus);
      Alert.alert('Success', 'Status updated');
      load();
    } catch { Alert.alert('Error', 'Failed to update status'); }
    finally { setUpdating(false); }
  };

  const backBtn = (
    <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
      <ArrowLeft size={16} color={T.accent} strokeWidth={ICON_STROKE} />
    </IconBtn>
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top', 'bottom']}>
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[s.scroll, wide && s.scrollWide]}>
          <View style={s.head}>
            {backBtn}
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: T.text }]}>Onboarding</Text>
            </View>
          </View>
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <ClipboardList size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>Not found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>
              This onboarding assignment is no longer available.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // `modules` arrives as a packed JSON string, not an array — see parseModules().
  const modules = parseModules(item.modules);
  const p = item.completionPercentage;
  const ring = attainColor(T, p);

  const details: { label: string; value: string }[] = [
    { label: 'Lead ID', value: String(item.leadId) },
    { label: 'Deal ID', value: item.dealId ? String(item.dealId) : DASH },
    { label: 'Start Date', value: item.scheduledStartDate ? formatDate(item.scheduledStartDate) : DASH },
    { label: 'End Date', value: item.scheduledEndDate ? formatDate(item.scheduledEndDate) : DASH },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.head}>
          {backBtn}
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]} numberOfLines={2}>{item.schoolName}</Text>
            <Text style={[s.subtitle, { color: T.sub }]}>Onboarding Details</Text>
          </View>
        </View>

        {/* Progress ring + status summary */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.summaryRow}>
            <View style={[s.ring, { borderColor: ring }]}>
              <Text style={[s.ringPct, { color: ring }]}>{p}%</Text>
              <Text style={[s.ringLabel, { color: T.dim }]}>Complete</Text>
            </View>
            <View style={s.summaryInfo}>
              <StatusBadge label={item.status} color={statusColor(T, item.status)} />
              <View style={s.metaRow}>
                <UserIcon size={13} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[s.metaTxt, { color: T.sub }]} numberOfLines={1}>
                  {item.assignedToName || DASH}
                </Text>
              </View>
              {!!item.scheduledEndDate && (
                <View style={s.metaRow}>
                  {p === 100
                    ? <CheckCircle2 size={13} color={T.success} strokeWidth={ICON_STROKE} />
                    : <CalendarDays size={13} color={T.dim} strokeWidth={ICON_STROKE} />}
                  <Text style={[s.metaTxt, { color: T.sub }]} numberOfLines={1}>
                    Due {formatDate(item.scheduledEndDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ProgressBar value={p} height={6} color={ring} trackColor={T.line} style={{ marginTop: 14 }} />
        </View>

        {/* Details */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Details</Text>
          {details.map((row, i) => (
            <View
              key={row.label}
              style={[s.infoRow, i < details.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.line }]}
            >
              <Text style={[s.infoLabel, { color: T.sub }]} numberOfLines={1}>{row.label}</Text>
              <Text style={[s.infoValue, { color: T.text }]} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Modules */}
        {modules.length > 0 && (
          <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.sectionTitle, { color: T.text }]}>Modules</Text>
            <View style={s.chipWrap}>
              {modules.map((m, i) => <FilterChip key={`${m}-${i}`} label={m} />)}
            </View>
          </View>
        )}

        {/* Update Progress */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Update Progress</Text>
          <View style={s.pctRow}>
            <NumField
              label="Completion"
              value={progressInput}
              onChangeText={setProgressInput}
              placeholder="0–100"
              style={{ width: 130 }}
            />
            <Text style={[s.pctSym, { color: T.sub }]}>%</Text>
          </View>
          <Field label="Update Notes">
            <TextInput
              value={progressNotes}
              onChangeText={setProgressNotes}
              placeholder="Update notes (optional)…"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textArea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            />
          </Field>
          <Btn
            label={updating ? 'Updating…' : 'Update Progress'}
            onPress={handleUpdateProgress}
            loading={updating}
            style={wide ? { alignSelf: 'flex-start' } : undefined}
          />
        </View>

        {/* Update Status */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Update Status</Text>
          <Field label="Status">
            <Trigger
              label={selectedStatus || 'Select status'}
              open={statusOpen}
              onPress={() => setStatusOpen(o => !o)}
            />
            {statusOpen && (
              <Dropdown
                style={{ width: wide ? 260 : '100%' }}
                value={selectedStatus}
                onSelect={v => { setSelectedStatus(v); setStatusOpen(false); }}
                options={STATUS_OPTIONS.map(o => ({ label: o, value: o }))}
              />
            )}
          </Field>
          {/* Same weight as "Update Progress" — both are parallel commits, so
              they get the same treatment rather than primary vs secondary. */}
          <Btn
            label={updating ? 'Updating…' : 'Update Status'}
            onPress={handleUpdateStatus}
            loading={updating}
            disabled={updating}
            style={wide ? { alignSelf: 'flex-start' } : undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour is applied inline from the theme) ────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700' },

  // summary
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  ringPct: { fontSize: rf(19), fontWeight: '800' },
  ringLabel: { fontSize: rf(10), fontWeight: '600' },
  summaryInfo: { flex: 1, gap: 7, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { fontSize: rf(12.5), fontWeight: '500', flexShrink: 1, minWidth: 0 },

  // details rows
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 9,
  },
  infoLabel: { fontSize: rf(12.5), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  infoValue: { fontSize: rf(12.5), fontWeight: '700', flexShrink: 1, minWidth: 0, textAlign: 'right' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // update progress
  pctRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  pctSym: { fontSize: rf(16), fontWeight: '700', marginBottom: 12 },
  // kit Input hard-codes height:46 — multiline needs its own themed TextInput
  textArea: {
    minHeight: 64, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: rf(14), fontWeight: '500', textAlignVertical: 'top',
  },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
});
