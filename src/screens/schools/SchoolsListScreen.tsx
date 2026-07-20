import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  useWindowDimensions, Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import {
  Plus, Navigation, Filter, List as ListIcon, Map as MapIcon,
  Edit2, Trash2, UserCheck, MapPin, Users, Phone,
} from 'lucide-react-native';

import { schoolsApi } from '../../api/schools';
import { schoolAssignmentsApi } from '../../api/schoolAssignments';
import { dashboardApi } from '../../api/dashboard';
import { School, SchoolWithPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Icon, ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, SearchBar, Checkbox, Segmented, Trigger, Dropdown,
  StatusBadge, FilterChip, Pagination, ListCard, Avatar, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

/** Web parity: the list pages 10 at a time and reports the server's real totalCount. */
const PAGE_SIZE = 10;

const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'Other'];

/** Web parity: the assignee dropdown groups by role, RH ▸ ZH ▸ FO. */
const ROLE_ORDER = ['RH', 'ZH', 'FO'];

type ViewMode = 'list' | 'map';
type AnySchool = School | SchoolWithPriority;

type Member = { userId: number; name: string; role: string; group: string };

const DASH = '—';

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

/**
 * Normalise GET /dashboard/reportable-users into { userId, name, role, group }.
 *
 * Web parity (Schools.jsx): EVERY role calls getReportableUsers — the backend
 * already scopes correctly (SCA/SH → everyone, RH → ZHs+FOs in the region,
 * ZH → FOs in the zone). The old mobile fallback to getTeamPerformance for
 * non-SCA roles hard-coded `role: 'FO'` and `userId: u.foId ?? u.id`, so a
 * ZH/RH saw a different — and possibly mis-ID'd — list than the web app.
 */
function normalizeMembers(data: any[]): Member[] {
  return (data || [])
    .filter((u: any) => ['FO', 'ZH', 'RH'].includes(u.role))
    .map((u: any) => ({
      userId: u.id,
      name: u.name,
      role: u.role,
      group: u.zone || u.region || '',
    }));
}

/**
 * The CRUD kit's Dropdown has no <optgroup>, so web's role grouping becomes a
 * role-ordered list with the role appended to each label.
 */
function memberOptions(members: Member[]) {
  return [...members]
    .sort((a, b) => {
      const d = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
    })
    .map(m => ({
      label: `${m.name}${m.group ? ` — ${m.group}` : ''} · ${m.role}`,
      value: String(m.userId),
    }));
}

// ─── Assign Schools modal ─────────────────────────────────────────────────────
function AssignModal({ onClose }: { onClose: () => void }) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [allSchools, setAllSchools] = useState<AnySchool[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [existingIds, setExistingIds] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    dashboardApi.getReportableUsers()
      .then(res => setMembers(normalizeMembers((res.data as any) || [])))
      .catch(() => {})
      .finally(() => setLoadingMembers(false));

    schoolsApi.getAll({ page: 1, limit: 500 })
      .then(res => setAllSchools(((res.data as any)?.schools ?? []) as School[]))
      .catch(() => {})
      .finally(() => setLoadingSchools(false));
  }, []);

  // Pre-check what this user already has on that date so we never double-assign.
  useEffect(() => {
    if (!selectedUserId || !assignDate) { setExistingIds([]); return; }
    schoolAssignmentsApi.getUserAssignments(selectedUserId, assignDate)
      .then(res => {
        const list: any = Array.isArray(res.data) ? res.data : (res.data as any)?.assignments ?? [];
        setExistingIds(list.map((a: any) => a.schoolId));
      })
      .catch(() => setExistingIds([]));
  }, [selectedUserId, assignDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSchools;
    return allSchools.filter(s =>
      s.name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q));
  }, [allSchools, search]);

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

  const alreadyNames = allSchools.filter(s => existingIds.includes(s.id));

  return (
    <FormModal
      visible
      wide
      title="Assign Schools"
      onClose={onClose}
      footer={
        <>
          <Text style={[s.footNote, { color: T.sub }]}>
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select schools below'}
          </Text>
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label="Assign"
            onPress={handleAssign}
            loading={assigning}
            disabled={!selectedUserId || selectedIds.length === 0}
            small
            icon={<UserCheck size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        {loadingMembers ? (
          <View style={s.loadRow}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={[s.loadTxt, { color: T.dim }]}>Loading team members…</Text>
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
          />
        )}

        <View style={wide ? s.row2 : undefined}>
          <Field label="Date *" style={wide ? { flex: 1 } : undefined}>
            <DateInput value={assignDate} onChange={setAssignDate} accentColor={T.accent} />
          </Field>
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            containerStyle={wide ? { flex: 1 } : undefined}
          />
        </View>

        {alreadyNames.length > 0 && (
          <View>
            <Text style={[s.smallCap, { color: T.dim }]}>ALREADY ASSIGNED</Text>
            <View style={s.chipWrap}>
              {alreadyNames.map(sc => <FilterChip key={sc.id} label={sc.name} />)}
            </View>
          </View>
        )}

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search schools…" />

        <View style={[s.pickList, { borderColor: T.line }]}>
          {loadingSchools ? (
            <ActivityIndicator size="small" color={T.accent} style={{ marginVertical: 24 }} />
          ) : filtered.length === 0 ? (
            <Text style={[s.emptyTxt, { color: T.dim }]}>No schools found</Text>
          ) : (
            <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filtered.map(sc => {
                const on = selectedIds.includes(sc.id);
                const already = existingIds.includes(sc.id);
                return (
                  <View
                    key={sc.id}
                    style={[
                      s.pickRow,
                      on && { backgroundColor: T.accentSoft },
                      already && { opacity: 0.45 },
                    ]}
                  >
                    <Checkbox on={on || already} onToggle={() => toggle(sc.id)} />
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={already ? 1 : 0.7}
                      onPress={() => toggle(sc.id)}
                    >
                      <Text style={[s.pickName, { color: T.text }]} numberOfLines={1}>{sc.name}</Text>
                      <Text style={[s.pickMeta, { color: T.dim }]} numberOfLines={1}>
                        {[sc.city, sc.board].filter(Boolean).join(' • ')}
                      </Text>
                    </TouchableOpacity>
                    {already && <Text style={[s.pickMeta, { color: T.dim }]}>Assigned</Text>}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </FormModal>
  );
}

// ─── Reassign one school ──────────────────────────────────────────────────────
function ReassignModal({ school, onClose, onSaved }: {
  school: AnySchool; onClose: () => void; onSaved: () => void;
}) {
  const T = useAppTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    school.assignedToId ? Number(school.assignedToId) : null,
  );
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dashboardApi.getReportableUsers()
      .then(res => setMembers(normalizeMembers((res.data as any) || [])))
      .catch(() => {});
  }, []);

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
    <FormModal
      visible
      title="Reassign School"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label="Reassign"
            onPress={handleSave}
            loading={saving}
            disabled={!selectedUserId}
            small
            icon={<UserCheck size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <View style={[s.infoTile, { backgroundColor: T.cardAlt }]}>
          <Text style={[s.infoName, { color: T.text }]}>{school.name}</Text>
          <Text style={[s.infoMeta, { color: T.dim }]}>
            {[school.city, school.board].filter(Boolean).join(' • ') || DASH}
          </Text>
          {!!school.assignedToName && (
            <Text style={[s.infoMeta, { color: T.sub }]}>
              Currently: <Text style={{ fontWeight: '700' }}>{school.assignedToName}</Text>
            </Text>
          )}
        </View>

        <SelectPicker
          label="Assign To *"
          placeholder="Select user"
          options={members.map(m => ({ value: m.userId, label: m.name + (m.group ? ` (${m.group})` : '') }))}
          value={selectedUserId ?? undefined}
          onChange={v => setSelectedUserId(Number(v))}
          accentColor={T.accent}
        />

        <Field label="Visit Date *">
          <DateInput value={assignDate} onChange={setAssignDate} accentColor={T.accent} />
        </Field>
      </View>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const SchoolsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the table — never a card grid. Phones get list rows. */
  const table = isTabletDevice;

  const role = user?.role || 'FO';
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);
  const isFo = role === 'FO';
  /** Web parity, verbatim: `const canBeAssignee = ['ZH', 'RH'].includes(user.role)`. */
  const canBeAssignee = ['ZH', 'RH'].includes(role);
  const myUserId = user?.id;

  const [view, setView] = useState<ViewMode>('list');
  const [schools, setSchools] = useState<AnySchool[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [board, setBoard] = useState('');
  /**
   * Status filter removed: SchoolsController.GetSchools binds only
   * (page, limit, search, city, state, board, assignedTo) — `status` was never
   * bound, so ASP.NET silently dropped it and the dropdown did nothing.
   * SchoolListDto has no Status field either. Web has no Status filter.
   */
  const [foFilter, setFoFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [filterableUsers, setFilterableUsers] = useState<Member[]>([]);
  const [openDd, setOpenDd] = useState<'board' | 'assignee' | null>(null);

  const [mapSchools, setMapSchools] = useState<AnySchool[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [reassignSchool, setReassignSchool] = useState<AnySchool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnySchool | null>(null);

  // Web parity: every manager role uses getReportableUsers — the backend scopes it.
  useEffect(() => {
    if (!isManager) return;
    dashboardApi.getReportableUsers()
      .then(res => setFilterableUsers(normalizeMembers((res.data as any) || [])))
      .catch(() => {});
  }, [isManager]);

  const effectiveAssignedTo = onlyMine ? myUserId : (foFilter ? Number(foFilter) : undefined);

  const fetchSchools = useCallback(async (pg: number) => {
    try {
      // GET /schools takes `limit` (not pageSize) and returns
      // { schools, total, page, limit } — see SchoolsController.GetSchools,
      // which binds exactly: page, limit, search, city, state, board, assignedTo.
      const params = {
        page: pg,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        city: city.trim() || undefined,
        state: stateFilter.trim() || undefined,
        board: board || undefined,
        assignedTo: effectiveAssignedTo,
      };
      const res = await schoolsApi.getAll(params);
      const d: any = res.data;
      const list = d?.schools ?? d?.items ?? [];
      const total = d?.total ?? d?.totalCount ?? 0;
      setSchools(list);
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch {
      setSchools([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, city, stateFilter, board, effectiveAssignedTo]);

  // Any filter change resets to page 1.
  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSchools(1);
  }, [search, city, stateFilter, board, effectiveAssignedTo]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    setLoading(true);
    fetchSchools(p);
  };

  // Map needs every school with coordinates, not just the current page.
  useEffect(() => {
    if (view !== 'map') return;
    setMapLoading(true);
    // Web parity: the map honours the assignee filter too (Schools.jsx).
    const mapParams = {
      page: 1,
      limit: 500,
      search: search.trim() || undefined,
      assignedTo: foFilter ? Number(foFilter) : undefined,
    };
    schoolsApi.getAll(mapParams)
      .then(res => setMapSchools(((res.data as any)?.schools ?? []) as School[]))
      .catch(() => setMapSchools([]))
      .finally(() => setMapLoading(false));
  }, [view, search, foFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await schoolsApi.deleteSchool(id);
      setLoading(true);
      fetchSchools(page);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete school.');
    }
  };

  const pinned = useMemo(
    () => mapSchools.filter(sc => Number(sc.latitude) && Number(sc.longitude)),
    [mapSchools],
  );

  const assigneeOptions = useMemo(() => memberOptions(filterableUsers), [filterableUsers]);
  const selectedAssignee = filterableUsers.find(m => String(m.userId) === foFilter);

  const activeChips = [
    city ? { label: `City: ${city}`, clear: () => setCity('') } : null,
    stateFilter ? { label: `State: ${stateFilter}`, clear: () => setStateFilter('') } : null,
    board ? { label: board, clear: () => setBoard('') } : null,
    onlyMine ? { label: 'Assigned to me', clear: () => setOnlyMine(false) } : null,
    !onlyMine && selectedAssignee
      ? { label: `Assignee: ${selectedAssignee.name}`, clear: () => setFoFilter('') }
      : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const openDetail = (id: number) => navigation.navigate('SchoolDetail', { schoolId: id });

  // ── row actions ──
  const rowActions = (sc: AnySchool) => (
    <View style={s.actions}>
      {isManager && (
        <IconBtn kind="view" label="Reassign" onPress={() => setReassignSchool(sc)}>
          <UserCheck size={14} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
      )}
      <IconBtn kind="edit" label="Edit" onPress={() => navigation.navigate('AddSchool', { school: sc })}>
        <Edit2 size={14} color={T.sub} strokeWidth={ICON_STROKE} />
      </IconBtn>
      {!isFo && (
        <IconBtn kind="del" label="Delete" onPress={() => setDeleteTarget(sc)}>
          <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
        </IconBtn>
      )}
    </View>
  );

  // ── table (tablet) ──
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cName]}>School Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cCity]}>City</Text>
        <Text style={[s.th, { color: T.dim }, s.cState]}>State</Text>
        <Text style={[s.th, { color: T.dim }, s.cBoard]}>Board</Text>
        <Text style={[s.th, { color: T.dim }, s.cType]}>Type</Text>
        <Text style={[s.th, { color: T.dim }, s.cNum]}>Students</Text>
        <Text style={[s.th, { color: T.dim }, s.cNum]}>Contacts</Text>
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
      </View>

      {schools.map(sc => (
        <TouchableOpacity
          key={sc.id}
          activeOpacity={0.7}
          onPress={() => openDetail(sc.id)}
          style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
        >
          <View style={[s.cName, s.nameCell]}>
            <Avatar initials={initialsOf(sc.name)} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{sc.name}</Text>
              {isManager && (
                <Text style={[s.tdSub, { color: sc.assignedToName ? T.success : T.dim }]} numberOfLines={1}>
                  {sc.assignedToName || 'Unassigned'}
                </Text>
              )}
            </View>
          </View>
          <Text style={[s.td, { color: T.sub }, s.cCity]} numberOfLines={1}>{sc.city || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cState]} numberOfLines={1}>{sc.state || DASH}</Text>
          <View style={s.cBoard}>
            {sc.board ? <StatusBadge label={sc.board} color={T.info} /> : <Text style={[s.td, { color: T.dim }]}>{DASH}</Text>}
          </View>
          <Text style={[s.td, { color: T.sub }, s.cType]} numberOfLines={1}>{sc.type || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cNum]}>{sc.studentCount ?? DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cNum]}>{sc.contactCount ?? 0}</Text>
          <View style={s.cActions}>{rowActions(sc)}</View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {schools.map(sc => (
        <ListCard key={sc.id} onPress={() => openDetail(sc.id)}>
          <Avatar initials={initialsOf(sc.name)} />
          <View style={{ flex: 1 }}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{sc.name}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {[sc.city, sc.state, sc.type].filter(Boolean).join(' • ') || DASH}
            </Text>
            <View style={s.rowStats}>
              {!!sc.board && <StatusBadge label={sc.board} color={T.info} />}
              {/* SchoolListDto sends `IsActive`, never `Status` — the old
                  `label={sc.status}` rendered undefined on every row. */}
              <StatusBadge
                label={(sc as any).isActive === false ? 'Inactive' : 'Active'}
                color={(sc as any).isActive === false ? T.dim : T.success}
              />
              {sc.studentCount != null && (
                <View style={s.stat}>
                  <Users size={11} color={T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[s.statTxt, { color: T.dim }]}>{sc.studentCount}</Text>
                </View>
              )}
              <View style={s.stat}>
                <Phone size={11} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[s.statTxt, { color: T.dim }]}>{sc.contactCount ?? 0}</Text>
              </View>
            </View>
            {isManager && (
              <Text style={[s.tdSub, { color: sc.assignedToName ? T.success : T.dim }]} numberOfLines={1}>
                {sc.assignedToName || 'Unassigned'}
              </Text>
            )}
          </View>
          {rowActions(sc)}
        </ListCard>
      ))}
    </View>
  );

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchSchools(page); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Header: view toggle + assign + add */}
        <View style={[s.header, wide && s.headerWide]}>
          <Segmented<ViewMode>
            value={view}
            onChange={setView}
            style={wide ? { width: 200 } : undefined}
            options={[{ label: 'List', value: 'list' }, { label: 'Map', value: 'map' }]}
          />
          <View style={s.headerBtns}>
            {/* Ungated, matching web: Schools.jsx renders Assign School for every role. */}
            <Btn
              label="Assign School"
              variant="soft"
              small
              onPress={() => setShowAssign(true)}
              icon={<Navigation size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
            />
            <Btn
              label="Add School"
              small
              onPress={() => navigation.navigate('AddSchool')}
              icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </View>
        </View>

        {/* Search + filters + count */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search schools by name or city…"
              style={{ flex: 1, minWidth: 180 }}
            />
            {view === 'list' && (
              <Trigger
                label="Filters"
                open={showFilters}
                onPress={() => setShowFilters(v => !v)}
                icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              />
            )}
            {/* Web parity, verbatim gate: canBeAssignee = ['ZH','RH'].includes(role).
                Sends assignedTo = my own userId. */}
            {view === 'list' && canBeAssignee && (
              <Trigger
                label="Assigned to me"
                open={onlyMine}
                onPress={() => setOnlyMine(v => !v)}
                icon={
                  <UserCheck
                    size={14}
                    color={onlyMine ? T.accent : T.sub}
                    strokeWidth={ICON_STROKE}
                  />
                }
              />
            )}
          </View>

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>
              {view === 'map'
                ? `${pinned.length} on map`
                : `${totalCount} school${totalCount === 1 ? '' : 's'}`}
            </Text>
            {activeChips.length > 0 && (
              <View style={s.chipWrap}>
                {activeChips.map(c => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
              </View>
            )}
          </View>

          {view === 'list' && showFilters && (
            <View style={[s.filters, { borderTopColor: T.line }]}>
              <Input label="City" value={city} onChangeText={setCity} placeholder="Any city" />

              {/* SchoolsController.GetSchools binds `[FromQuery] string? state`. */}
              <Input label="State" value={stateFilter} onChangeText={setStateFilter} placeholder="Any state" />

              <Field label="Board">
                <Trigger
                  label={board || 'All Boards'}
                  open={openDd === 'board'}
                  onPress={() => setOpenDd(openDd === 'board' ? null : 'board')}
                />
                {openDd === 'board' && (
                  <Dropdown
                    style={{ width: '100%' }}
                    value={board}
                    onSelect={v => { setBoard(v === board ? '' : v); setOpenDd(null); }}
                    options={BOARDS.map(b => ({ label: b, value: b }))}
                  />
                )}
              </Field>

              {/* Web parity: manager-only assignee filter → `assignedTo`.
                  The "Assigned to me" toggle wins over it, exactly as web's
                  `onlyMine ? myUserId : (foFilter ? Number(foFilter) : undefined)`. */}
              {isManager && (
                <Field label="Assignee">
                  <Trigger
                    label={
                      onlyMine
                        ? 'Assigned to me'
                        : selectedAssignee
                          ? `${selectedAssignee.name} · ${selectedAssignee.role}`
                          : 'All Assignees'
                    }
                    open={openDd === 'assignee'}
                    onPress={() => setOpenDd(openDd === 'assignee' ? null : 'assignee')}
                  />
                  {openDd === 'assignee' && (
                    <Dropdown
                      style={{ width: '100%' }}
                      maxHeight={260}
                      value={foFilter}
                      onSelect={v => {
                        setFoFilter(v === foFilter ? '' : v);
                        if (v) setOnlyMine(false);
                        setOpenDd(null);
                      }}
                      options={[{ label: 'All Assignees', value: '' }, ...assigneeOptions]}
                    />
                  )}
                </Field>
              )}

              {/* Status filter removed — see the `foFilter` state note: the controller
                  never bound `status`, so the dropdown was a silent no-op.

                  "Priority schools only" was removed: it called GET /schools/priority,
                  a route no controller serves, so ticking it could only ever return
                  zero schools. Restore it alongside a real backend endpoint. */}
            </View>
          )}
        </View>

        {/* ── LIST ── */}
        {view === 'list' && (
          loading ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
          ) : schools.length === 0 ? (
            <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
              <Icon name="Schools" size={34} color={T.dim} />
              <Text style={[s.emptyTitle, { color: T.text }]}>
                {isFo ? 'No schools assigned to you yet' : 'No schools found'}
              </Text>
              <Text style={[s.emptyTxt, { color: T.dim }]}>
                {isFo ? 'Your manager will assign schools for visits.' : 'Try adjusting your search or filters.'}
              </Text>
            </View>
          ) : (
            <>
              {table ? renderTable() : renderRows()}
              {totalPages > 1 && (
                <View style={s.pgRow}>
                  <Text style={[s.count, { color: T.dim }]}>
                    Showing {from}{DASH}{to} of {totalCount}
                  </Text>
                  <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
                </View>
              )}
            </>
          )
        )}

        {/* ── MAP ── */}
        {view === 'map' && (
          mapLoading ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
          ) : pinned.length === 0 ? (
            <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
              <MapPin size={34} color={T.dim} strokeWidth={ICON_STROKE} />
              <Text style={[s.emptyTitle, { color: T.text }]}>No schools with locations</Text>
              <Text style={[s.emptyTxt, { color: T.dim }]}>Add coordinates to a school to see it here.</Text>
            </View>
          ) : (
            <View style={[s.mapWrap, { borderColor: T.line }, wide && { height: 520 }]}>
              <MapView
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: Number(pinned[0].latitude),
                  longitude: Number(pinned[0].longitude),
                  latitudeDelta: 0.4,
                  longitudeDelta: 0.4,
                }}
              >
                {pinned.map(sc => (
                  <Marker
                    key={sc.id}
                    coordinate={{ latitude: Number(sc.latitude), longitude: Number(sc.longitude) }}
                    title={sc.name}
                    pinColor={T.accent}
                  >
                    <Callout onPress={() => openDetail(sc.id)}>
                      <View style={s.callout}>
                        <Text style={s.calloutName} numberOfLines={2}>{sc.name}</Text>
                        <Text style={s.calloutMeta} numberOfLines={1}>
                          {[sc.city, sc.state].filter(Boolean).join(', ') || DASH}
                        </Text>
                        <Text style={s.calloutMeta} numberOfLines={1}>
                          {[sc.board, sc.type].filter(Boolean).join(' • ')}
                        </Text>
                        <Text style={s.calloutLink}>View details</Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}
              </MapView>
            </View>
          )
        )}
      </ScrollView>

      {showAssign && <AssignModal onClose={() => setShowAssign(false)} />}

      {reassignSchool && (
        <ReassignModal
          school={reassignSchool}
          onClose={() => setReassignSchool(null)}
          onSaved={() => { setReassignSchool(null); setLoading(true); fetchSchools(page); }}
        />
      )}

      <ConfirmModal
        visible={!!deleteTarget}
        tone="danger"
        title="Delete School?"
        message={`${deleteTarget?.name ?? 'This school'} will be deactivated. You can reactivate it later.`}
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filters: { borderTopWidth: 1, paddingTop: 12, gap: 12 },

  // table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line · pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cName: { flex: 2.4 },
  cCity: { flex: 1.1 },
  cState: { flex: 1.1 },
  cBoard: { flex: 1.1 },
  cType: { flex: 1 },
  cNum: { flex: 0.8 },
  cActions: { width: 108 }, // header <Text> ignores alignItems — keep both left so
                            // the icons line up under the ACTIONS label (web parity)
  actions: { flexDirection: 'row', gap: 6 },

  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTxt: { fontSize: rf(11), fontWeight: '600' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 18 },

  mapWrap: { height: 460, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  callout: { width: 190, paddingVertical: 2, gap: 1 },
  calloutName: { fontSize: rf(13), fontWeight: '700' },
  calloutMeta: { fontSize: rf(11), fontWeight: '500' },
  calloutLink: { fontSize: rf(11), fontWeight: '700', marginTop: 3 },

  // modals
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTile: { borderRadius: 13, padding: 12, gap: 2 },
  infoName: { fontSize: rf(13.5), fontWeight: '700' },
  infoMeta: { fontSize: rf(11.5), fontWeight: '500' },
  loadTxt: { fontSize: rf(12.5), fontWeight: '500' },
  smallCap: { fontSize: rf(10), fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 },
  pickList: { borderRadius: 13, borderWidth: 1, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 11 },
  pickName: { fontSize: rf(13), fontWeight: '600' },
  pickMeta: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  footNote: { flex: 1, fontSize: rf(12.5), fontWeight: '500' },
});
