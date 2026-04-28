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
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ROLE_COLORS } from '../../utils/constants';
import { formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'Active', 'Inactive', 'Blacklisted', 'Priority'];

const STATUS_COLORS: Record<string, string> = {
  Active: '#16A34A',
  Inactive: '#9CA3AF',
  Blacklisted: '#DC2626',
};

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
  onClose, color, isSca,
}: { onClose: () => void; color: any; isSca: boolean }) {
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
        <View style={am.card}>
          {/* Header */}
          <View style={am.header}>
            <View style={am.headerLeft}>
              <Navigation size={18} color="#0D9488" />
              <Text style={am.title}>Assign Schools</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Assign To — SelectPicker dropdown */}
          {loadingMembers ? (
            <View style={am.loadingRow}>
              <ActivityIndicator size="small" color={color.primary} />
              <Text style={am.loadingText}>Loading team members...</Text>
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
              accentColor={color.primary}
              containerStyle={am.pickerContainer}
            />
          )}

          {/* Date + Notes row */}
          <View style={am.row2}>
            <View style={{ flex: 1 }}>
              <Text style={am.label}>Date *</Text>
              <DateInput
                value={assignDate}
                onChange={setAssignDate}
                accentColor={color.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={am.label}>Notes</Text>
              <TextInput
                style={am.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Already assigned pills */}
          {existingIds.length > 0 && (
            <View style={am.existingRow}>
              <Text style={am.existingLabel}>Already assigned:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {allSchools.filter(s => existingIds.includes(s.id)).map(s => (
                    <View key={s.id} style={am.existingPill}>
                      <Text style={am.existingPillText}>{s.name}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={am.searchBar}>
            <Search size={14} color="#9CA3AF" />
            <TextInput
              style={am.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search schools..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* School list */}
          <ScrollView style={am.schoolList} showsVerticalScrollIndicator={false}>
            {loadingSchools ? (
              <ActivityIndicator size="small" color={color.primary} style={{ marginVertical: 20 }} />
            ) : filtered.length === 0 ? (
              <Text style={am.emptyText}>No schools found</Text>
            ) : filtered.map(s => {
              const isSelected = selectedIds.includes(s.id);
              const already = existingIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[am.schoolRow, isSelected && { backgroundColor: '#F0FDF4', borderColor: '#16A34A' }, already && am.schoolRowDisabled]}
                  onPress={() => toggle(s.id)}
                  activeOpacity={already ? 1 : 0.7}
                >
                  <View style={[am.checkbox, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }, already && am.checkboxDisabled]}>
                    {(isSelected || already) && <Check size={12} color={already ? '#9CA3AF' : '#FFF'} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={am.schoolName} numberOfLines={1}>{s.name}</Text>
                    <Text style={am.schoolMeta}>{[s.city, s.board].filter(Boolean).join(' • ')}</Text>
                  </View>
                  {already && <Text style={am.assignedLabel}>Assigned</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={am.footer}>
            <Text style={am.selectedCount}>
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select schools above'}
            </Text>
            <View style={am.footerBtns}>
              <TouchableOpacity style={am.cancelBtn} onPress={onClose}>
                <Text style={am.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[am.assignBtn, (!selectedUserId || selectedIds.length === 0 || assigning) && am.btnDisabled]}
                onPress={handleAssign}
                disabled={!selectedUserId || selectedIds.length === 0 || assigning}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <UserCheck size={15} color="#FFF" />
                    <Text style={am.assignBtnText}>Assign</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Reassign Single School Modal ──
function ReassignModal({
  school, onClose, onSaved, color, isSca,
}: { school: any; onClose: () => void; onSaved: () => void; color: any; isSca: boolean }) {
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
        <View style={rm.card}>
          <View style={rm.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} color="#7C3AED" />
              <Text style={rm.title}>Reassign School</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color="#6B7280" /></TouchableOpacity>
          </View>

          <View style={rm.schoolInfo}>
            <Text style={rm.schoolInfoName}>{school.name}</Text>
            <Text style={rm.schoolInfoMeta}>{[school.city, school.board].filter(Boolean).join(' • ')}</Text>
            {school.assignedToName ? (
              <Text style={rm.currentAssignee}>Currently: <Text style={{ fontWeight: '700' }}>{school.assignedToName}</Text></Text>
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
            accentColor="#7C3AED"
          />

          <Text style={rm.label}>Visit Date *</Text>
          <DateInput value={assignDate} onChange={setAssignDate} accentColor="#7C3AED" />

          <View style={rm.footer}>
            <TouchableOpacity style={rm.cancelBtn} onPress={onClose}>
              <Text style={rm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.saveBtn, (!selectedUserId || saving) && rm.btnDisabled]}
              onPress={handleSave}
              disabled={!selectedUserId || saving}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <UserCheck size={15} color="#FFF" />
                  <Text style={rm.saveBtnText}>Reassign</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ──
export const SchoolsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);
  const isSca = role === 'SCA';
  const isFo = role === 'FO';

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

  const PRIORITY_COLORS: Record<string, string> = { High: '#DC2626', Medium: '#F59E0B', Low: '#16A34A' };

  const renderSchool = ({ item }: { item: School | SchoolWithPriority }) => {
    const s = item as any;
    const hasPriority = s.visitPriorityScore != null;
    return (
      <Card
        style={tablet ? { ...styles.card, flex: 1 } : styles.card}
        onPress={() => navigation.navigate('SchoolDetail', { schoolId: s.id })}
      >
        {/* Name + badges */}
        <View style={styles.cardHeader}>
          <Text style={styles.schoolName} numberOfLines={2}>{s.name}</Text>
          <View style={styles.cardHeaderRight}>
            {hasPriority && (
              <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[s.priorityLevel] || '#9CA3AF') + '20' }]}>
                <Flame size={10} color={PRIORITY_COLORS[s.priorityLevel] || '#9CA3AF'} />
                <Text style={[styles.priorityScore, { color: PRIORITY_COLORS[s.priorityLevel] || '#9CA3AF' }]}>{s.visitPriorityScore}</Text>
              </View>
            )}
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s.status] || '#9CA3AF' }]} />
          </View>
        </View>

        {/* City / State / Board */}
        <View style={styles.metaRow}>
          {s.city && <Text style={styles.metaText}>{s.city}</Text>}
          {s.city && s.state && <Text style={styles.metaDot}>•</Text>}
          {s.state && <Text style={styles.metaText}>{s.state}</Text>}
          {s.board && <><Text style={styles.metaDot}>•</Text><Text style={styles.metaText}>{s.board}</Text></>}
        </View>

        {/* Assigned To — managers only */}
        {isManager && s.assignedToName ? (
          <View style={styles.assignedRow}>
            <UserCheck size={12} color="#16A34A" />
            <Text style={styles.assignedText}>{s.assignedToName}</Text>
          </View>
        ) : isManager ? (
          <Text style={styles.unassignedText}>Unassigned</Text>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          {s.studentCount != null && (
            <View style={styles.stat}>
              <Users size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{s.studentCount} students</Text>
            </View>
          )}
          {s.contactCount != null && (
            <View style={styles.stat}>
              <Phone size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{s.contactCount} contacts</Text>
            </View>
          )}
          {s.lastVisitDate && <Text style={styles.lastVisit}>Visited {formatRelativeDate(s.lastVisitDate)}</Text>}
        </View>

        {/* Footer: category + status badge */}
        <View style={styles.cardFooter}>
          <Text style={styles.category}>{s.category}</Text>
          <Badge label={s.status} color={STATUS_COLORS[s.status] || '#9CA3AF'} />
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation?.(); navigation.navigate('AddSchool', { school: s }); }}
          >
            <Edit2 size={13} color="#2563EB" />
            <Text style={[styles.actionText, { color: '#2563EB' }]}>Edit</Text>
          </TouchableOpacity>

          {isManager && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#EDE9FE' }]}
              onPress={(e) => { e.stopPropagation?.(); setReassignSchool(s); }}
            >
              <UserCheck size={13} color="#7C3AED" />
              <Text style={[styles.actionText, { color: '#7C3AED' }]}>Reassign</Text>
            </TouchableOpacity>
          )}

          {!isFo && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={(e) => { e.stopPropagation?.(); setDeleteSchool(s); }}
            >
              <Trash2 size={13} color="#DC2626" />
              <Text style={[styles.actionText, { color: '#DC2626' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading schools..." />
      ) : (
        <FlatList
          data={schools}
          keyExtractor={item => String(item.id)}
          renderItem={renderSchool}
          contentContainerStyle={[styles.list, schools.length === 0 && styles.listEmpty]}
          key={tablet ? 'grid' : 'list'}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          ListHeaderComponent={
            <View>
              <View style={styles.controlsCard}>
                <View style={styles.controlsTopRow}>
                  <View style={styles.searchBar}>
                    <Search size={16} color="#9CA3AF" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search school, city..."
                      placeholderTextColor="#9CA3AF"
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: COLOR.primary }]}
                    onPress={() => navigation.navigate('AddSchool')}
                  >
                    <Plus size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, filter === f && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
                      onPress={() => setFilter(f)}
                    >
                      <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {isManager && (
                <TouchableOpacity
                  style={[styles.assignSchoolsBtn, { backgroundColor: '#7C3AED' }]}
                  onPress={() => setShowAssignModal(true)}
                  activeOpacity={0.85}
                >
                  <Navigation size={15} color="#FFF" />
                  <Text style={styles.assignSchoolsBtnText}>Assign Schools</Text>
                </TouchableOpacity>
              )}

              <View style={styles.countBar}>
                <Text style={styles.countText}>{schools.length} Schools</Text>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setPage(1); fetchSchools(1, true); }}
              colors={[COLOR.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No schools found" subtitle="Try adjusting your search or filters" icon="🏫" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={COLOR.primary} /> : null}
        />
      )}

      {/* Assign Schools Modal */}
      {showAssignModal && (
        <AssignModal
          onClose={() => setShowAssignModal(false)}
          color={COLOR}
          isSca={isSca}
        />
      )}

      {/* Reassign Modal */}
      {reassignSchool && (
        <ReassignModal
          school={reassignSchool}
          onClose={() => setReassignSchool(null)}
          onSaved={() => { setReassignSchool(null); fetchSchools(1, true); }}
          color={COLOR}
          isSca={isSca}
        />
      )}

      {/* Delete Confirm */}
      {deleteSchool && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setDeleteSchool(null)}>
          <View style={styles.deleteOverlay}>
            <View style={styles.deleteCard}>
              <Text style={styles.deleteTitle}>Delete School?</Text>
              <Text style={styles.deleteSub}>
                <Text style={{ fontWeight: '700' }}>{deleteSchool.name}</Text> will be deactivated. You can reactivate it later.
              </Text>
              <View style={styles.deleteActions}>
                <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteSchool(null)}>
                  <Text style={styles.deleteCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
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

// ── Styles ──
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  controlsCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#EEF2F7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1,
  },
  controlsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, flex: 1,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '700' },
  assignSchoolsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, marginHorizontal: 16, marginBottom: 10 },
  assignSchoolsBtnText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
  countBar: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: rf(12), color: '#6B7280', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },
  card: { marginBottom: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  schoolName: { flex: 1, fontSize: rf(15), fontWeight: '700', color: '#111827', marginRight: 8 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 100 },
  priorityScore: { fontSize: rf(11), fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaText: { fontSize: rf(12), color: '#9CA3AF' },
  metaDot: { fontSize: rf(12), color: '#D1D5DB' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  assignedText: { fontSize: rf(12), color: '#16A34A', fontWeight: '600' },
  unassignedText: { fontSize: rf(11), color: '#D1D5DB', marginBottom: 6 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: rf(12), color: '#6B7280' },
  lastVisit: { fontSize: rf(11), color: '#9CA3AF' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  category: { fontSize: rf(12), color: '#6B7280' },
  actionRow: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, backgroundColor: '#DBEAFE', borderRadius: 8 },
  actionText: { fontSize: rf(12), fontWeight: '600' },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  deleteCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360 },
  deleteTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827', marginBottom: 8 },
  deleteSub: { fontSize: rf(13), color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  deleteActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  deleteCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  deleteCancelText: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  deleteConfirmBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#DC2626', minWidth: 72, alignItems: 'center' },
  deleteConfirmText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
});

// ── AssignModal Styles ──
const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  label: { fontSize: rf(12), fontWeight: '600', color: '#374151', marginBottom: 6 },
  pickerContainer: { marginBottom: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  loadingText: { fontSize: rf(13), color: '#9CA3AF' },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  notesInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: rf(13), color: '#111827' },
  existingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  existingLabel: { fontSize: rf(10), fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  existingPill: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  existingPillText: { fontSize: rf(11), color: '#2563EB', fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: rf(13), color: '#111827' },
  schoolList: { maxHeight: 280, marginBottom: 8 },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: 'transparent' },
  schoolRowDisabled: { opacity: 0.45 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxDisabled: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  schoolName: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  schoolMeta: { fontSize: rf(11), color: '#9CA3AF', marginTop: 1 },
  assignedLabel: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '600' },
  emptyText: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  selectedCount: { fontSize: rf(13), color: '#6B7280' },
  footerBtns: { flexDirection: 'row', gap: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#0D9488', borderRadius: 12 },
  assignBtnText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.4 },
});

// ── ReassignModal Styles ──
const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  schoolInfo: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 },
  schoolInfoName: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  schoolInfoMeta: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  currentAssignee: { fontSize: rf(12), color: '#6B7280', marginTop: 4 },
  label: { fontSize: rf(12), fontWeight: '600', color: '#374151', marginBottom: 6 },
  footer: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 14 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#7C3AED', borderRadius: 12 },
  saveBtnText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.4 },
});
