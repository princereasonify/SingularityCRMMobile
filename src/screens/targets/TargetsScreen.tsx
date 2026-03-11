import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  Alert, Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, ChevronRight } from 'lucide-react-native';
import { targetsApi } from '../../api/targets';
import { TargetAssignmentDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, getTargetStatusColor, getProgressColor } from '../../utils/constants';
import { formatCurrency, formatDate, getDaysRemaining } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const PERIOD_LABELS: Record<string, string> = { Monthly: 'M', Quarterly: 'Q', Annually: 'A' };
const PERIOD_COLORS: Record<string, string> = { Monthly: '#06B6D4', Quarterly: '#6366F1', Annually: '#EC4899' };

export const TargetsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [tab, setTab] = useState<'my' | 'assigned'>('my');
  const [myTargets, setMyTargets] = useState<TargetAssignmentDto[]>([]);
  const [assignedTargets, setAssignedTargets] = useState<TargetAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [createLoading, setCreateLoading] = useState(false);

  const [form, setForm] = useState({
    assignedToId: '' as any,
    title: '', description: '',
    targetAmount: '', numberOfSchools: '',
    numberOfLogins: '', numberOfStudents: '',
    periodType: 'Quarterly' as any,
    startDate: '', endDate: '',
  });

  const fetch = useCallback(async () => {
    try {
      const [myRes, assignedRes] = await Promise.all([
        targetsApi.getMyTargets(),
        role !== 'FO' ? targetsApi.getAssignedTargets() : Promise.resolve({ data: [] }),
      ]);
      setMyTargets(myRes.data);
      setAssignedTargets(assignedRes.data);
    } catch {
      setMyTargets([]);
      setAssignedTargets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    if (role !== 'FO') {
      targetsApi.getAssignableUsers().then((r) => setUsers(r.data)).catch(() => {});
    }
  }, [role]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleCreate = async () => {
    if (!form.assignedToId || !form.title || !form.targetAmount || !form.numberOfSchools) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }
    setCreateLoading(true);
    try {
      await targetsApi.createTarget({
        assignedToId: Number(form.assignedToId),
        title: form.title,
        description: form.description || undefined,
        targetAmount: parseFloat(form.targetAmount),
        numberOfSchools: parseInt(form.numberOfSchools, 10),
        numberOfLogins: form.numberOfLogins ? parseInt(form.numberOfLogins, 10) : undefined,
        numberOfStudents: form.numberOfStudents ? parseInt(form.numberOfStudents, 10) : undefined,
        periodType: form.periodType,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setShowCreate(false);
      fetch();
      Alert.alert('Success', 'Target assigned successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create target');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSubmit = async (id: number) => {
    try {
      await targetsApi.submitTarget(id);
      fetch();
      Alert.alert('Success', 'Target submitted for review!');
    } catch { Alert.alert('Error', 'Failed to submit target'); }
  };

  const handleReview = (id: number, approved: boolean) => {
    Alert.prompt?.(`${approved ? 'Approve' : 'Reject'} Target`, 'Add a review note:', async (note) => {
      try {
        await targetsApi.reviewTarget(id, approved, note || undefined);
        fetch();
      } catch { Alert.alert('Error', 'Failed to review target'); }
    });
  };

  const renderTarget = (target: TargetAssignmentDto, isAssigned: boolean) => {
    const revPct = target.targetAmount > 0 ? (target.achievedAmount / target.targetAmount) * 100 : 0;
    const schoolPct = target.numberOfSchools > 0 ? (target.achievedSchools / target.numberOfSchools) * 100 : 0;
    const daysLeft = getDaysRemaining(target.endDate);
    const periodColor = PERIOD_COLORS[target.periodType] || '#6B7280';
    const periodLabel = PERIOD_LABELS[target.periodType] || 'Q';

    return (
      <Card key={target.id} style={styles.targetCard}>
        <View style={styles.targetHeader}>
          <View style={styles.targetTitleRow}>
            <View style={[styles.periodBadge, { backgroundColor: periodColor }]}>
              <Text style={styles.periodBadgeText}>{periodLabel}</Text>
            </View>
            <Text style={styles.targetTitle} numberOfLines={2}>{target.title}</Text>
          </View>
          <Badge label={target.status} color={getTargetStatusColor(target.status)} />
        </View>

        {target.description && (
          <Text style={styles.targetDesc} numberOfLines={2}>{target.description}</Text>
        )}

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Revenue</Text>
            <Text style={styles.kpiVal}>{formatCurrency(target.achievedAmount)}</Text>
            <Text style={styles.kpiTotal}>/ {formatCurrency(target.targetAmount)}</Text>
            <ProgressBar value={revPct} height={4} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Schools</Text>
            <Text style={styles.kpiVal}>{target.achievedSchools}</Text>
            <Text style={styles.kpiTotal}>/ {target.numberOfSchools}</Text>
            <ProgressBar value={schoolPct} height={4} style={{ marginTop: 4 }} />
          </View>
          {target.numberOfLogins && (
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Logins</Text>
              <Text style={styles.kpiVal}>{target.achievedLogins || 0}</Text>
              <Text style={styles.kpiTotal}>/ {target.numberOfLogins}</Text>
              <ProgressBar value={((target.achievedLogins || 0) / target.numberOfLogins) * 100} height={4} style={{ marginTop: 4 }} />
            </View>
          )}
          {target.numberOfStudents && (
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Students</Text>
              <Text style={styles.kpiVal}>{(target.achievedStudents || 0).toLocaleString('en-IN')}</Text>
              <Text style={styles.kpiTotal}>/ {target.numberOfStudents.toLocaleString('en-IN')}</Text>
              <ProgressBar value={((target.achievedStudents || 0) / target.numberOfStudents) * 100} height={4} style={{ marginTop: 4 }} />
            </View>
          )}
        </View>

        {/* Date info */}
        <View style={styles.targetMeta}>
          <Text style={styles.metaText}>{formatDate(target.startDate)} → {formatDate(target.endDate)}</Text>
          <Text style={[styles.daysLeft, daysLeft < 7 && { color: '#EF4444' }]}>
            {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
          </Text>
        </View>

        {/* Assignment info */}
        {!isAssigned && target.assignedByName && (
          <Text style={styles.assignInfo}>Assigned by: {target.assignedByName}</Text>
        )}
        {isAssigned && target.assignedToName && (
          <Text style={styles.assignInfo}>Assigned to: {target.assignedToName} ({target.assignedToRole})</Text>
        )}

        {/* Review Note */}
        {target.reviewNote && (
          <View style={[styles.reviewNote, target.status === 'Rejected' && { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.reviewNoteText, target.status === 'Rejected' && { color: '#DC2626' }]}>
              📋 {target.reviewNote}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.targetActions}>
          {!isAssigned && target.status === 'InProgress' && (
            <Button title="Submit for Review" onPress={() => handleSubmit(target.id)} color={COLOR.primary} size="sm" style={{ flex: 1 }} />
          )}
          {isAssigned && target.status === 'Submitted' && (
            <>
              <Button title="Approve" onPress={() => handleReview(target.id, true)} color="#22C55E" size="sm" style={{ flex: 1 }} />
              <Button title="Reject" onPress={() => handleReview(target.id, false)} variant="danger" size="sm" style={{ flex: 1 }} />
            </>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Targets</Text>
          {role !== 'FO' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowCreate(true)}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {role !== 'FO' && (
          <View style={styles.tabRow}>
            {(['my', 'assigned'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'my' ? 'My Targets' : 'Assigned By Me'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLOR.primary]} />}
        >
          {(() => {
            const items = tab === 'my' ? myTargets : assignedTargets;
            if (items.length === 0) return <EmptyState title="No targets found" subtitle={tab === 'my' ? 'You have no active targets' : 'No targets assigned yet'} icon="🎯" />;
            return items.map((t) => renderTarget(t, tab === 'assigned'));
          })()}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Create Target Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.modalSheet, tablet && styles.modalTablet]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Target</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SelectPicker label="Assign To *" options={users.map((u) => ({ label: `${u.name} (${u.role})`, value: u.id }))} value={form.assignedToId} onChange={(v) => set('assignedToId', v)} accentColor={COLOR.primary} />
              <Input label="Title *" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Q1 Sales Target" accentColor={COLOR.primary} />
              <Input label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline numberOfLines={2} placeholder="Details..." accentColor={COLOR.primary} style={{ textAlignVertical: 'top', minHeight: 50 }} />
              <View style={styles.row}>
                <Input label="Target Amount (₹) *" value={form.targetAmount} onChangeText={(v) => set('targetAmount', v)} keyboardType="numeric" placeholder="e.g. 2500000" accentColor={COLOR.primary} containerStyle={styles.half} />
                <Input label="Schools Target *" value={form.numberOfSchools} onChangeText={(v) => set('numberOfSchools', v)} keyboardType="numeric" placeholder="e.g. 50" accentColor={COLOR.primary} containerStyle={styles.half} />
              </View>
              <View style={styles.row}>
                <Input label="Logins Target" value={form.numberOfLogins} onChangeText={(v) => set('numberOfLogins', v)} keyboardType="numeric" placeholder="Optional" accentColor={COLOR.primary} containerStyle={styles.half} />
                <Input label="Students Target" value={form.numberOfStudents} onChangeText={(v) => set('numberOfStudents', v)} keyboardType="numeric" placeholder="Optional" accentColor={COLOR.primary} containerStyle={styles.half} />
              </View>
              <SelectPicker label="Period Type" options={[{ label: 'Monthly', value: 'Monthly' }, { label: 'Quarterly', value: 'Quarterly' }, { label: 'Annually', value: 'Annually' }]} value={form.periodType} onChange={(v) => set('periodType', v)} accentColor={COLOR.primary} />
              <View style={styles.row}>
                <Input label="Start Date *" value={form.startDate} onChangeText={(v) => set('startDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} containerStyle={styles.half} />
                <Input label="End Date *" value={form.endDate} onChangeText={(v) => set('endDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} containerStyle={styles.half} />
              </View>
              <Button title="Assign Target" onPress={handleCreate} loading={createLoading} color={COLOR.primary} size="lg" style={{ marginTop: 8, marginBottom: 32 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { fontSize: rf(13), color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  tabTextActive: { color: '#374151' },
  scroll: { flex: 1 },
  list: { padding: 16, gap: 12 },
  targetCard: { padding: 16 },
  targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  targetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginRight: 8 },
  periodBadge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  periodBadgeText: { fontSize: rf(10), fontWeight: '800', color: '#FFF' },
  targetTitle: { flex: 1, fontSize: rf(15), fontWeight: '700', color: '#111827' },
  targetDesc: { fontSize: rf(13), color: '#6B7280', marginBottom: 12, lineHeight: 19 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  kpiItem: { flex: 1, minWidth: 100 },
  kpiLabel: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  kpiVal: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  kpiTotal: { fontSize: rf(11), color: '#9CA3AF' },
  targetMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metaText: { fontSize: rf(12), color: '#6B7280' },
  daysLeft: { fontSize: rf(12), fontWeight: '600', color: '#9CA3AF' },
  assignInfo: { fontSize: rf(12), color: '#6B7280', marginBottom: 8 },
  reviewNote: {
    backgroundColor: '#F0FDF4', padding: 10, borderRadius: 8, marginBottom: 10,
  },
  reviewNoteText: { fontSize: rf(13), color: '#16A34A' },
  targetActions: { flexDirection: 'row', gap: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%',
  },
  modalTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 24, marginBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
