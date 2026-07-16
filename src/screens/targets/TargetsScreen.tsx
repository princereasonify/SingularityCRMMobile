import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  Alert, Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { targetsApi } from '../../api/targets';
import { TargetAssignmentDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui';
import { Input } from '../../components/common/Input';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { getTargetStatusColor } from '../../utils/constants';
import { formatCurrency, formatDate, getDaysRemaining } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

const PERIOD_LABELS: Record<string, string> = { Monthly: 'M', Quarterly: 'Q', Annually: 'A' };

export const TargetsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions();
  const tablet = width >= 768;
  const twoCol = isTabletDevice && width > height;
  const cardW = (width - 32 - 12) / 2;

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
      setMyTargets(Array.isArray(myRes.data) ? myRes.data : (myRes.data as any)?.items ?? []);
      setAssignedTargets(Array.isArray(assignedRes.data) ? assignedRes.data : (assignedRes.data as any)?.items ?? []);
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
      targetsApi.getAssignableUsers().then((r) => setUsers(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
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
    const periodLabel = PERIOD_LABELS[target.periodType] || 'Q';

    return (
      <Card key={target.id} style={[styles.targetCard, twoCol && { width: cardW }]}>
        <View style={styles.targetHeader}>
          <View style={styles.targetTitleRow}>
            <View style={[styles.periodBadge, { backgroundColor: T.accent }]}>
              <Text style={styles.periodBadgeText}>{periodLabel}</Text>
            </View>
            <Text style={[styles.targetTitle, { color: T.text }]} numberOfLines={2}>{target.title}</Text>
          </View>
          <Badge label={target.status} color={getTargetStatusColor(target.status)} />
        </View>

        {target.description && (
          <Text style={[styles.targetDesc, { color: T.sub }]} numberOfLines={2}>{target.description}</Text>
        )}

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiLabel, { color: T.dim }]}>Revenue</Text>
            <Text style={[styles.kpiVal, { color: T.text }]}>{formatCurrency(target.achievedAmount)}</Text>
            <Text style={[styles.kpiTotal, { color: T.dim }]}>/ {formatCurrency(target.targetAmount)}</Text>
            <ProgressBar value={revPct} height={4} trackColor={T.cardAlt} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiLabel, { color: T.dim }]}>Schools</Text>
            <Text style={[styles.kpiVal, { color: T.text }]}>{target.achievedSchools}</Text>
            <Text style={[styles.kpiTotal, { color: T.dim }]}>/ {target.numberOfSchools}</Text>
            <ProgressBar value={schoolPct} height={4} trackColor={T.cardAlt} style={{ marginTop: 4 }} />
          </View>
          {target.numberOfLogins && (
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: T.dim }]}>Logins</Text>
              <Text style={[styles.kpiVal, { color: T.text }]}>{target.achievedLogins || 0}</Text>
              <Text style={[styles.kpiTotal, { color: T.dim }]}>/ {target.numberOfLogins}</Text>
              <ProgressBar value={((target.achievedLogins || 0) / target.numberOfLogins) * 100} height={4} trackColor={T.cardAlt} style={{ marginTop: 4 }} />
            </View>
          )}
          {target.numberOfStudents && (
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: T.dim }]}>Students</Text>
              <Text style={[styles.kpiVal, { color: T.text }]}>{(target.achievedStudents || 0).toLocaleString('en-IN')}</Text>
              <Text style={[styles.kpiTotal, { color: T.dim }]}>/ {target.numberOfStudents.toLocaleString('en-IN')}</Text>
              <ProgressBar value={((target.achievedStudents || 0) / target.numberOfStudents) * 100} height={4} trackColor={T.cardAlt} style={{ marginTop: 4 }} />
            </View>
          )}
        </View>

        {/* Date info */}
        <View style={styles.targetMeta}>
          <Text style={[styles.metaText, { color: T.sub }]}>{formatDate(target.startDate)} → {formatDate(target.endDate)}</Text>
          <Text style={[styles.daysLeft, { color: daysLeft < 7 ? T.danger : T.dim }]}>
            {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
          </Text>
        </View>

        {/* Assignment info */}
        {!isAssigned && target.assignedByName && (
          <Text style={[styles.assignInfo, { color: T.sub }]}>Assigned by: {target.assignedByName}</Text>
        )}
        {isAssigned && target.assignedToName && (
          <Text style={[styles.assignInfo, { color: T.sub }]}>Assigned to: {target.assignedToName} ({target.assignedToRole})</Text>
        )}

        {/* Review Note */}
        {target.reviewNote && (
          <View style={[styles.reviewNote, { backgroundColor: target.status === 'Rejected' ? T.danger + '15' : T.cardAlt }]}>
            <Text style={[styles.reviewNoteText, { color: target.status === 'Rejected' ? T.danger : T.sub }]}>
              📋 {target.reviewNote}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.targetActions}>
          {!isAssigned && target.status === 'InProgress' && (
            <GradientButton label="Submit for Review" onPress={() => handleSubmit(target.id)} style={styles.actionBtn} />
          )}
          {isAssigned && target.status === 'Submitted' && (
            <>
              <GradientButton label="Approve" onPress={() => handleReview(target.id, true)} style={styles.actionBtn} />
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: T.danger }]}
                onPress={() => handleReview(target.id, false)}
              >
                <Text style={[styles.outlineBtnText, { color: T.danger }]}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <DrawerMenuButton />
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
      </GradientBackground>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={T.accent} />}
        >
          {(() => {
            const items = tab === 'my' ? myTargets : assignedTargets;
            if (items.length === 0) return <EmptyState title="No targets found" subtitle={tab === 'my' ? 'You have no active targets' : 'No targets assigned yet'} icon="🎯" />;
            return (
              <View style={twoCol ? styles.grid : styles.singleCol}>
                {items.map((t) => renderTarget(t, tab === 'assigned'))}
              </View>
            );
          })()}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Create Target Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: T.card }, tablet && styles.modalTablet]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: T.line }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Assign Target</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={22} color={T.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SelectPicker label="Assign To *" options={users.map((u) => ({ label: `${u.name} (${u.role})`, value: u.id }))} value={form.assignedToId} onChange={(v) => set('assignedToId', v)} accentColor={T.accent} />
              <Input label="Title *" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Q1 Sales Target" accentColor={T.accent} />
              <Input label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline numberOfLines={2} placeholder="Details..." accentColor={T.accent} style={{ textAlignVertical: 'top', minHeight: 50 }} />
              <View style={styles.row}>
                <Input label="Target Amount (₹) *" value={form.targetAmount} onChangeText={(v) => set('targetAmount', v)} keyboardType="numeric" placeholder="e.g. 2500000" accentColor={T.accent} containerStyle={styles.half} />
                <Input label="Schools Target *" value={form.numberOfSchools} onChangeText={(v) => set('numberOfSchools', v)} keyboardType="numeric" placeholder="e.g. 50" accentColor={T.accent} containerStyle={styles.half} />
              </View>
              <View style={styles.row}>
                <Input label="Logins Target" value={form.numberOfLogins} onChangeText={(v) => set('numberOfLogins', v)} keyboardType="numeric" placeholder="Optional" accentColor={T.accent} containerStyle={styles.half} />
                <Input label="Students Target" value={form.numberOfStudents} onChangeText={(v) => set('numberOfStudents', v)} keyboardType="numeric" placeholder="Optional" accentColor={T.accent} containerStyle={styles.half} />
              </View>
              <SelectPicker label="Period Type" options={[{ label: 'Monthly', value: 'Monthly' }, { label: 'Quarterly', value: 'Quarterly' }, { label: 'Annually', value: 'Annually' }]} value={form.periodType} onChange={(v) => set('periodType', v)} accentColor={T.accent} />
              <View style={styles.row}>
                <View style={styles.half}>
                  <DateInput label="Start Date *" value={form.startDate} onChange={(v) => set('startDate', v)} placeholder="Select start date" accentColor={T.accent} />
                </View>
                <View style={styles.half}>
                  <DateInput label="End Date *" value={form.endDate} onChange={(v) => set('endDate', v)} placeholder="Select end date" accentColor={T.accent} />
                </View>
              </View>
              <GradientButton label="Assign Target" onPress={handleCreate} loading={createLoading} style={{ marginTop: 8, marginBottom: 32 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(22), color: '#FFF', letterSpacing: -0.3 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 100, padding: 3 },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 100 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { fontFamily: Fonts.medium, fontSize: rf(12), color: 'rgba(255,255,255,0.9)' },
  tabTextActive: { color: '#8C5A2E' },
  scroll: { flex: 1 },
  list: { padding: 16 },
  singleCol: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  targetCard: { padding: 16 },
  targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  targetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginRight: 8 },
  periodBadge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  periodBadgeText: { fontFamily: Fonts.bold, fontSize: rf(10), color: '#FFF' },
  targetTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: rf(15) },
  targetDesc: { fontFamily: Fonts.regular, fontSize: rf(13), marginBottom: 12, lineHeight: 19 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  kpiItem: { flex: 1, minWidth: '45%' },
  kpiLabel: { fontFamily: Fonts.medium, fontSize: rf(11), textTransform: 'uppercase', marginBottom: 2 },
  kpiVal: { fontFamily: Fonts.bold, fontSize: rf(16) },
  kpiTotal: { fontFamily: Fonts.regular, fontSize: rf(11) },
  targetMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metaText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  daysLeft: { fontFamily: Fonts.medium, fontSize: rf(12) },
  assignInfo: { fontFamily: Fonts.regular, fontSize: rf(12), marginBottom: 8 },
  reviewNote: { padding: 10, borderRadius: 8, marginBottom: 10 },
  reviewNoteText: { fontFamily: Fonts.regular, fontSize: rf(13) },
  targetActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, height: 46 },
  outlineBtn: {
    flex: 1, height: 46, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { fontFamily: Fonts.bold, fontSize: rf(15) },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', width: '100%',
  },
  modalTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 24, marginBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: rf(18) },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
