import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingApi } from '../../api/onboarding';
import { OnboardAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const STATUS_OPTIONS = ['Assigned', 'InProgress', 'Completed', 'OnHold', 'Cancelled'];
const STATUS_COLORS: Record<string, string> = {
  Assigned: '#F59E0B', InProgress: '#2563EB', Completed: '#16A34A',
  OnHold: '#9CA3AF', Cancelled: '#DC2626',
};

export const OnboardDetailScreen = ({ navigation, route }: any) => {
  const { onboardId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [item, setItem] = useState<OnboardAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressInput, setProgressInput] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
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

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;
  if (!item) return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Onboarding" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <EmptyState title="Not found" icon="📋" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={item.schoolName} subtitle="Onboarding Details" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Progress Circle */}
        <View style={styles.progressCard}>
          <View style={[styles.progressCircle, { borderColor: COLOR.primary }]}>
            <Text style={[styles.progressPct, { color: COLOR.primary }]}>{item.completionPercentage}%</Text>
            <Text style={styles.progressLabel}>Complete</Text>
          </View>
          <View style={styles.progressInfo}>
            <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
            <Text style={styles.assignedTo}>👤 {item.assignedToName}</Text>
            {item.scheduledEndDate && (
              <Text style={styles.deadline}>Due {formatDate(item.scheduledEndDate)}</Text>
            )}
          </View>
        </View>

        <ProgressBar value={item.completionPercentage} color={COLOR.primary} style={{ marginHorizontal: 0 }} />

        {/* Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {[
            { label: 'Lead ID', value: String(item.leadId) },
            { label: 'Deal ID', value: item.dealId ? String(item.dealId) : '—' },
            { label: 'Start Date', value: item.scheduledStartDate ? formatDate(item.scheduledStartDate) : '—' },
            { label: 'End Date', value: item.scheduledEndDate ? formatDate(item.scheduledEndDate) : '—' },
          ].map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* Modules */}
        {item.modules && item.modules.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Modules</Text>
            <View style={styles.moduleRow}>
              {item.modules.map((m, i) => (
                <View key={i} style={[styles.moduleChip, { backgroundColor: COLOR.light }]}>
                  <Text style={[styles.moduleText, { color: COLOR.primary }]}>{m}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Update Progress */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Update Progress</Text>
          <View style={styles.progressInputRow}>
            <TextInput
              style={styles.progressInput}
              value={progressInput}
              onChangeText={setProgressInput}
              keyboardType="numeric"
              placeholder="0–100"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.pctSymbol}>%</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={progressNotes}
            onChangeText={setProgressNotes}
            placeholder="Update notes (optional)..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
          />
          <Button title={updating ? 'Updating...' : 'Update Progress'} onPress={handleUpdateProgress} variant="primary" disabled={updating} style={{ marginTop: 8 }} />
        </Card>

        {/* Update Status */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, selectedStatus === s && { backgroundColor: COLOR.primary }]}
                onPress={() => setSelectedStatus(s)}
              >
                <Text style={[styles.chipText, selectedStatus === s && { color: '#FFF' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title={updating ? 'Updating...' : 'Update Status'} onPress={handleUpdateStatus} variant="secondary" disabled={updating} style={{ marginTop: 8 }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  progressCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  progressPct: { fontSize: rf(20), fontWeight: '700' },
  progressLabel: { fontSize: rf(11), color: '#9CA3AF' },
  progressInfo: { flex: 1, gap: 6 },
  assignedTo: { fontSize: rf(13), color: '#6B7280' },
  deadline: { fontSize: rf(12), color: '#9CA3AF' },
  section: {},
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), color: '#111827', fontWeight: '500' },
  moduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  moduleText: { fontSize: rf(13), fontWeight: '500' },
  progressInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressInput: {
    width: 80, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(16), color: '#111827',
    textAlign: 'center',
  },
  pctSymbol: { fontSize: rf(18), color: '#6B7280', fontWeight: '700' },
  notesInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827',
    height: 60, textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
});
