import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, Map, MapPin, Check, Info, Users, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi, PlacementUserDto, PlacementTransfer } from '../../api/auth';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge,
  ListCard, FormModal, ConfirmModal, Checkbox,
} from '../../components/crud';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

const DASH = '—';

type PlacementKind = 'region' | 'zone';
type Option = { label: string; value: string };
/** userId → target region/zone id (as a string, the Dropdown's value type). */
type Assignments = Record<number, string>;

/** A region/zone delete the server refused because people (or zones) are still inside. */
interface TransferItem {
  type: PlacementKind;
  id: number;
  name: string;
  users: PlacementUserDto[];
  zones: { id: number; name: string }[];
}

const TRANSFER_ROLES = ['ALL', 'FO', 'ZH', 'RH', 'SH', 'SCA'];

/**
 * Where a region/zone's people may move: any other region, or any other zone — for an RH
 * only zones inside its own region (web RegionsZones.jsx transferTargetOptions; the server's
 * AllowedTargetZonesAsync rejects anything else). `rhRegionId` undefined = no RH limit.
 */
const transferTargets = (
  kind: PlacementKind, excludeId: number, regions: any[], zones: any[], rhRegionId?: number | null,
): Option[] =>
  kind === 'region'
    ? regions.filter(r => r.id !== excludeId).map(r => ({ label: r.name, value: String(r.id) }))
    : zones
        .filter(z => z.id !== excludeId && (rhRegionId === undefined || z.regionId === rhRegionId))
        .map(z => ({ label: `${z.name}${z.region ? ` (${z.region})` : ''}`, value: String(z.id) }));

/** Assignments → the `userTransfers` list the API takes, skipping anyone not assigned. */
const toTransfers = (a: Assignments): PlacementTransfer[] =>
  Object.entries(a)
    .filter(([, targetId]) => !!targetId)
    .map(([userId, targetId]) => ({ userId: Number(userId), targetId: Number(targetId) }));

/**
 * The people list + bulk "Move selected to…" control shared by the delete-transfer modal
 * and the edit modal's optional transfer (web RegionsZones.jsx:147-265). Tick rows, pick a
 * target, Assign — each assigned row shows "→ target". Assigning one row at a time is how a
 * per-user target is set.
 */
function AssignUsers({
  users, kind, targets, assignments, onAssign, bulkTargetId, setBulkTargetId,
  regions, zones, busy, withFilters,
}: {
  users: PlacementUserDto[];
  kind: PlacementKind;
  targets: Option[];
  assignments: Assignments;
  onAssign: (userIds: number[], targetId: string) => void;
  bulkTargetId: string;
  setBulkTargetId: (v: string) => void;
  regions: any[];
  zones: any[];
  busy?: boolean;
  withFilters?: boolean;
}) {
  const T = useAppTheme();
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [openBulk, setOpenBulk] = useState(false);

  const shown = useMemo(() => {
    if (!withFilters) return users;
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      (roleFilter === 'ALL' || u.role === roleFilter) &&
      (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)));
  }, [users, withFilters, search, roleFilter]);

  const allShownChecked = shown.length > 0 && shown.every(u => selected[u.id]);
  const checkedIds = Object.keys(selected).filter(id => selected[Number(id)]).map(Number);
  const assignedCount = Object.values(assignments).filter(Boolean).length;

  const toggleAllShown = () =>
    setSelected(prev => {
      const next = { ...prev };
      shown.forEach(u => { next[u.id] = !allShownChecked; });
      return next;
    });

  const assign = () => {
    if (!bulkTargetId || checkedIds.length === 0) return;
    onAssign(checkedIds, bulkTargetId);
    setSelected({});
  };

  return (
    <View style={{ gap: 10 }}>
      {withFilters && (
        <>
          <Input value={search} onChangeText={setSearch} placeholder="Search by name or email…" autoCapitalize="none" />
          <View style={s.chipRow}>
            {TRANSFER_ROLES.map(r => {
              const on = roleFilter === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRoleFilter(r)}
                  activeOpacity={0.7}
                  style={[s.chip, { backgroundColor: on ? T.accent : T.cardAlt }]}
                >
                  <Text style={[s.chipTxt, { color: on ? '#FFF' : T.sub }]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <View style={s.xfHeadRow}>
        <Text style={[s.xfCount, { color: T.dim }]}>
          {shown.length} shown{shown.length !== users.length ? ` of ${users.length}` : ''} · {assignedCount} assigned
        </Text>
        <TouchableOpacity onPress={toggleAllShown} hitSlop={8} disabled={busy || shown.length === 0}>
          <Text style={[s.xfAll, { color: T.accent }]}>{allShownChecked ? 'Deselect all' : 'Select all'}</Text>
        </TouchableOpacity>
      </View>

      {shown.length === 0 ? (
        <Text style={[s.xfCount, { color: T.dim, textAlign: 'center', paddingVertical: 10 }]}>No users match the filter.</Text>
      ) : shown.map(u => {
        const place = zones.find((z: any) => z.id === u.zoneId)?.name || regions.find((r: any) => r.id === u.regionId)?.name;
        const target = assignments[u.id] ? targets.find(o => o.value === assignments[u.id])?.label : null;
        const on = !!selected[u.id];
        return (
          <View
            key={u.id}
            style={[s.xfRow, {
              borderColor: on ? withAlpha(T.accent, 0.35) : T.line,
              backgroundColor: on ? withAlpha(T.accent, 0.12) : T.cardAlt,
            }]}
          >
            <Checkbox on={on} onToggle={() => !busy && setSelected(p => ({ ...p, [u.id]: !p[u.id] }))} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.xfName, { color: T.text }]} numberOfLines={1}>{u.name || DASH}</Text>
              <Text style={[s.xfMeta, { color: T.dim }]} numberOfLines={1}>{u.role}{place ? ` · ${place}` : ''}</Text>
            </View>
            {!!target && (
              <View style={[s.xfTarget, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
                <Text style={[s.xfTargetTxt, { color: T.success }]} numberOfLines={1}>→ {target}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={[s.bulkRow, { borderTopColor: T.line }]}>
        {targets.length === 0 ? (
          <Text style={[s.xfCount, { color: T.warning }]}>
            No other {kind === 'region' ? 'regions' : 'zones'} to transfer to.
          </Text>
        ) : (
          <>
            <Field style={{ flex: 1, zIndex: 10 }}>
              <Trigger
                label={targets.find(o => o.value === bulkTargetId)?.label || `Move selected to ${kind}…`}
                open={openBulk}
                onPress={() => !busy && setOpenBulk(v => !v)}
              />
              {openBulk && (
                <Dropdown
                  style={s.ddFull}
                  maxHeight={200}
                  value={bulkTargetId}
                  onSelect={(v) => { setBulkTargetId(String(v)); setOpenBulk(false); }}
                  options={targets}
                />
              )}
            </Field>
            <Btn
              label="Assign"
              small
              onPress={assign}
              disabled={busy || !bulkTargetId || checkedIds.length === 0}
              style={{ alignSelf: 'flex-start' }}
            />
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Transfer & delete — opened when DELETE regions|zones/{id} (no body) answers with the
 * people still inside. Every user needs a target before the delete is resent with
 * `{ userTransfers }`; the server is fail-closed and moves nothing if any is missing.
 * A region's zones are deleted along with it. Quick-create adds a new region/zone to move
 * into without leaving the modal.
 */
function TransferDeleteModal({ item, regions, zones, selectableRegions, rhRegionId, onClose, onDone, reload }: {
  item: TransferItem;
  regions: any[];
  zones: any[];
  /** Regions a quick-created zone may go under (an RH: only its own). */
  selectableRegions: any[];
  rhRegionId?: number | null;
  onClose: () => void;
  onDone: (msg: string) => void;
  /** Re-fetch regions/zones without the full-screen spinner (which would unmount this). */
  reload: () => Promise<void>;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [assignments, setAssignments] = useState<Assignments>({});
  const [bulkTargetId, setBulkTargetId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [showQuick, setShowQuick] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickRegionId, setQuickRegionId] = useState(rhRegionId ? String(rhRegionId) : '');
  const [openQuickDd, setOpenQuickDd] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);

  const isRegion = item.type === 'region';
  const noun = isRegion ? 'region' : 'zone';
  const targets = transferTargets(item.type, item.id, regions, zones, rhRegionId);
  const unassigned = item.users.some(u => !assignments[u.id]);

  const onAssign = (ids: number[], targetId: string) =>
    setAssignments(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = targetId; });
      return next;
    });

  const quickCreate = async () => {
    const name = quickName.trim();
    if (!name) return;
    if (!isRegion && !quickRegionId) { Alert.alert('Error', 'Select a region for the new zone'); return; }
    setQuickCreating(true);
    try {
      const res = isRegion
        ? await authApi.createRegion(name)
        : await authApi.createZone(name, Number(quickRegionId));
      const newId = (res.data as any)?.id;
      setQuickName('');
      setShowQuick(false);
      await reload();
      if (newId) setBulkTargetId(String(newId)); // auto-select it in "Move selected to…"
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create');
    } finally {
      setQuickCreating(false);
    }
  };

  const transfer = async () => {
    if (unassigned) return;
    setTransferring(true);
    try {
      const body = { userTransfers: item.users.map(u => ({ userId: u.id, targetId: Number(assignments[u.id]) })) };
      if (isRegion) await authApi.deleteRegion(item.id, body);
      else await authApi.deleteZone(item.id, body);
      onDone(`Users transferred and ${noun} "${item.name}" deleted`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const quickRegionOptions = selectableRegions.map((r: any) => ({ label: r.name, value: String(r.id) }));

  return (
    <FormModal
      visible
      wide={wide}
      title={`Transfer & Delete ${isRegion ? 'Region' : 'Zone'}`}
      onClose={() => { if (!transferring) onClose(); }}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} disabled={transferring} small />
          <Btn
            label={transferring ? 'Transferring…' : item.users.length > 0 ? 'Transfer & Delete' : 'Delete'}
            variant="danger"
            onPress={transfer}
            loading={transferring}
            disabled={transferring || unassigned}
            small
          />
        </>
      }
    >
      <View style={{ gap: 14 }}>
        <Text style={[s.xfIntro, { color: T.sub }]}>
          "{item.name}" · {item.users.length} user{item.users.length !== 1 ? 's' : ''} to reassign
          {item.zones.length > 0 ? ` · ${item.zones.length} zone${item.zones.length !== 1 ? 's' : ''} to delete` : ''}
        </Text>

        {isRegion && item.zones.length > 0 && (
          <View style={[s.notice, { backgroundColor: withAlpha(T.danger, 0.12), borderColor: withAlpha(T.danger, 0.2) }]}>
            <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.noticeTxt, { color: T.danger }]}>
              {item.zones.length} zone{item.zones.length !== 1 ? 's' : ''} ({item.zones.map(z => z.name).join(', ')}) will be
              permanently deleted along with this region.
            </Text>
          </View>
        )}

        {item.users.length > 0 && (
          <AssignUsers
            users={item.users}
            kind={item.type}
            targets={targets}
            assignments={assignments}
            onAssign={onAssign}
            bulkTargetId={bulkTargetId}
            setBulkTargetId={setBulkTargetId}
            regions={regions}
            zones={zones}
            busy={transferring || showQuick}
            withFilters
          />
        )}

        {!showQuick ? (
          <TouchableOpacity
            onPress={() => setShowQuick(true)}
            disabled={transferring}
            style={s.quickLink}
            hitSlop={6}
          >
            <Plus size={14} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[s.quickLinkTxt, { color: T.accent }]}>Create a new {noun} to transfer into</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.quickBox, { backgroundColor: withAlpha(T.accent, 0.1), borderColor: withAlpha(T.accent, 0.25) }]}>
            <Text style={[s.quickTitle, { color: T.accent }]}>New {isRegion ? 'Region' : 'Zone'}</Text>
            <Input
              value={quickName}
              onChangeText={setQuickName}
              placeholder={isRegion ? 'Region name' : 'Zone name'}
              editable={!quickCreating}
            />
            {!isRegion && (
              quickRegionOptions.length === 0 ? (
                <Text style={[s.xfCount, { color: T.warning }]}>
                  No regions exist. Close this and create a region first.
                </Text>
              ) : (
                <Field style={{ zIndex: 10 }}>
                  <Trigger
                    label={quickRegionOptions.find(o => o.value === quickRegionId)?.label || 'Under which region?'}
                    open={openQuickDd}
                    onPress={() => setOpenQuickDd(v => !v)}
                  />
                  {openQuickDd && (
                    <Dropdown
                      style={s.ddFull}
                      maxHeight={200}
                      value={quickRegionId}
                      onSelect={(v) => { setQuickRegionId(String(v)); setOpenQuickDd(false); }}
                      options={quickRegionOptions}
                    />
                  )}
                </Field>
              )
            )}
            <View style={s.quickBtns}>
              <Btn
                label="Cancel"
                variant="secondary"
                small
                disabled={quickCreating}
                onPress={() => { setShowQuick(false); setQuickName(''); }}
              />
              <Btn
                label={quickCreating ? 'Creating…' : 'Create & Select'}
                small
                loading={quickCreating}
                disabled={quickCreating || !quickName.trim() || (!isRegion && !quickRegionId)}
                onPress={quickCreate}
              />
            </View>
          </View>
        )}
      </View>
    </FormModal>
  );
}

/**
 * Edit modal's optional "Also transfer users" (SH/SCA, like web). Collapsed by default;
 * expanding loads GET regions|zones/{id}/users. Assignments are lifted to the screen so
 * Save can POST them to transfer-users after the rename. Collapsing discards them.
 */
function EditTransferSection({ kind, id, targets, regions, zones, assignments, setAssignments }: {
  kind: PlacementKind;
  id: number;
  targets: Option[];
  regions: any[];
  zones: any[];
  assignments: Assignments;
  setAssignments: React.Dispatch<React.SetStateAction<Assignments>>;
}) {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<PlacementUserDto[]>([]);
  const [bulkTargetId, setBulkTargetId] = useState('');
  const assignedCount = Object.values(assignments).filter(Boolean).length;

  const toggle = async () => {
    if (open) {
      setOpen(false);
      setAssignments({});
      setBulkTargetId('');
      return;
    }
    setLoadingUsers(true);
    try {
      const res = kind === 'region' ? await authApi.getRegionUsers(id) : await authApi.getZoneUsers(id);
      setUsers(Array.isArray(res.data) ? res.data : []);
      setOpen(true);
    } catch {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <View style={[s.editXf, { borderColor: T.line }]}>
      <TouchableOpacity
        onPress={toggle}
        disabled={loadingUsers}
        activeOpacity={0.7}
        style={[s.editXfHead, { backgroundColor: T.cardAlt }]}
      >
        {loadingUsers
          ? <ActivityIndicator size="small" color={T.accent} />
          : <Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
        <Text style={[s.editXfTitle, { color: T.text }]} numberOfLines={1}>
          {loadingUsers ? 'Loading users…' : `Also transfer users to another ${kind}?`}
        </Text>
        {assignedCount > 0 && <StatusBadge label={`${assignedCount} assigned`} color={T.accent} />}
        {open
          ? <ChevronUp size={15} color={T.dim} strokeWidth={ICON_STROKE} />
          : <ChevronDown size={15} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>
      {open && (
        <View style={{ padding: 12 }}>
          {users.length === 0 ? (
            <Text style={[s.xfCount, { color: T.dim, textAlign: 'center', paddingVertical: 8 }]}>
              No users directly in this {kind}.
            </Text>
          ) : (
            <AssignUsers
              users={users}
              kind={kind}
              targets={targets}
              assignments={assignments}
              onAssign={(ids, targetId) => setAssignments(prev => {
                const next = { ...prev };
                ids.forEach(uid => { next[uid] = targetId; });
                return next;
              })}
              bulkTargetId={bulkTargetId}
              setBulkTargetId={setBulkTargetId}
              regions={regions}
              zones={zones}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const RegionsZonesScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad gets a real table; phones get list rows. */
  const table = isTabletDevice;

  const role = user?.role || 'FO';

  const canManageRegions = role === 'SH' || role === 'SCA';
  const canManageZones = ['RH', 'SH', 'SCA'].includes(role);
  const isRhScoped = role === 'RH';

  const [regions, setRegions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [zoneRegionFilter, setZoneRegionFilter] = useState('ALL');
  const [openFilterDd, setOpenFilterDd] = useState(false);

  // Region create/edit modal
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<any>(null);
  const [regionName, setRegionName] = useState('');
  const [savingRegion, setSavingRegion] = useState(false);

  // Zone create/edit modal
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneRegionId, setZoneRegionId] = useState('');
  const [openZoneDd, setOpenZoneDd] = useState(false);
  const [savingZone, setSavingZone] = useState(false);

  // Delete confirm
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  // Delete refused because people/zones are inside → transfer modal
  const [transferItem, setTransferItem] = useState<TransferItem | null>(null);
  // Edit modal's optional user transfer (SH/SCA)
  const [editAssignments, setEditAssignments] = useState<Assignments>({});
  /** An RH may only move people into zones of its own region; undefined = no limit. */
  const rhRegionId = isRhScoped ? (user?.regionId ?? null) : undefined;

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (isRhScoped && user?.regionId) {
      setZoneRegionFilter(String(user.regionId));
    }
  }, [isRhScoped, user?.regionId]);

  const showFlash = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3500);
  };

  /** `silent` keeps the screen (and any open modal) mounted — no full-screen spinner. */
  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [regRes, zonesRes] = await Promise.all([
        authApi.getRegions().catch(() => ({ data: [] })),
        authApi.getZones().catch(() => ({ data: [] })),
      ]);
      setRegions((regRes.data as any) || []);
      setZones((zonesRes.data as any) || []);
    } finally {
      setLoading(false);
    }
  }

  const selectableRegions = useMemo(() => {
    if (isRhScoped) return user?.regionId ? regions.filter((r: any) => r.id === user.regionId) : [];
    return regions;
  }, [regions, isRhScoped, user?.regionId]);

  const visibleRegions = isRhScoped && user?.regionId
    ? regions.filter((r: any) => r.id === user.regionId)
    : regions;

  const filteredZones = useMemo(() => {
    let list = zones;
    if (isRhScoped && user?.regionId) list = list.filter((z: any) => z.regionId === user.regionId);
    if (zoneRegionFilter !== 'ALL') list = list.filter((z: any) => z.regionId === Number(zoneRegionFilter));
    return list;
  }, [zones, zoneRegionFilter, isRhScoped, user?.regionId]);

  const regionNameById = (id: any) => regions.find((r: any) => r.id === Number(id))?.name;

  // Filter options — labels are NAMES (with counts), never ids.
  const regionFilterOptions = [
    { value: 'ALL', label: `All regions (${zones.length})` },
    ...regions.map((r: any) => ({
      value: String(r.id),
      label: `${r.name} (${zones.filter((z: any) => z.regionId === r.id).length})`,
    })),
  ];
  const filterLabel = regionFilterOptions.find(o => o.value === zoneRegionFilter)?.label || 'All regions';

  // ── Region modal open/save ──────────────────────────────────────────────────
  const openCreateRegion = () => {
    setEditingRegion(null);
    setRegionName('');
    setShowRegionModal(true);
  };
  const openEditRegion = (r: any) => {
    setEditingRegion(r);
    setEditAssignments({});
    setRegionName(r.name || '');
    setShowRegionModal(true);
  };
  const saveRegion = async () => {
    const name = regionName.trim();
    if (!name) return;
    setSavingRegion(true);
    try {
      if (editingRegion) {
        await authApi.updateRegion(editingRegion.id, name);
        // Optional transfer chosen in the edit modal — after the rename, like web.
        const transfers = toTransfers(editAssignments);
        if (transfers.length > 0) await authApi.transferRegionUsers(editingRegion.id, { userTransfers: transfers });
        showFlash('success', `Region updated${transfers.length > 0 ? ` · ${transfers.length} user${transfers.length !== 1 ? 's' : ''} transferred` : ''}`);
      } else {
        await authApi.createRegion(name);
        showFlash('success', `Region "${name}" created`);
      }
      setShowRegionModal(false);
      await refresh();
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message || 'Failed to save region');
    } finally {
      setSavingRegion(false);
    }
  };

  // ── Zone modal open/save ────────────────────────────────────────────────────
  const openCreateZone = () => {
    setEditingZone(null);
    setZoneName('');
    setOpenZoneDd(false);
    // RH is auto-pinned to their own region; others start empty (or the active filter).
    setZoneRegionId(
      isRhScoped && user?.regionId
        ? String(user.regionId)
        : (zoneRegionFilter !== 'ALL' ? zoneRegionFilter : ''),
    );
    setShowZoneModal(true);
  };
  const openEditZone = (z: any) => {
    setEditingZone(z);
    setEditAssignments({});
    setZoneName(z.name || '');
    setOpenZoneDd(false);
    setZoneRegionId(z.regionId ? String(z.regionId) : '');
    setShowZoneModal(true);
  };
  const saveZone = async () => {
    const name = zoneName.trim();
    const regionId = isRhScoped && user?.regionId ? Number(user.regionId) : Number(zoneRegionId);
    if (!name || !regionId) return;
    setSavingZone(true);
    try {
      if (editingZone) {
        await authApi.updateZone(editingZone.id, name, regionId);
        const transfers = toTransfers(editAssignments);
        if (transfers.length > 0) await authApi.transferZoneUsers(editingZone.id, { userTransfers: transfers });
        showFlash('success', `Zone updated${transfers.length > 0 ? ` · ${transfers.length} user${transfers.length !== 1 ? 's' : ''} transferred` : ''}`);
      } else {
        await authApi.createZone(name, regionId);
        showFlash('success', `Zone "${name}" created`);
      }
      setShowZoneModal(false);
      await refresh();
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message || 'Failed to save zone');
    } finally {
      setSavingZone(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      if (deleteItem.type === 'region') {
        await authApi.deleteRegion(deleteItem.id);
      } else {
        await authApi.deleteZone(deleteItem.id);
      }
      const label = deleteItem.name;
      setDeleteItem(null);
      await refresh();
      showFlash('success', `"${label}" deleted`);
    } catch (err: any) {
      // A body-less DELETE is a probe: a region/zone with people (or a region with zones)
      // answers 400 with `{ users, zones }` — open the transfer modal from that payload.
      const payload = err?.response?.data?.data;
      if (payload && (Array.isArray(payload.users) || Array.isArray(payload.zones))) {
        setTransferItem({
          type: deleteItem.type,
          id: deleteItem.id,
          name: deleteItem.name,
          users: payload.users || [],
          zones: payload.zones || [],
        });
      } else {
        showFlash('error', err?.response?.data?.message || 'Failed to delete');
      }
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading…" />;

  // ── Shared bits ─────────────────────────────────────────────────────────────
  const rowActions = (onEdit: () => void, onDelete: () => void) => (
    <View style={s.actions}>
      <IconBtn kind="edit" label="Edit" onPress={onEdit}>
        <Edit2 size={14} color={T.sub} strokeWidth={ICON_STROKE} />
      </IconBtn>
      <IconBtn kind="del" label="Delete" onPress={onDelete}>
        <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
      </IconBtn>
    </View>
  );

  const iconTile = (color: string, icon: React.ReactNode) => (
    <View style={[s.tile, { backgroundColor: withAlpha(color, SOFT_TINT) }]}>{icon}</View>
  );

  const emptyCard = (msg: string, icon: React.ReactNode) => (
    <View style={[s.empty, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
      {icon}
      <Text style={[s.emptyTxt, { color: T.dim }]}>{msg}</Text>
    </View>
  );

  const infoBanner = (msg: string) => (
    <View style={[s.notice, { backgroundColor: withAlpha(T.warning, 0.12), borderColor: withAlpha(T.warning, 0.2) }]}>
      <Info size={14} color={T.warning} strokeWidth={ICON_STROKE} />
      <Text style={[s.noticeTxt, { color: T.warning }]}>{msg}</Text>
    </View>
  );

  // ── Regions: table (tablet) / rows (phone) ──────────────────────────────────
  const renderRegionsTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cRegName]}>Region</Text>
        <Text style={[s.th, { color: T.dim }, s.cCount]}>Zones</Text>
        {canManageRegions && <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>}
      </View>
      {visibleRegions.map((r: any) => (
        <View key={r.id} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={[s.cRegName, s.nameCell]}>
            {iconTile(T.info, <Map size={15} color={T.info} strokeWidth={ICON_STROKE} />)}
            <Text style={[s.tdName, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>{r.name}</Text>
          </View>
          <View style={s.cCount}>
            <StatusBadge label={`${r.zoneCount || 0}`} color={T.info} />
          </View>
          {canManageRegions && (
            <View style={s.cActions}>
              {rowActions(
                () => openEditRegion(r),
                () => setDeleteItem({ type: 'region', id: r.id, name: r.name }),
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderRegionsRows = () => (
    <View style={{ gap: 8 }}>
      {visibleRegions.map((r: any) => (
        <ListCard key={r.id}>
          {iconTile(T.info, <Map size={16} color={T.info} strokeWidth={ICON_STROKE} />)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{r.name}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {r.zoneCount || 0} zone{(r.zoneCount || 0) === 1 ? '' : 's'}
            </Text>
          </View>
          {canManageRegions && rowActions(
            () => openEditRegion(r),
            () => setDeleteItem({ type: 'region', id: r.id, name: r.name }),
          )}
        </ListCard>
      ))}
    </View>
  );

  // ── Zones: table (tablet) / rows (phone) ────────────────────────────────────
  const renderZonesTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cZoneName]}>Zone</Text>
        <Text style={[s.th, { color: T.dim }, s.cZoneRegion]}>Region</Text>
        {canManageZones && <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>}
      </View>
      {filteredZones.map((z: any) => (
        <View key={z.id} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={[s.cZoneName, s.nameCell]}>
            {iconTile(T.accent, <MapPin size={15} color={T.accent} strokeWidth={ICON_STROKE} />)}
            <Text style={[s.tdName, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>{z.name}</Text>
          </View>
          <Text style={[s.td, { color: T.sub }, s.cZoneRegion]} numberOfLines={1}>
            {z.region || regionNameById(z.regionId) || DASH}
          </Text>
          {canManageZones && (
            <View style={s.cActions}>
              {rowActions(
                () => openEditZone(z),
                () => setDeleteItem({ type: 'zone', id: z.id, name: z.name }),
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderZonesRows = () => (
    <View style={{ gap: 8 }}>
      {filteredZones.map((z: any) => (
        <ListCard key={z.id}>
          {iconTile(T.accent, <MapPin size={16} color={T.accent} strokeWidth={ICON_STROKE} />)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{z.name}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {z.region || regionNameById(z.regionId) || 'No region'}
            </Text>
          </View>
          {canManageZones && rowActions(
            () => openEditZone(z),
            () => setDeleteItem({ type: 'zone', id: z.id, name: z.name }),
          )}
        </ListCard>
      ))}
    </View>
  );

  // ── Section shells ──────────────────────────────────────────────────────────
  const regionsSection = (
    <View style={[s.section, wide && s.sectionCol, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={s.sectionHead}>
        {iconTile(T.info, <Map size={18} color={T.info} strokeWidth={ICON_STROKE} />)}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.sectionTitle, { color: T.text }]} numberOfLines={1}>
            Regions <Text style={{ color: T.dim, fontWeight: '500' }}>({visibleRegions.length})</Text>
          </Text>
          <Text style={[s.sectionSub, { color: T.dim }]} numberOfLines={1}>
            {canManageRegions ? 'Top-level regions' : isRhScoped ? 'Your assigned region' : 'Managed by Sales Head'}
          </Text>
        </View>
        {canManageRegions && (
          <Btn
            label="Add"
            small
            onPress={openCreateRegion}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        )}
      </View>

      {visibleRegions.length === 0
        ? emptyCard(
            canManageRegions ? 'No regions yet. Add one to get started.' : 'No region assigned.',
            <Map size={26} color={T.dim} strokeWidth={ICON_STROKE} />,
          )
        : table ? renderRegionsTable() : renderRegionsRows()}
    </View>
  );

  const zonesSection = (
    <View style={[s.section, wide && s.sectionCol, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={s.sectionHead}>
        {iconTile(T.accent, <MapPin size={18} color={T.accent} strokeWidth={ICON_STROKE} />)}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.sectionTitle, { color: T.text }]} numberOfLines={1}>
            Zones <Text style={{ color: T.dim, fontWeight: '500' }}>({filteredZones.length})</Text>
          </Text>
          <Text style={[s.sectionSub, { color: T.dim }]} numberOfLines={1}>
            {canManageZones ? 'Add zones to a region' : 'Read-only'}
          </Text>
        </View>
        {canManageZones && selectableRegions.length > 0 && (
          <Btn
            label="Add"
            small
            onPress={openCreateZone}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        )}
      </View>

      {canManageZones && selectableRegions.length === 0 &&
        infoBanner(isRhScoped ? 'No region is assigned to you.' : 'Add at least one region before creating zones.')}

      {/* Region filter — names + counts, never ids (non-RH only). */}
      {!isRhScoped && regions.length > 0 && zones.length > 0 && (
        <Field style={{ zIndex: 20 }}>
          <Trigger
            label={filterLabel}
            open={openFilterDd}
            onPress={() => setOpenFilterDd(v => !v)}
          />
          {openFilterDd && (
            <Dropdown
              style={s.ddFull}
              maxHeight={260}
              value={zoneRegionFilter}
              onSelect={(v) => { setZoneRegionFilter(String(v)); setOpenFilterDd(false); }}
              options={regionFilterOptions}
            />
          )}
        </Field>
      )}

      {filteredZones.length === 0
        ? emptyCard(
            zones.length === 0 ? 'No zones yet.' : 'No zones in this region.',
            <MapPin size={26} color={T.dim} strokeWidth={ICON_STROKE} />,
          )
        : table ? renderZonesTable() : renderZonesRows()}
    </View>
  );

  // ── Zone modal: region trigger label ────────────────────────────────────────
  const zoneRegionOptions = selectableRegions.map((r: any) => ({ label: r.name, value: String(r.id) }));
  const zoneRegionLabel = zoneRegionOptions.find(o => o.value === zoneRegionId)?.label || 'Select a region…';
  const editAssignedCount = toTransfers(editAssignments).length;
  const saveLabel = editAssignedCount > 0
    ? `Save & Transfer ${editAssignedCount} User${editAssignedCount !== 1 ? 's' : ''}`
    : 'Save';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={[s.scroll, wide && s.scrollWide]} keyboardShouldPersistTaps="handled">
        <Text style={[s.pageSub, { color: T.sub }]}>
          {canManageRegions
            ? 'Add regions first, then zones. Used when assigning users.'
            : 'Add zones to your managed region.'}
        </Text>

        {flash && (
          <View
            style={[
              s.flash,
              {
                backgroundColor: withAlpha(flash.type === 'success' ? T.success : T.danger, 0.12),
                borderColor: withAlpha(flash.type === 'success' ? T.success : T.danger, 0.2),
              },
            ]}
          >
            {flash.type === 'success'
              ? <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
              : <Info size={14} color={T.danger} strokeWidth={ICON_STROKE} />}
            <Text style={[s.flashTxt, { color: flash.type === 'success' ? T.success : T.danger }]}>{flash.msg}</Text>
          </View>
        )}

        {/* Two columns only when the Regions side has real content to manage
            (SH/SCA). An RH has a single read-only region, so side-by-side left a
            near-empty Regions column next to a tall Zones one — stack instead, so
            the region reads as a compact banner above the full-width Zones table. */}
        <View style={wide && canManageRegions ? s.columns : s.stack}>
          {regionsSection}
          {zonesSection}
        </View>
      </ScrollView>

      {/* Region create / edit */}
      <FormModal
        visible={showRegionModal}
        title={editingRegion ? 'Edit Region' : 'Add Region'}
        onClose={() => setShowRegionModal(false)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={() => setShowRegionModal(false)} small />
            <Btn
              label={editingRegion ? saveLabel : 'Create'}
              onPress={saveRegion}
              loading={savingRegion}
              disabled={savingRegion || !regionName.trim()}
              small
            />
          </>
        }
      >
        <View style={s.mForm}>
          <Input
            label="Region Name *"
            value={regionName}
            onChangeText={setRegionName}
            placeholder="e.g. Gujarat"
            autoFocus={!editingRegion}
          />
          {!!editingRegion && canManageRegions && (
            <EditTransferSection
              kind="region"
              id={editingRegion.id}
              targets={transferTargets('region', editingRegion.id, regions, zones)}
              regions={regions}
              zones={zones}
              assignments={editAssignments}
              setAssignments={setEditAssignments}
            />
          )}
        </View>
      </FormModal>

      {/* Zone create / edit */}
      <FormModal
        visible={showZoneModal}
        title={editingZone ? 'Edit Zone' : 'Add Zone'}
        onClose={() => setShowZoneModal(false)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={() => setShowZoneModal(false)} small />
            <Btn
              label={editingZone ? saveLabel : 'Create'}
              onPress={saveZone}
              loading={savingZone}
              disabled={savingZone || !zoneName.trim() || (!isRhScoped && !zoneRegionId)}
              small
            />
          </>
        }
      >
        <View style={s.mForm}>
          <Input
            label="Zone Name *"
            value={zoneName}
            onChangeText={setZoneName}
            placeholder="e.g. Ahmedabad"
          />
          {isRhScoped ? (
            <View style={[s.autoRegion, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
              <Text style={[s.autoRegionTxt, { color: T.sub }]}>
                <Text style={{ color: T.text, fontWeight: '700' }}>Region: </Text>
                {regionNameById(user?.regionId) || 'Your region'}
              </Text>
              <Text style={[s.autoRegionHint, { color: T.dim }]}>
                Zones are added to your assigned region automatically.
              </Text>
            </View>
          ) : (
            <Field label="Region *" style={{ zIndex: 20 }}>
              <Trigger
                label={zoneRegionLabel}
                open={openZoneDd}
                onPress={() => setOpenZoneDd(v => !v)}
              />
              {openZoneDd && (
                <Dropdown
                  style={s.ddFull}
                  maxHeight={220}
                  value={zoneRegionId}
                  onSelect={(v) => { setZoneRegionId(String(v)); setOpenZoneDd(false); }}
                  options={zoneRegionOptions}
                />
              )}
            </Field>
          )}
          {/* Web shows the edit-time transfer to SH/SCA only (canManageRegions). */}
          {!!editingZone && canManageRegions && (
            <EditTransferSection
              kind="zone"
              id={editingZone.id}
              targets={transferTargets('zone', editingZone.id, regions, zones, rhRegionId)}
              regions={regions}
              zones={zones}
              assignments={editAssignments}
              setAssignments={setEditAssignments}
            />
          )}
        </View>
      </FormModal>

      {/* Delete confirm — dependents error is surfaced via the flash banner. */}
      <ConfirmModal
        visible={!!deleteItem}
        tone="danger"
        title={`Delete ${deleteItem?.type === 'region' ? 'Region' : 'Zone'}?`}
        message={
          deleteItem?.type === 'zone'
            ? `${deleteItem?.name || 'This zone'} will be removed. If people are assigned to it, you'll choose where each one moves first.`
            : `${deleteItem?.name || 'This region'} will be permanently removed with its zones. If people are inside, you'll choose where each one moves first.`
        }
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />

      {!!transferItem && (
        <TransferDeleteModal
          item={transferItem}
          regions={regions}
          zones={zones}
          selectableRegions={selectableRegions}
          rhRegionId={rhRegionId}
          onClose={() => setTransferItem(null)}
          reload={() => refresh(true)}
          onDone={async (msg) => {
            setTransferItem(null);
            await refresh();
            showFlash('success', msg);
          }}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 32 },
  scrollWide: { paddingHorizontal: 22 },

  pageSub: { fontSize: rf(12.5), fontWeight: '500' },

  flash: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11,
  },
  flashTxt: { fontSize: rf(12.5), fontWeight: '600', flexShrink: 1, minWidth: 0 },

  // two-column (tablet landscape) / stacked (phone) — equal-height columns
  columns: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  stack: { gap: 12 },

  section: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  sectionCol: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: rf(14.5), fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },

  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // table — house spec (SchoolsListScreen/UserManagementScreen): r16 · tr pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cRegName: { flex: 2, minWidth: 0 },
  cCount: { width: 64 },
  cZoneName: { flex: 1.6, minWidth: 0 },
  cZoneRegion: { flex: 1.2, minWidth: 0 },
  cActions: { width: 76 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  empty: { borderRadius: 13, borderWidth: 1, paddingVertical: 30, alignItems: 'center', gap: 8 },
  emptyTxt: { fontSize: rf(12), fontWeight: '500', textAlign: 'center', paddingHorizontal: 16 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  noticeTxt: { fontSize: rf(12), fontWeight: '600', flexShrink: 1, minWidth: 0 },

  // modals
  mForm: { gap: 14 },
  ddFull: { width: '100%' },
  autoRegion: { borderWidth: 1, borderRadius: 13, padding: 12 },
  autoRegionTxt: { fontSize: rf(13), fontWeight: '500' },
  autoRegionHint: { fontSize: rf(11), fontWeight: '500', marginTop: 4 },

  // user transfer (delete + edit)
  xfIntro: { fontSize: rf(12.5), fontWeight: '500', lineHeight: rf(18) },
  xfHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  xfCount: { fontSize: rf(11.5), fontWeight: '500' },
  xfAll: { fontSize: rf(12), fontWeight: '700' },
  xfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  xfName: { fontSize: rf(13), fontWeight: '600' },
  xfMeta: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  xfTarget: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '45%' },
  xfTargetTxt: { fontSize: rf(10.5), fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipTxt: { fontSize: rf(11), fontWeight: '700' },
  bulkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, paddingTop: 10 },
  quickLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  quickLinkTxt: { fontSize: rf(12.5), fontWeight: '600' },
  quickBox: { borderWidth: 1, borderRadius: 13, padding: 12, gap: 10 },
  quickTitle: { fontSize: rf(12.5), fontWeight: '700' },
  quickBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editXf: { borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  editXfHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  editXfTitle: { flex: 1, minWidth: 0, fontSize: rf(12.5), fontWeight: '600' },
});
