import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions,
  Modal, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search, Plus, Users, Phone, Flame, X, Check,
  Edit2, Trash2, UserCheck, Navigation,
} from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { schoolAssignmentsApi } from '../../api/schoolAssignments';
import { dashboardApi } from '../../api/dashboard';
import { School, SchoolWithPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui';
import { GradientButton } from '../../components/common/GradientButton';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { formatRelativeDate } from '../../utils/formatting';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

const FILTERS = ['All', 'Active', 'Inactive', 'Blacklisted', 'Priority'];

// ── Normalise team member response into { userId, name, group } ──
function normalizeMembers(data: any[], isSca: boolean) {
  if (isSca) {
    return (data || [])
      .filter((u: any) => ['FO', 'ZH', 'RH'].includes(u.role))
      .map((u: any) => ({ userId: u.id, name: u.name, role: u.role, group: u.zone || u.region || '' }));
  }
  return (data || []).map((u: any) => ({
    userId: u.foId ?? u.id,
    name: u.name,
    role: 'FO',
    group: u.zone || u.region || '',
  }));
}

// ── Assign Schools Modal ──
function AssignModal({
  onClose, isSca,
}: { onClose: () => void; isSca: boolean }) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const [members, setMembers] = useState<{ userId: number; name: string; role: string; group: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [allSchools, setAllSchools] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [existingIds, setExistingIds] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    const loader = isSca
      ? dashboardApi.getReportableUsers()
      : dashboardApi.getTeamPerformance();
    loader
      .then(res => setMembers(normalizeMembers(res.data || [], isSca)))
      .catch(() => {})
      .finally(() => setLoadingMembers(false));

    schoolsApi.getAll({ page: 1, limit: 500 })
      .then(res => {
        const d = res.data as any;
        setAllSchools(d?.schools || d?.items || (Array.isArray(d) ? d : []));
      })
      .catch(() => {})
      .finally(() => setLoadingSchools(false));
  }, [isSca]);

  // Load existing assignments when user + date change
  useEffect(() => {
    if (!selectedUserId || !assignDate) { setExistingIds([]); return; }
    schoolAssignmentsApi.getUserAssignments(selectedUserId, assignDate)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.assignments ?? [];
        setExistingIds(list.map((a: any) => a.schoolId));
      })
      .catch(() => setExistingIds([]));
  }, [selectedUserId, assignDate]);

  const filtered = allSchools.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    if (existingIds.includes(id)) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!selectedUserId) { Alert.alert('Select User', 'Please select a user to assign schools to.'); return; }
    if (selectedIds.length === 0) { Alert.alert('Select Schools', 'Select at least one school.'); return; }
    setAssigning(true);
    try {
      await schoolAssignmentsApi.bulkAssign({
        userId: selectedUserId,
        assignmentDate: assignDate,
        schoolIds: selectedIds,
        notes: notes.trim() || undefined,
      });
      const name = members.find(m => m.userId === selectedUserId)?.name || 'user';
      Alert.alert('Assigned!', `${selectedIds.length} school(s) assigned to ${name}.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={[am.card, { backgroundColor: T.card }, wide && am.cardWide]}>
          {/* Header */}
          <View style={am.header}>
            <View style={am.headerLeft}>
              <Navigation size={18} color={T.accent} />
              <Text style={[am.title, { color: T.text }]}>Assign Schools</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={T.sub} />
            </TouchableOpacity>
          </View>

          {/* Assign To — SelectPicker dropdown */}
          {loadingMembers ? (
            <View style={am.loadingRow}>
              <ActivityIndicator size="small" color={T.accent} />
              <Text style={[am.loadingText, { color: T.dim }]}>Loading team members...</Text>
            </View>
          ) : (
            <SelectPicker
              label="Assign To *"
              placeholder="Select user"
              options={members.map(m => ({
                value: m.userId,
                label: m.name + (m.group ? ` (${m.group})` : '') + (m.role && m.role !== 'FO' ? ` — ${m.role}` : ''),
              }))}
              value={selectedUserId ?? undefined}
              onChange={v => setSelectedUserId(Number(v))}
              accentColor={T.accent}
              containerStyle={am.pickerContainer}
            />
          )}

          {/* Date + Notes row */}
          <View style={am.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[am.label, { color: T.sub }]}>Date *</Text>
              <DateInput
                value={assignDate}
                onChange={setAssignDate}
                accentColor={T.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[am.label, { color: T.sub }]}>Notes</Text>
              <TextInput
                style={[am.notesInput, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor={T.dim}
              />
            </View>
          </View>

          {/* Already assigned pills */}
          {existingIds.length > 0 && (
            <View style={am.existingRow}>
              <Text style={[am.existingLabel, { color: T.dim }]}>Already assigned:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {allSchools.filter(s => existingIds.includes(s.id)).map(s => (
                    <View key={s.id} style={[am.existingPill, { backgroundColor: T.info + '22' }]}>
                      <Text style={[am.existingPillText, { color: T.info }]}>{s.name}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={[am.searchBar, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
            <Search size={14} color={T.dim} />
            <TextInput
              style={[am.searchInput, { color: T.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search schools..."
              placeholderTextColor={T.dim}
            />
          </View>

          {/* School list */}
          <ScrollView style={am.schoolList} showsVerticalScrollIndicator={false}>
            {loadingSchools ? (
              <ActivityIndicator size="small" color={T.accent} style={{ marginVertical: 20 }} />
            ) : filtered.length === 0 ? (
              <Text style={[am.emptyText, { color: T.dim }]}>No schools found</Text>
            ) : filtered.map(s => {
              const isSelected = selectedIds.includes(s.id);
              const already = existingIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    am.schoolRow,
                    { borderColor: 'transparent' },
                    isSelected && { backgroundColor: T.accentSoft, borderColor: T.accent },
                    already && am.schoolRowDisabled,
                  ]}
                  onPress={() => toggle(s.id)}
                  activeOpacity={already ? 1 : 0.7}
                >
                  <View style={[
                    am.checkbox,
                    { borderColor: T.lineStrong },
                    isSelected && { backgroundColor: T.accent, borderColor: T.accent },
                    already && { backgroundColor: T.line, borderColor: T.lineStrong },
                  ]}>
                    {(isSelected || already) && <Check size={12} color={already ? T.dim : T.onAccent} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[am.schoolName, { color: T.text }]} numberOfLines={1}>{s.name}</Text>
                    <Text style={[am.schoolMeta, { color: T.dim }]}>{[s.city, s.board].filter(Boolean).join(' • ')}</Text>
                  </View>
                  {already && <Text style={[am.assignedLabel, { color: T.dim }]}>Assigned</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={[am.footer, { borderTopColor: T.line }]}>
            <Text style={[am.selectedCount, { color: T.sub }]}>
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select schools above'}
            </Text>
            <View style={am.footerBtns}>
              <TouchableOpacity style={[am.cancelBtn, { backgroundColor: T.cardAlt }]} onPress={onClose}>
                <Text style={[am.cancelText, { color: T.sub }]}>Cancel</Text>
              </TouchableOpacity>
              <GradientButton
                label="Assign"
                onPress={handleAssign}
                loading={assigning}
                disabled={!selectedUserId || selectedIds.length === 0}
                icon={<UserCheck size={15} color="#FFF" />}
                style={am.submitBtn}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Reassign Single School Modal ──
function ReassignModal({
  school, onClose, onSaved, isSca,
}: { school: any; onClose: () => void; onSaved: () => void; isSca: boolean }) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const [members, setMembers] = useState<{ userId: number; name: string; group: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    school.assignedToId ? Number(school.assignedToId) : null
  );
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loader = isSca ? dashboardApi.getReportableUsers() : dashboardApi.getTeamPerformance();
    loader
      .then(res => setMembers(normalizeMembers(res.data || [], isSca)))
      .catch(() => {});
  }, [isSca]);

  const handleSave = async () => {
    if (!selectedUserId) { Alert.alert('Select User', 'Please select a user.'); return; }
    setSaving(true);
    try {
      await schoolAssignmentsApi.reassignSchool({
        schoolId: school.id,
        newUserId: selectedUserId,
        assignmentDate: assignDate,
        notes: 'Reassigned from school list',
      });
      const name = members.find(m => m.userId === selectedUserId)?.name || 'user';
      Alert.alert('Reassigned', `${school.name} reassigned to ${name}.`);
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Reassignment failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={[rm.card, { backgroundColor: T.card }, wide && rm.cardWide]}>
          <View style={rm.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} color={T.accent} />
              <Text style={[rm.title, { color: T.text }]}>Reassign School</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color={T.sub} /></TouchableOpacity>
          </View>

          <View style={[rm.schoolInfo, { backgroundColor: T.fieldBg }]}>
            <Text style={[rm.schoolInfoName, { color: T.text }]}>{school.name}</Text>
            <Text style={[rm.schoolInfoMeta, { color: T.dim }]}>{[school.city, school.board].filter(Boolean).join(' • ')}</Text>
            {school.assignedToName ? (
              <Text style={[rm.currentAssignee, { color: T.sub }]}>Currently: <Text style={{ fontFamily: Fonts.bold }}>{school.assignedToName}</Text></Text>
            ) : null}
          </View>

          <SelectPicker
            label="Assign To *"
            placeholder="Select user"
            options={members.map(m => ({
              value: m.userId,
              label: m.name + (m.group ? ` (${m.group})` : ''),
            }))}
            value={selectedUserId ?? undefined}
            onChange={v => setSelectedUserId(Number(v))}
            accentColor={T.accent}
          />

          <Text style={[rm.label, { color: T.sub }]}>Visit Date *</Text>
          <DateInput value={assignDate} onChange={setAssignDate} accentColor={T.accent} />

          <View style={[rm.footer, { borderTopColor: T.line }]}>
            <TouchableOpacity style={[rm.cancelBtn, { backgroundColor: T.cardAlt }]} onPress={onClose}>
              <Text style={[rm.cancelText, { color: T.sub }]}>Cancel</Text>
            </TouchableOpacity>
            <GradientButton
              label="Reassign"
              onPress={handleSave}
              loading={saving}
              disabled={!selectedUserId}
              icon={<UserCheck size={15} color="#FFF" />}
              style={rm.submitBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ──
export const SchoolsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions();
  const landscapeTablet = isTabletDevice && width > height;
  const cols = landscapeTablet ? (width >= 1100 ? 3 : 2) : 1;
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);
  const isSca = role === 'SCA';
  const isFo = role === 'FO';

  const STATUS_COLORS: Record<string, string> = {
    Active: T.success,
    Inactive: T.dim,
    Blacklisted: T.danger,
  };
  const PRIORITY_COLORS: Record<string, string> = { High: T.danger, Medium: T.warning, Low: T.success };

  const [schools, setSchools] = useState<(School | SchoolWithPriority)[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [reassignSchool, setReassignSchool] = useState<any>(null);
  const [deleteSchool, setDeleteSchool] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const extractList = (d: any): (School | SchoolWithPriority)[] => {
    if (Array.isArray(d)) return d;
    if (d?.schools) return d.schools;
    if (d?.items) return d.items;
    return [];
  };
  const extractPages = (d: any) => d?.totalPages ?? (Math.ceil((d?.total || 0) / 20) || 1);

  const fetchSchools = useCallback(async (pg = 1, reset = false) => {
    try {
      let items: (School | SchoolWithPriority)[] = [];
      let pages = 1;
      const params = { page: pg, pageSize: 20, limit: 20, search: search || undefined };
      if (filter === 'Priority') {
        const res = await schoolsApi.getPriority(params);
        items = extractList(res.data);
        pages = extractPages(res.data);
      } else {
        const status = filter !== 'All' ? filter : undefined;
        const res = await schoolsApi.getAll({ ...params, status } as any);
        items = extractList(res.data);
        pages = extractPages(res.data);
      }
      if (reset) setSchools(items);
      else setSchools(prev => [...prev, ...items]);
      setTotalPages(pages);
    } catch {
      if (reset) setSchools([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSchools(1, true);
  }, [search, filter]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchSchools(next, false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSchool) return;
    setDeleting(true);
    try {
      await schoolsApi.deleteSchool(deleteSchool.id);
      setDeleteSchool(null);
      fetchSchools(1, true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete school.');
    } finally {
      setDeleting(false);
    }
  };

  const renderSchool = ({ item }: { item: School | SchoolWithPriority }) => {
    const s = item as any;
    const hasPriority = s.visitPriorityScore != null;
    return (
      <Card
        style={cols > 1 ? [styles.card, { flex: 1 }] : styles.card}
        onPress={() => navigation.navigate('SchoolDetail', { schoolId: s.id })}
      >
        {/* Name + badges */}
        <View style={styles.cardHeader}>
          <Text style={[styles.schoolName, { color: T.text }]} numberOfLines={2}>{s.name}</Text>
          <View style={styles.cardHeaderRight}>
            {hasPriority && (
              <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[s.priorityLevel] || T.dim) + '20' }]}>
                <Flame size={10} color={PRIORITY_COLORS[s.priorityLevel] || T.dim} />
                <Text style={[styles.priorityScore, { color: PRIORITY_COLORS[s.priorityLevel] || T.dim }]}>{s.visitPriorityScore}</Text>
              </View>
            )}
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s.status] || T.dim }]} />
          </View>
        </View>

        {/* City / State / Board */}
        <View style={styles.metaRow}>
          {s.city && <Text style={[styles.metaText, { color: T.dim }]}>{s.city}</Text>}
          {s.city && s.state && <Text style={[styles.metaDot, { color: T.line }]}>•</Text>}
          {s.state && <Text style={[styles.metaText, { color: T.dim }]}>{s.state}</Text>}
          {s.board && <><Text style={[styles.metaDot, { color: T.line }]}>•</Text><Text style={[styles.metaText, { color: T.dim }]}>{s.board}</Text></>}
        </View>

        {/* Assigned To — managers only */}
        {isManager && s.assignedToName ? (
          <View style={styles.assignedRow}>
            <UserCheck size={12} color={T.success} />
            <Text style={[styles.assignedText, { color: T.success }]}>{s.assignedToName}</Text>
          </View>
        ) : isManager ? (
          <Text style={[styles.unassignedText, { color: T.dim }]}>Unassigned</Text>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          {s.studentCount != null && (
            <View style={styles.stat}>
              <Users size={12} color={T.dim} />
              <Text style={[styles.statText, { color: T.sub }]}>{s.studentCount} students</Text>
            </View>
          )}
          {s.contactCount != null && (
            <View style={styles.stat}>
              <Phone size={12} color={T.dim} />
              <Text style={[styles.statText, { color: T.sub }]}>{s.contactCount} contacts</Text>
            </View>
          )}
          {s.lastVisitDate && <Text style={[styles.lastVisit, { color: T.dim }]}>Visited {formatRelativeDate(s.lastVisitDate)}</Text>}
        </View>

        {/* Footer: category + status badge */}
        <View style={styles.cardFooter}>
          <Text style={[styles.category, { color: T.sub }]}>{s.category}</Text>
          <Badge label={s.status} color={STATUS_COLORS[s.status] || T.dim} />
        </View>

        {/* Action buttons */}
        <View style={[styles.actionRow, { borderTopColor: T.line }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.info + '22' }]}
            onPress={(e) => { e.stopPropagation?.(); navigation.navigate('AddSchool', { school: s }); }}
          >
            <Edit2 size={13} color={T.info} />
            <Text style={[styles.actionText, { color: T.info }]}>Edit</Text>
          </TouchableOpacity>

          {isManager && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: T.accentSoft }]}
              onPress={(e) => { e.stopPropagation?.(); setReassignSchool(s); }}
            >
              <UserCheck size={13} color={T.accent} />
              <Text style={[styles.actionText, { color: T.accent }]}>Reassign</Text>
            </TouchableOpacity>
          )}

          {!isFo && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: T.danger + '22' }]}
              onPress={(e) => { e.stopPropagation?.(); setDeleteSchool(s); }}
            >
              <Trash2 size={13} color={T.danger} />
              <Text style={[styles.actionText, { color: T.danger }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading schools..." />
      ) : (
        <FlatList
          data={schools}
          keyExtractor={item => String(item.id)}
          renderItem={renderSchool}
          contentContainerStyle={[styles.list, schools.length === 0 && styles.listEmpty]}
          key={String(cols)}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? { gap: 10 } : undefined}
          ListHeaderComponent={
            <View>
              <View style={[styles.controlsCard, { backgroundColor: T.card, borderColor: T.line }]}>
                <View style={styles.controlsTopRow}>
                  <View style={[styles.searchBar, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
                    <Search size={16} color={T.dim} />
                    <TextInput
                      style={[styles.searchInput, { color: T.text }]}
                      placeholder="Search school, city..."
                      placeholderTextColor={T.dim}
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: T.accent }]}
                    onPress={() => navigation.navigate('AddSchool')}
                  >
                    <Plus size={18} color={T.onAccent} />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.filterChip,
                        { backgroundColor: T.card, borderColor: T.line },
                        filter === f && { backgroundColor: T.accent, borderColor: T.accent },
                      ]}
                      onPress={() => setFilter(f)}
                    >
                      <Text style={[styles.filterText, { color: T.sub }, filter === f && { color: T.onAccent }]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {isManager && (
                <GradientButton
                  label="Assign Schools"
                  onPress={() => setShowAssignModal(true)}
                  icon={<Navigation size={16} color="#FFF" />}
                  style={styles.assignSchoolsBtn}
                />
              )}

              <View style={styles.countBar}>
                <Text style={[styles.countText, { color: T.sub }]}>{schools.length} Schools</Text>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setPage(1); fetchSchools(1, true); }}
              colors={[T.accent]}
              tintColor={T.accent}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No schools found" subtitle="Try adjusting your search or filters" icon="🏫" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={T.accent} /> : null}
        />
      )}

      {/* Assign Schools Modal */}
      {showAssignModal && (
        <AssignModal
          onClose={() => setShowAssignModal(false)}
          isSca={isSca}
        />
      )}

      {/* Reassign Modal */}
      {reassignSchool && (
        <ReassignModal
          school={reassignSchool}
          onClose={() => setReassignSchool(null)}
          onSaved={() => { setReassignSchool(null); fetchSchools(1, true); }}
          isSca={isSca}
        />
      )}

      {/* Delete Confirm */}
      {deleteSchool && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setDeleteSchool(null)}>
          <View style={styles.deleteOverlay}>
            <View style={[styles.deleteCard, { backgroundColor: T.card, borderColor: T.line }]}>
              <Text style={[styles.deleteTitle, { color: T.text }]}>Delete School?</Text>
              <Text style={[styles.deleteSub, { color: T.sub }]}>
                <Text style={{ fontFamily: Fonts.bold, color: T.text }}>{deleteSchool.name}</Text> will be deactivated. You can reactivate it later.
              </Text>
              <View style={styles.deleteActions}>
                <TouchableOpacity style={[styles.deleteCancelBtn, { backgroundColor: T.cardAlt }]} onPress={() => setDeleteSchool(null)}>
                  <Text style={[styles.deleteCancelText, { color: T.sub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, { backgroundColor: T.danger }, deleting && { opacity: 0.6 }]}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.deleteConfirmText}>Delete</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

// ── Styles (layout only; colors applied inline via theme) ──
const styles = StyleSheet.create({
  safe: { flex: 1 },
  controlsCard: {
    borderRadius: 18, padding: 12, marginBottom: 10,
    borderWidth: 1,
  },
  controlsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8, flex: 1,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14) },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  filterText: { fontFamily: Fonts.bold, fontSize: rf(12) },
  assignSchoolsBtn: { marginHorizontal: 16, marginBottom: 10 },
  countBar: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontFamily: Fonts.medium, fontSize: rf(12) },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },
  card: { marginBottom: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  schoolName: { flex: 1, fontFamily: Fonts.bold, fontSize: rf(15), marginRight: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 100 },
  priorityScore: { fontFamily: Fonts.bold, fontSize: rf(11) },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  metaDot: { fontFamily: Fonts.regular, fontSize: rf(12) },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  assignedText: { fontFamily: Fonts.medium, fontSize: rf(12) },
  unassignedText: { fontFamily: Fonts.regular, fontSize: rf(11), marginBottom: 6 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  lastVisit: { fontFamily: Fonts.regular, fontSize: rf(11) },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  category: { fontFamily: Fonts.regular, fontSize: rf(12) },
  actionRow: { flexDirection: 'row', gap: 6, borderTopWidth: 1, paddingTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontFamily: Fonts.medium, fontSize: rf(12) },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  deleteCard: { borderRadius: 20, borderWidth: 1, padding: 24, width: '85%', maxWidth: 360 },
  deleteTitle: { fontFamily: Fonts.bold, fontSize: rf(17), marginBottom: 8 },
  deleteSub: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 20, marginBottom: 20 },
  deleteActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  deleteCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  deleteCancelText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  deleteConfirmBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minWidth: 72, alignItems: 'center' },
  deleteConfirmText: { fontFamily: Fonts.bold, fontSize: rf(13), color: '#FFF' },
});

// ── AssignModal Styles (layout only) ──
const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  cardWide: { alignSelf: 'center', width: '100%', maxWidth: 720 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: Fonts.bold, fontSize: rf(17) },
  label: { fontFamily: Fonts.medium, fontSize: rf(12), marginBottom: 6 },
  pickerContainer: { marginBottom: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  loadingText: { fontFamily: Fonts.regular, fontSize: rf(13) },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  notesInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, fontFamily: Fonts.regular, fontSize: rf(13) },
  existingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  existingLabel: { fontFamily: Fonts.bold, fontSize: rf(10), textTransform: 'uppercase' },
  existingPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  existingPillText: { fontFamily: Fonts.medium, fontSize: rf(11) },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(13) },
  schoolList: { maxHeight: 280, marginBottom: 8 },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 4, borderWidth: 1 },
  schoolRowDisabled: { opacity: 0.45 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  schoolName: { fontFamily: Fonts.medium, fontSize: rf(13) },
  schoolMeta: { fontFamily: Fonts.regular, fontSize: rf(11), marginTop: 1 },
  assignedLabel: { fontFamily: Fonts.medium, fontSize: rf(10) },
  emptyText: { fontFamily: Fonts.regular, fontSize: rf(13), textAlign: 'center', paddingVertical: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12 },
  selectedCount: { fontFamily: Fonts.regular, fontSize: rf(13) },
  footerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  cancelText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  submitBtn: { minWidth: 150, height: 46, borderRadius: 12, paddingHorizontal: 18 },
});

// ── ReassignModal Styles (layout only) ──
const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  cardWide: { alignSelf: 'center', width: '100%', maxWidth: 720 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: Fonts.bold, fontSize: rf(17) },
  schoolInfo: { borderRadius: 14, padding: 12, marginBottom: 16 },
  schoolInfoName: { fontFamily: Fonts.bold, fontSize: rf(14) },
  schoolInfoMeta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  currentAssignee: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 4 },
  label: { fontFamily: Fonts.medium, fontSize: rf(12), marginBottom: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end', borderTopWidth: 1, paddingTop: 14, marginTop: 14 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  cancelText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  submitBtn: { minWidth: 150, height: 46, borderRadius: 12, paddingHorizontal: 18 },
});
