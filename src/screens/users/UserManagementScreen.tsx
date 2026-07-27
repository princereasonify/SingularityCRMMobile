import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Edit2, Trash2, X, Globe, UserCheck, Clock, Eye, EyeOff, Check,
  MapPin, Users as UsersIcon, Trash,
} from 'lucide-react-native';

import { ICON_STROKE } from '../../components/common/Icon';
import { authApi, DeleteBlockedInfo, SubordinateDto, UserTransferEntry } from '../../api/auth';
import { UserDto, Region, Zone } from '../../types';
import {
  Btn, IconBtn, Field, Input, Checkbox, Segmented, Trigger, Dropdown,
  StatusBadge, Pagination, ListCard, Avatar, FormModal, ConfirmModal,
} from '../../components/crud';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { rf, isTabletDevice } from '../../utils/responsive';

const DASH = '—';

/**
 * House page size — 10 on every list screen (SchoolsListScreen, LeadsListScreen,
 * TargetsScreen, AllowancesScreen, PaymentsScreen, DemoListScreen).
 *
 * CLIENT-side on both tabs, because neither endpoint accepts paging. AuthController:
 *   [Authorize]
 *   [HttpGet("users")]
 *   public async Task<IActionResult> GetUsers()
 *   { ... return Ok(ApiResponse<List<Core.DTOs.UserDto>>.Ok(users)); }
 * and
 *   [Authorize]
 *   [HttpGet("pending-users")]
 *   public async Task<IActionResult> GetPendingUsers()
 *   { ... return Ok(ApiResponse<List<Core.DTOs.UserDto>>.Ok(users)); }
 * Neither declares a single [FromQuery] parameter and both return a bare List<UserDto>
 * — there is no page/limit to send nor total to read, so we slice locally.
 *
 * Slicing locally also keeps the delete-with-transfer flow correct: handleDelete and
 * transferCandidates scan the FULL `users` array, never the visible page, so a
 * subordinate on page 3 still blocks (and is still offered as a destination).
 */
const PAGE_SIZE = 10;

const CREATABLE_ROLES: Record<string, string[]> = {
  SCA: ['SH', 'RH', 'ZH', 'FO'],
  SH:  ['RH', 'ZH', 'FO'],
  RH:  ['ZH', 'FO'],
  ZH:  ['FO'],
};

const isPasswordValid = (pwd: string) => (
  pwd.length >= 8 &&
  /[A-Z]/.test(pwd) &&
  /[0-9]/.test(pwd) &&
  /[^A-Za-z0-9]/.test(pwd)
);

const getPasswordRules = (pwd: string) => [
  { label: '8+ characters', met: pwd.length >= 8 },
  { label: 'Uppercase', met: /[A-Z]/.test(pwd) },
  { label: 'Number', met: /[0-9]/.test(pwd) },
  { label: 'Special char', met: /[^A-Za-z0-9]/.test(pwd) },
];

/**
 * Role → theme token. The old ROLE_COLORS ramp was a pre-Sunstone palette of raw
 * hexes that stayed light-mode in dark mode; every rank now resolves to a distinct
 * Sunstone status hue instead.
 */
function roleColor(T: AppTheme, role?: string): string {
  switch (role) {
    case 'SCA': return T.danger;
    case 'SH':  return T.info;
    case 'RH':  return T.accent;
    case 'ZH':  return T.warning;
    default:    return T.success; // FO
  }
}

const displayNameOf = (u: any) =>
  u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || '';

const initialsOf = (u: any) => {
  const n = displayNameOf(u);
  return (u?.avatar || n.charAt(0) || '?').toUpperCase();
};

/**
 * Reassign-and-delete modal — web parity with CreateUser.jsx:339-454.
 *
 * A ZH with FOs in its zone, or an RH with ZHs / direct FOs in its region, cannot be
 * deleted until every subordinate has somewhere to go. The backend enforces this
 * (409 from AuthController.DeleteUser); this modal is how the user satisfies it.
 *
 * Every row must be ticked before "Transfer & Delete" enables — a half-assigned
 * transfer would delete the parent and strand whoever was left unticked, because the
 * controller deletes unconditionally after applying whatever transfers it was given.
 *
 * The destination picker is a spec Trigger + inline Dropdown (opens 8px below, never a
 * nested Modal) — presentation only; the transfer payload is untouched.
 */
function TransferDeleteModal({ targetUser, info, candidates, busy, onCancel, onConfirm }: {
  targetUser: any;
  info: DeleteBlockedInfo;
  candidates: UserDto[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (transfers: UserTransferEntry[]) => void;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 768 && width > height;

  const [targetId, setTargetId] = useState<string>('');
  const [openDest, setOpenDest] = useState(false);
  const [zhPicked, setZhPicked] = useState<Set<number>>(new Set());
  const [foPicked, setFoPicked] = useState<Set<number>>(new Set());

  const zhSubs = info.zhSubordinates || [];
  const foSubs = info.foSubordinates || [];

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<number>>>) => (id: number) =>
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = (
    setFn: React.Dispatch<React.SetStateAction<Set<number>>>,
    all: SubordinateDto[],
  ) => () => setFn((prev) => (prev.size === all.length ? new Set() : new Set(all.map((u) => u.id))));

  // Ready only when a destination is chosen AND every row is accounted for.
  const allAssigned =
    !!targetId && zhPicked.size === zhSubs.length && foPicked.size === foSubs.length;

  const submit = () => {
    if (!allAssigned) return;
    // RH delete → subordinates move under another RH. ZH delete → FOs move under another ZH.
    const foTargetType: 'zh' | 'rh' = info.type === 'rh' ? 'rh' : 'zh';
    onConfirm([
      ...zhSubs.map((u) => ({ userId: u.id, targetId: Number(targetId), targetType: 'rh' as const })),
      ...foSubs.map((u) => ({ userId: u.id, targetId: Number(targetId), targetType: foTargetType })),
    ]);
  };

  const section = (
    title: string,
    rows: SubordinateDto[],
    picked: Set<number>,
    onToggle: (id: number) => void,
    onAll: () => void,
  ) => {
    if (rows.length === 0) return null;
    return (
      <View style={{ gap: 8 }}>
        <View style={s.xfHeadRow}>
          <Text style={[s.xfSection, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
            {title} ({rows.length})
          </Text>
          <TouchableOpacity onPress={onAll} hitSlop={8}>
            <Text style={[s.xfAll, { color: T.accent }]}>
              {picked.size === rows.length ? 'Clear all' : 'Select all'}
            </Text>
          </TouchableOpacity>
        </View>
        {rows.map((u) => (
          <View key={u.id} style={[s.xfRow, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
            <Checkbox on={picked.has(u.id)} onToggle={() => onToggle(u.id)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.xfName, { color: T.text }]} numberOfLines={1}>{u.name || DASH}</Text>
              <Text style={[s.xfMail, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>
            </View>
            <Text style={[s.xfRole, { color: T.sub }]}>{u.role}</Text>
          </View>
        ))}
      </View>
    );
  };

  const destLabel = info.type === 'rh' ? 'Regional Head' : 'Zonal Head';
  const destOptions = candidates.map((c: any) => ({
    label: displayNameOf(c) || c.email,
    value: String(c.id),
  }));
  const destSelected = destOptions.find((o) => o.value === targetId);

  return (
    <FormModal
      visible
      wide={wide}
      title="Reassign & Delete"
      onClose={onCancel}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onCancel} small />
          <Btn
            label={busy ? 'Transferring…' : 'Transfer & Delete'}
            variant="danger"
            onPress={submit}
            loading={busy}
            disabled={!allAssigned || busy}
            small
          />
        </>
      }
    >
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.xfIntro, { color: T.sub }]}>
          {targetUser?.name || 'This user'} still has {zhSubs.length + foSubs.length} person
          {zhSubs.length + foSubs.length === 1 ? '' : 's'} reporting in. Pick a new{' '}
          {destLabel} and tick everyone to move before deleting.
        </Text>

        <Field label={`Transfer to ${destLabel} *`} style={{ zIndex: 20 }}>
          <Trigger
            label={destSelected?.label || `Select a ${destLabel}…`}
            open={openDest}
            onPress={() => setOpenDest((v) => !v)}
          />
          {openDest && (
            <Dropdown
              style={s.ddFull}
              maxHeight={200}
              value={targetId}
              onSelect={(v) => { setTargetId(String(v)); setOpenDest(false); }}
              options={destOptions}
            />
          )}
        </Field>

        {section('Zonal Heads', zhSubs, zhPicked, toggle(setZhPicked), toggleAll(setZhPicked, zhSubs))}
        {section('Field Officers', foSubs, foPicked, toggle(setFoPicked), toggleAll(setFoPicked, foSubs))}

        {!allAssigned && (
          <Text style={[s.xfWarn, { color: T.dim }]}>
            Choose a destination and tick every row to continue.
          </Text>
        )}
      </ScrollView>
    </FormModal>
  );
}

export const UserManagementScreen = (_props: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const role = user?.role || 'ZH';
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const table = isTabletDevice;

  const [tab, setTab] = useState<'users' | 'regions' | 'pending'>('users');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserDto[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [openDd, setOpenDd] = useState<'role' | 'region' | 'zone' | null>(null);

  // Delete-with-transfer flow
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<DeleteBlockedInfo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Pagination (client-side; see PAGE_SIZE) — one page cursor per tab ──────
  const [userPage, setUserPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  const userTotal = users.length;
  const userPages = Math.max(1, Math.ceil(userTotal / PAGE_SIZE));
  const pendingTotal = pendingUsers.length;
  const pendingPages = Math.max(1, Math.ceil(pendingTotal / PAGE_SIZE));

  /** Clamp, don't reset: approving the last row on page 3 must land on page 2, not 1. */
  useEffect(() => { setUserPage(p => Math.min(p, userPages)); }, [userPages]);
  useEffect(() => { setPendingPage(p => Math.min(p, pendingPages)); }, [pendingPages]);

  const pagedUsers = useMemo(
    () => users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE),
    [users, userPage],
  );
  const pagedPending = useMemo(
    () => pendingUsers.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE),
    [pendingUsers, pendingPage],
  );

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: CREATABLE_ROLES[role]?.[0] || 'FO',
    zoneId: '' as any, regionId: '' as any,
  });

  const extract = (d: any): any[] => {
    if (Array.isArray(d)) return d;
    if (d?.users) return d.users;
    if (d?.items) return d.items;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
  };

  const extractList = (d: any): any[] => {
    if (Array.isArray(d)) return d;
    if (d?.regions) return d.regions;
    if (d?.zones) return d.zones;
    if (d?.items) return d.items;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
  };

  const fetchData = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [
        authApi.getUsers(),
        authApi.getRegions(),
        authApi.getZones(),
      ];
      if (role === 'SCA') promises.push(authApi.getPendingUsers());
      const results = await Promise.all(promises);
      setUsers(extract(results[0].data));
      setRegions(extractList(results[1].data));
      setZones(extractList(results[2].data));
      if (role === 'SCA' && results[3]) {
        setPendingUsers(extract(results[3].data));
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const openCreate = () => {
    setEditingUser(null);
    setOpenDd(null);
    // An RH creates only within its own region, so pin it up front (like ZH's zone).
    setForm({ name: '', email: '', password: '', role: CREATABLE_ROLES[role]?.[0] || 'FO',
      zoneId: '', regionId: role === 'RH' ? String(user?.regionId ?? '') : '' });
    setShowUserModal(true);
  };

  const openEdit = (u: any) => {
    const uName = displayNameOf(u);
    setEditingUser(u);
    setOpenDd(null);
    setForm({ name: uName, email: u.email, password: '', role: u.role, zoneId: u.zoneId || '', regionId: u.regionId || '' });
    setShowUserModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { Alert.alert('Error', 'Name and email are required'); return; }
    if (!editingUser && !form.password) { Alert.alert('Error', 'Password is required for new users'); return; }
    if (form.password && !isPasswordValid(form.password)) {
      Alert.alert('Error', 'Password must be at least 8 characters with uppercase, number, and special character.');
      return;
    }
    setFormLoading(true);
    try {
      if (editingUser) {
        await authApi.updateUser(editingUser.id, {
          name: form.name, email: form.email,
          password: form.password || undefined,
          role: form.role,
          zoneId: form.zoneId ? Number(form.zoneId) : undefined,
          regionId: form.regionId ? Number(form.regionId) : undefined,
        });
      } else {
        // ZH auto-assigns their own zone/region
        const zoneId = role === 'ZH' ? (user?.zoneId || undefined) : (form.zoneId ? Number(form.zoneId) : undefined);
        // ZH pins its own region; RH also creates only inside its own region (the backend
        // now enforces this, so never send another region that would just 403).
        const regionId = (role === 'ZH' || role === 'RH')
          ? (user?.regionId || undefined)
          : (form.regionId ? Number(form.regionId) : undefined);
        await authApi.createUser({
          name: form.name, email: form.email, password: form.password,
          role: form.role,
          zoneId,
          regionId,
        });
      }
      setShowUserModal(false);
      fetchData();
      Alert.alert('Success', editingUser ? 'User updated!' : 'User created!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save user');
    } finally {
      setFormLoading(false);
    }
  };

  /** Fires the actual DELETE. `transfers` null → plain delete (also the 409 probe). */
  const runDelete = useCallback(async (u: any, transfers: UserTransferEntry[] | null) => {
    const uName = displayNameOf(u) || 'this user';
    setDeleting(true);
    try {
      await authApi.deleteUser(u.id, transfers ? { transfers } : null);
      setDeleteTarget(null);
      setDeleteInfo(null);
      await fetchData();
      Alert.alert('Success', `${uName} was deleted.`);
    } catch (err: any) {
      // 409 = the server found subordinates we did not. Its payload is authoritative,
      // so drive the modal from it rather than from our client-side guess.
      const payload = err?.response?.data?.data;
      if (err?.response?.status === 409 && payload && (payload.zhSubordinates || payload.foSubordinates)) {
        setDeleteTarget(u);
        setDeleteInfo({
          type: payload.type,
          zhSubordinates: payload.zhSubordinates || [],
          foSubordinates: payload.foSubordinates || [],
        });
      } else {
        setDeleteTarget(null);
        setDeleteInfo(null);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to delete user');
      }
    } finally {
      setDeleting(false);
    }
  }, [fetchData]);

  /**
   * Compute subordinates client-side first (web parity) so a blocked delete opens the
   * transfer modal straight away instead of a pointless "Are you sure?" that then 409s.
   * The 409 handler in runDelete remains the backstop when our local list is stale.
   */
  const handleDelete = (u: any) => {
    if (u.role === 'ZH' && u.zoneId) {
      const foSubs = users.filter((x: any) => x.id !== u.id && x.role === 'FO' && x.zoneId === u.zoneId);
      if (foSubs.length > 0) {
        setDeleteTarget(u);
        setDeleteInfo({ type: 'zh', zhSubordinates: [], foSubordinates: foSubs as any });
        return;
      }
    }

    if (u.role === 'RH' && u.regionId) {
      const zhSubs = users.filter((x: any) => x.id !== u.id && x.role === 'ZH' && x.regionId === u.regionId);
      // Only direct FOs (no zone) — FOs under a ZH follow that ZH automatically.
      const foSubs = users.filter(
        (x: any) => x.id !== u.id && x.role === 'FO' && x.regionId === u.regionId && !x.zoneId,
      );
      if (zhSubs.length > 0 || foSubs.length > 0) {
        setDeleteTarget(u);
        setDeleteInfo({ type: 'rh', zhSubordinates: zhSubs as any, foSubordinates: foSubs as any });
        return;
      }
    }

    setConfirmDelete(u);
  };

  // Destinations for the transfer modal, mirroring web's rhTargets / zhTargets:
  // deleting an RH → its people move under another RH; deleting a ZH → its FOs move
  // under another ZH. The user being deleted is never a valid destination.
  const transferCandidates = React.useMemo(() => {
    if (!deleteTarget || !deleteInfo) return [];
    const wanted = deleteInfo.type === 'rh' ? 'RH' : 'ZH';
    return users.filter((x: any) => x.role === wanted && x.id !== deleteTarget.id);
  }, [users, deleteTarget, deleteInfo]);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      await authApi.approveUser(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      fetchData();
      Alert.alert('Success', 'User approved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to approve user.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setRejectingId(id);
    try {
      await authApi.rejectUser(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      Alert.alert('Success', 'User rejected and removed successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reject user.');
    } finally {
      setRejectingId(null);
    }
  };

  const filteredZones = form.regionId ? zones.filter((z) => z.regionId === Number(form.regionId)) : zones;
  const needsZone = ['FO', 'ZH'].includes(form.role);
  const needsRegion = ['ZH', 'RH', 'FO'].includes(form.role);

  const roleOptions = (() => {
    const opts = (CREATABLE_ROLES[role] || []).map((r) => ({ label: r, value: r }));
    // When editing, keep the user's CURRENT role selectable even if it isn't in the
    // creator's creatable set — otherwise the dropdown can't display the real value.
    if (editingUser && form.role && !opts.some((o) => o.value === form.role)) {
      opts.unshift({ label: form.role, value: form.role });
    }
    return opts;
  })();
  const regionOptions = regions.map((r) => ({ label: r.name, value: String(r.id) }));
  const zoneOptions = filteredZones.map((z) => ({ label: z.name, value: String(z.id) }));

  const emptyCard = (title: string, msg: string, icon: React.ReactNode) => (
    <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
      {icon}
      <Text style={[s.emptyTitle, { color: T.text }]}>{title}</Text>
      <Text style={[s.emptyTxt, { color: T.dim }]}>{msg}</Text>
    </View>
  );

  /** Spec's pagination panel: "Showing 1–6 of 210" on the left, the .pg cells right. */
  const pgFooter = (page: number, pages: number, total: number, onChange: (p: number) => void) => {
    if (pages <= 1) return null;
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return (
      <View style={s.pgRow}>
        <Text style={[s.count, { color: T.dim }]}>
          Showing {from}{DASH}{to} of {total}
        </Text>
        <Pagination page={page} pageCount={pages} onChange={onChange} />
      </View>
    );
  };

  const userActions = (u: any) => (
    <View style={s.actions}>
      <IconBtn kind="edit" label="Edit user" onPress={() => openEdit(u)}>
        <Edit2 size={14} color={T.sub} strokeWidth={ICON_STROKE} />
      </IconBtn>
      <IconBtn kind="del" label="Delete user" onPress={() => handleDelete(u)}>
        <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
      </IconBtn>
    </View>
  );

  // ── Users: iPad table ───────────────────────────────────────────────────────
  const renderUsersTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cName]}>Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cRole]}>Role</Text>
        <Text style={[s.th, { color: T.dim }, s.cZone]}>Zone</Text>
        <Text style={[s.th, { color: T.dim }, s.cZone]}>Region</Text>
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
      </View>
      {pagedUsers.map((u: any) => (
        <View key={String(u.id)} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={[s.cName, s.nameCell]}>
            <Avatar initials={initialsOf(u)} color={roleColor(T, u.role)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{displayNameOf(u) || DASH}</Text>
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>
            </View>
          </View>
          <View style={s.cRole}>
            <StatusBadge label={u.role} color={roleColor(T, u.role)} />
          </View>
          <Text style={[s.td, { color: T.sub }, s.cZone]} numberOfLines={1}>{u.zone || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cZone]} numberOfLines={1}>{u.region || DASH}</Text>
          <View style={s.cActions}>{userActions(u)}</View>
        </View>
      ))}
    </View>
  );

  // ── Users: phone cards ──────────────────────────────────────────────────────
  const renderUsersCards = () => (
    <View style={{ gap: 8 }}>
      {pagedUsers.map((u: any) => (
        <ListCard key={String(u.id)}>
          <Avatar initials={initialsOf(u)} color={roleColor(T, u.role)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{displayNameOf(u) || DASH}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>
            <View style={s.metaRow}>
              <StatusBadge label={u.role} color={roleColor(T, u.role)} />
              {!!u.zone && <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>{u.zone}</Text>}
              {!!u.region && <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>{u.region}</Text>}
            </View>
          </View>
          {userActions(u)}
        </ListCard>
      ))}
    </View>
  );

  // ── Pending approvals ───────────────────────────────────────────────────────
  const pendingActions = (u: any) => {
    const busy = approvingId === u.id || rejectingId === u.id;
    return (
      <View style={s.actions}>
        <Btn
          label="Approve"
          variant="success"
          small
          disabled={busy}
          loading={approvingId === u.id}
          onPress={() => handleApprove(u.id)}
          icon={<UserCheck size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
        />
        <Btn
          label="Reject"
          variant="danger"
          small
          disabled={busy}
          loading={rejectingId === u.id}
          onPress={() => handleReject(u.id)}
          icon={<X size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
        />
      </View>
    );
  };

  const renderPending = () => {
    if (pendingUsers.length === 0) {
      return emptyCard(
        'No pending approvals',
        'All signup requests have been reviewed.',
        <Check size={34} color={T.success} strokeWidth={ICON_STROKE} />,
      );
    }
    return (
      <View style={{ gap: 8 }}>
        <View style={[s.notice, { backgroundColor: withAlpha(T.warning, 0.12), borderColor: withAlpha(T.warning, 0.2) }]}>
          <Clock size={15} color={T.warning} strokeWidth={ICON_STROKE} />
          <Text style={[s.noticeTxt, { color: T.warning, flexShrink: 1, minWidth: 0 }]}>
            Users who signed up and are waiting for approval
          </Text>
        </View>
        {pagedPending.map((u: any) => (
          <ListCard key={String(u.id)} style={table ? undefined : s.pendingCard}>
            <View style={s.rowTop}>
              <Avatar initials={initialsOf(u)} color={T.warning} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{displayNameOf(u) || DASH}</Text>
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>
                <View style={s.metaRow}>
                  <StatusBadge label={u.role} color={roleColor(T, u.role)} />
                  {!!u.phoneNumber && (
                    <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>{u.phoneNumber}</Text>
                  )}
                </View>
              </View>
              {table && pendingActions(u)}
            </View>
            {!table && pendingActions(u)}
          </ListCard>
        ))}
        {pgFooter(pendingPage, pendingPages, pendingTotal, setPendingPage)}
      </View>
    );
  };

  // ── Regions & zones (SH only) ───────────────────────────────────────────────
  const renderRegions = () => (
    <View style={{ gap: 8 }}>
      <Text style={[s.section, { color: T.text }]}>Regions ({regions.length})</Text>
      {regions.length === 0
        ? emptyCard('No regions', 'Regions will appear here once created.', <Globe size={34} color={T.dim} strokeWidth={ICON_STROKE} />)
        : regions.map((reg) => (
          <ListCard key={reg.id}>
            <Globe size={16} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[s.tdName, { color: T.text, flex: 1, minWidth: 0 }]} numberOfLines={1}>{reg.name}</Text>
            <StatusBadge label={`${zones.filter((z) => z.regionId === reg.id).length} zones`} color={T.info} />
          </ListCard>
        ))}

      <Text style={[s.section, { color: T.text, marginTop: 8 }]}>Zones ({zones.length})</Text>
      {zones.length === 0
        ? emptyCard('No zones', 'Zones will appear here once created.', <MapPin size={34} color={T.dim} strokeWidth={ICON_STROKE} />)
        : zones.map((zone) => {
          const reg = regions.find((r) => r.id === zone.regionId);
          return (
            <ListCard key={zone.id}>
              <MapPin size={16} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.tdName, { color: T.text, flex: 1, minWidth: 0 }]} numberOfLines={1}>{zone.name}</Text>
              {!!reg && <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>{reg.name}</Text>}
            </ListCard>
          );
        })}
    </View>
  );

  const tabOptions: { label: string; value: 'users' | 'regions' | 'pending' }[] = [
    { label: 'Users', value: 'users' },
    ...(role === 'SCA'
      ? [{ label: `Pending${pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}`, value: 'pending' as const }]
      : []),
    ...(role === 'SH' ? [{ label: 'Regions', value: 'regions' as const }] : []),
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={[s.scroll, wide && s.scrollWide]} keyboardShouldPersistTaps="handled">
        {/* No in-page title or hamburger: the topbar (native drawer header for the
            legacy-shell roles) already names the screen and carries the menu. Only
            the primary action stays, right-aligned — consistent across nav screens. */}
        <View style={s.actionBar}>
          <Btn
            label="Add User"
            small
            onPress={openCreate}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        {(role === 'SH' || role === 'SCA') && tabOptions.length > 1 && (
          <Segmented<'users' | 'regions' | 'pending'>
            value={tab}
            onChange={setTab}
            style={wide ? { width: 380 } : undefined}
            options={tabOptions}
          />
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : tab === 'pending' ? (
          renderPending()
        ) : tab === 'regions' ? (
          renderRegions()
        ) : users.length === 0 ? (
          emptyCard('No users found', 'Add a user and they will appear here.', <UsersIcon size={34} color={T.dim} strokeWidth={ICON_STROKE} />)
        ) : (
          <>
            {table ? renderUsersTable() : renderUsersCards()}
            {pgFooter(userPage, userPages, userTotal, setUserPage)}
          </>
        )}
      </ScrollView>

      {/* Create / edit — spec form modal: header, body form, footer action pair. */}
      <FormModal
        visible={showUserModal}
        wide={wide}
        title={editingUser ? 'Edit User' : 'Create User'}
        onClose={() => setShowUserModal(false)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={() => setShowUserModal(false)} small />
            <Btn
              label={editingUser ? 'Update User' : 'Create User'}
              onPress={handleSave}
              loading={formLoading}
              disabled={formLoading}
              small
            />
          </>
        }
      >
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={s.mForm} keyboardShouldPersistTaps="handled">
          <Field label="Role *" style={{ zIndex: 40 }}>
            <Trigger
              label={form.role || 'Select a role…'}
              open={openDd === 'role'}
              onPress={() => setOpenDd(openDd === 'role' ? null : 'role')}
            />
            {openDd === 'role' && (
              <Dropdown
                style={s.ddFull}
                maxHeight={200}
                value={form.role}
                onSelect={(v) => { set('role', v); setOpenDd(null); }}
                options={roleOptions}
              />
            )}
          </Field>

          <Input
            label="Full Name *"
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Arjun Mehta"
          />
          <Input
            label="Email *"
            value={form.email}
            onChangeText={(v) => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="email@educrm.in"
          />
          <Input
            label={editingUser ? 'New Password (optional)' : 'Password *'}
            value={form.password}
            onChangeText={(v) => set('password', v)}
            secureTextEntry={!showPwd}
            placeholder="••••••••"
            right={
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={10}>
                {showPwd
                  ? <EyeOff size={18} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <Eye size={18} color={T.dim} strokeWidth={ICON_STROKE} />}
              </TouchableOpacity>
            }
          />

          {form.password.length > 0 && (
            <View style={s.pwdRules}>
              {getPasswordRules(form.password).map((rule) => (
                <View key={rule.label} style={s.pwdRuleRow}>
                  <Check size={11} color={rule.met ? T.success : T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[s.pwdRuleTxt, { color: rule.met ? T.success : T.dim }]}>{rule.label}</Text>
                </View>
              ))}
            </View>
          )}

          {role === 'ZH' && !editingUser ? (
            <View style={[s.autoZone, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
              <Text style={[s.autoZoneTxt, { color: T.sub }]}>
                <Text style={[s.autoZoneBold, { color: T.text }]}>Zone: </Text>
                {user?.zone || 'Your zone'}
                {user?.region ? `  (${user.region})` : ''}
              </Text>
              <Text style={[s.autoZoneHint, { color: T.dim }]}>
                New user will be assigned to your zone automatically.
              </Text>
            </View>
          ) : (
            <>
              {needsRegion && (
                role === 'RH' ? (
                  // An RH creates only inside its own region, so pin it read-only
                  // (mirrors the ZH auto-zone tile) rather than offering every region —
                  // the backend rejects any other region, so a picker would only mislead.
                  <View style={[s.autoZone, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                    <Text style={[s.autoZoneTxt, { color: T.sub }]}>
                      <Text style={[s.autoZoneBold, { color: T.text }]}>Region: </Text>
                      {user?.region || 'Your region'}
                    </Text>
                    <Text style={[s.autoZoneHint, { color: T.dim }]}>
                      New user will be assigned to your region automatically.
                    </Text>
                  </View>
                ) : (
                  <Field label="Region" style={{ zIndex: 30 }}>
                    <Trigger
                      label={regionOptions.find((o) => o.value === String(form.regionId))?.label || 'Select a region…'}
                      open={openDd === 'region'}
                      onPress={() => setOpenDd(openDd === 'region' ? null : 'region')}
                    />
                    {openDd === 'region' && (
                      <Dropdown
                        style={s.ddFull}
                        maxHeight={200}
                        value={String(form.regionId)}
                        onSelect={(v) => { set('regionId', v); set('zoneId', ''); setOpenDd(null); }}
                        options={regionOptions}
                      />
                    )}
                  </Field>
                )
              )}
              {needsZone && (
                <Field label="Zone" style={{ zIndex: 20 }}>
                  <Trigger
                    label={zoneOptions.find((o) => o.value === String(form.zoneId))?.label || 'Select a zone…'}
                    open={openDd === 'zone'}
                    onPress={() => setOpenDd(openDd === 'zone' ? null : 'zone')}
                  />
                  {openDd === 'zone' && (
                    <Dropdown
                      style={s.ddFull}
                      maxHeight={200}
                      value={String(form.zoneId)}
                      onSelect={(v) => { set('zoneId', v); setOpenDd(null); }}
                      options={zoneOptions}
                    />
                  )}
                </Field>
              )}
            </>
          )}
        </ScrollView>
      </FormModal>

      {/* Plain delete — nothing reports in, so a spec confirm modal is the whole flow. */}
      <ConfirmModal
        visible={!!confirmDelete}
        tone="danger"
        title="Delete this user?"
        message={`${displayNameOf(confirmDelete) || 'This user'} will be permanently removed. This can't be undone.`}
        icon={<Trash size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Delete"
        onConfirm={() => { const u = confirmDelete; setConfirmDelete(null); if (u) runDelete(u, null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {!!deleteTarget && !!deleteInfo && (
        <TransferDeleteModal
          targetUser={deleteTarget}
          info={deleteInfo}
          candidates={transferCandidates}
          busy={deleting}
          onCancel={() => { setDeleteTarget(null); setDeleteInfo(null); }}
          onConfirm={(transfers) => runDelete(deleteTarget, transfers)}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from the theme, inline) ─────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 32 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  /** Just the primary action, right-aligned, now the title/hamburger are gone. */
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  title: { fontSize: rf(22), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },
  section: { fontSize: rf(13.5), fontWeight: '800', letterSpacing: -0.2 },

  // table
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cName: { flex: 2.4 },
  cRole: { flex: 0.9 },
  cZone: { flex: 1.1 },
  cActions: { width: 76 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // phone rows
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  pendingCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  noticeTxt: { fontSize: rf(12), fontWeight: '600' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // form modal
  mForm: { gap: 14, paddingBottom: 4 },
  ddFull: { width: '100%' },
  pwdRules: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
  pwdRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pwdRuleTxt: { fontSize: rf(11), fontWeight: '600' },
  autoZone: { borderWidth: 1, borderRadius: 13, padding: 12 },
  autoZoneTxt: { fontSize: rf(13), fontWeight: '500' },
  autoZoneBold: { fontWeight: '700' },
  autoZoneHint: { fontSize: rf(11), fontWeight: '500', marginTop: 4 },

  // Transfer-and-delete modal
  xfIntro: { fontSize: rf(12.5), fontWeight: '500', lineHeight: rf(18) },
  xfHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  xfSection: { fontSize: rf(12.5), fontWeight: '700' },
  xfAll: { fontSize: rf(12), fontWeight: '700' },
  xfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  xfName: { fontSize: rf(13), fontWeight: '600' },
  xfMail: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  xfRole: { fontSize: rf(11), fontWeight: '700' },
  xfWarn: { fontSize: rf(11.5), fontWeight: '500' },
});
