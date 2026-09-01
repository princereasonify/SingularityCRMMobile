import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Plus, Power, Edit2, Trash2 } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Segmented, Pagination, ListCard, Avatar, StatusBadge,
  Fab, Btn, IconBtn, Input, Field, Checkbox, Toggle, FormModal, ConfirmModal,
} from '../../components/crud';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { invalidateFieldStaff } from '../../components/b2c/useFieldStaff';
import { B2CUserListDto } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP } from '../../hooks/useResponsive';

const PAGE_SIZE = 20;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

type RoleFilter = '' | 'Agent' | 'Counselor';
type StatusFilter = '' | 'active' | 'inactive';

// Local alias — this screen only ever deals with the roster list shape.
type B2CUser = B2CUserListDto;

const toggleId = (arr: number[], id: number) =>
  arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

export const B2CUserManagementScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const navigation = useNavigation<any>();

  const [users, setUsers] = useState<B2CUser[]>([]);
  const [allAgents, setAllAgents] = useState<B2CUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  // Edit
  const [editUser, setEditUser] = useState<B2CUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', address: '', bio: '', referralCode: '', isActive: true, isManager: false, agentIds: [] as number[],
  });
  const [editErr, setEditErr] = useState('');

  // Destructive confirms
  const [deleteTarget, setDeleteTarget] = useState<B2CUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<B2CUser | null>(null);

  // Load the full set (B2C staff is small) so search + status filter across everyone.
  // Pagination is applied client-side over the filtered rows — mirrors the web page.
  const load = useCallback(async () => {
    try {
      const res = await b2cUserService.getUsers({ page: 1, pageSize: 500, role: role || undefined });
      setUsers(res.data?.items ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [role]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, role]);
  useEffect(() => {
    b2cUserService.getUsers({ page: 1, pageSize: 200, role: 'Agent' })
      .then(res => setAllAgents(res.data?.items ?? []))
      .catch(() => setAllAgents([]));
  }, []);

  // Add User is its own screen now, and drawer screens stay mounted — so coming back from a
  // create has to refetch, otherwise the new user is missing until the next pull-to-refresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => users.filter(u => {
    if (status === 'active' && !u.isActive) return false;
    if (status === 'inactive' && u.isActive) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [u.name, u.email, u.mobile].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  }), [users, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const roleColor = (r: string) => (r === 'Counselor' ? T.info : T.accent);

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (u: B2CUser) => {
    setEditUser(u);
    setEditForm({
      name: u.name || '',
      mobile: u.mobile || '',
      address: u.address || '',
      bio: u.bio || '',
      referralCode: u.referralCode || '',
      isActive: u.isActive ?? true,
      isManager: u.isManager ?? false,
      agentIds: u.teamAgentIds || [],
    });
    setEditErr('');
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true); setEditErr('');
    try {
      await b2cUserService.updateUser(editUser.id, {
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        address: editForm.address.trim(),
        bio: editUser.role === 'Counselor' ? editForm.bio.trim() : undefined,
        referralCode: editForm.referralCode.trim(),
        isActive: editForm.isActive,
        isManager: editUser.role === 'Agent' ? editForm.isManager : undefined,
        agentIds: editUser.role === 'Agent' && editForm.isManager ? editForm.agentIds : undefined,
      });
      setEditUser(null);
      invalidateFieldStaff();
      toast.success('User updated');
      setLoading(true); load();
    } catch (err: any) {
      setEditErr(err?.response?.data?.message || 'Failed to update user');
      toast.error(err?.response?.data?.message || 'Failed to update user');
    } finally { setSaving(false); }
  };

  // ── Toggle (activate directly, deactivate confirms) ──────────────────────
  const handleToggle = async (u: B2CUser) => {
    if (u.isActive) { setToggleTarget(u); return; }
    try {
      await b2cUserService.toggleUser(u.id);
      invalidateFieldStaff();
      toast.success('User activated');
      setLoading(true); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update user');
    }
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      await b2cUserService.toggleUser(toggleTarget.id);
      setToggleTarget(null);
      invalidateFieldStaff();
      toast.success('User deactivated');
      setLoading(true); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not deactivate user');
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await b2cUserService.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      invalidateFieldStaff();
      toast.success('User deleted');
      setLoading(true); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user');
    } finally { setSaving(false); }
  };

  // Agents this manager can oversee (exclude the edited user itself).
  const editSelectableAgents = allAgents.filter(a => a.id !== editUser?.id);

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} colors={[T.accent]} />
        }
      >
        <Text style={[s.count, { color: T.dim }]}>{users.length} agents &amp; counselors</Text>

        {/* Three stacked full-width filter bars waste most of an iPad's width, so they
            share a row once there is room for them. */}
        <View style={s.filters}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, email, mobile…" style={s.filterCell} />
          <Segmented<RoleFilter>
            value={role}
            onChange={setRole}
            style={s.filterCell}
            options={[{ label: 'All', value: '' }, { label: 'Agents', value: 'Agent' }, { label: 'Counselors', value: 'Counselor' }]}
          />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            style={s.filterCell}
            options={[{ label: 'Any', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No users found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Add an agent or counselor with the + button.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {paged.map(u => (
                <ListCard key={u.id} style={{ alignItems: 'flex-start', width: cardW }}>
                  <Avatar initials={initialsOf(u.name)} color={roleColor(u.role)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{u.name}</Text>
                      <StatusBadge label={u.role} color={roleColor(u.role)} />
                      <StatusBadge label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? T.success : T.danger} />
                    </View>
                    {!!u.email && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>}
                    {!!u.mobile && <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>{u.mobile}</Text>}
                    {!!u.referralCode && (
                      <View style={[s.refChip, { backgroundColor: T.accentSoft }]}>
                        <Text style={[s.refChipTxt, { color: T.accent }]}>{u.referralCode}</Text>
                      </View>
                    )}
                    {u.isManager && (
                      <Text style={[s.manager, { color: T.accent }]}>
                        MANAGER · {u.teamSize ?? 0} agent{u.teamSize === 1 ? '' : 's'}
                      </Text>
                    )}
                    {!!u.managerName && <Text style={[s.sub, { color: T.dim }]}>under {u.managerName}</Text>}
                    <View style={s.actions}>
                      <IconBtn kind="view" label={u.isActive ? 'Deactivate' : 'Activate'} onPress={() => handleToggle(u)}>
                        <Power size={15} color={u.isActive ? T.success : T.dim} strokeWidth={ICON_STROKE} />
                      </IconBtn>
                      <IconBtn kind="edit" label="Edit" onPress={() => openEdit(u)}>
                        <Edit2 size={15} color={T.text} strokeWidth={ICON_STROKE} />
                      </IconBtn>
                      <IconBtn kind="del" label="Delete" onPress={() => setDeleteTarget(u)}>
                        <Trash2 size={15} color={T.danger} strokeWidth={ICON_STROKE} />
                      </IconBtn>
                    </View>
                  </View>
                </ListCard>
              ))}
            </View>
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Pagination page={page} pageCount={totalPages} onChange={p => { if (p >= 1 && p <= totalPages) setPage(p); }} />
              </View>
            )}
          </>
        )}
        <View style={{ height: 72 }} />
      </ScrollView>

      <View style={s.fabWrap}>
        <Fab label="Add User" onPress={() => navigation.navigate('Add User')}>
          <Plus size={22} color="#FFF" strokeWidth={2.4} />
        </Fab>
      </View>

      {/* Edit */}
      <FormModal
        wide={r.isTablet}
        visible={!!editUser}
        title="Edit User"
        onClose={() => setEditUser(null)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setEditUser(null)} style={{ flex: 1 }} />
            <Btn label={saving ? 'Saving…' : 'Save Changes'} onPress={handleEdit} loading={saving} disabled={saving || !editForm.name.trim()} style={{ flex: 1 }} />
          </>
        }
      >
        {editUser && (
          <View style={{ gap: 12 }}>
            {!!editErr && <Text style={[s.err, { color: T.danger }]}>{editErr}</Text>}
            <Input label="Full Name" value={editForm.name} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} placeholder="Full name" />
            <Input label="Mobile" value={editForm.mobile} onChangeText={v => setEditForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Input
              label="Referral Code"
              value={editForm.referralCode}
              onChangeText={v => setEditForm(f => ({ ...f, referralCode: v.toUpperCase() }))}
              placeholder="e.g. VIR@123"
              autoCapitalize="characters"
            />
            <Field label="Address">
              <Input value={editForm.address} onChangeText={v => setEditForm(f => ({ ...f, address: v }))} placeholder="Residential / base address" multiline />
            </Field>
            {editUser.role === 'Counselor' && (
              <Field label="Bio">
                <Input value={editForm.bio} onChangeText={v => setEditForm(f => ({ ...f, bio: v }))} placeholder="Short bio…" multiline />
              </Field>
            )}
            <View style={s.activeRow}>
              <Text style={[s.name, { color: T.text }]}>Active</Text>
              <Toggle on={editForm.isActive} onToggle={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))} />
            </View>
            {editUser.role === 'Agent' && (
              <View style={{ gap: 12 }}>
                <Checkbox
                  on={editForm.isManager}
                  onToggle={() => setEditForm(f => ({ ...f, isManager: !f.isManager }))}
                  label="Also a Manager (oversees a team)"
                />
                {editForm.isManager && (
                  <Field label="Agents under this manager">
                    <View style={[s.pickList, { borderColor: T.line }]}>
                      {editSelectableAgents.length === 0 ? (
                        <Text style={[s.pickEmpty, { color: T.dim }]}>No other agents yet.</Text>
                      ) : (
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
                          {editSelectableAgents.map(a => (
                            <Checkbox
                              key={a.id}
                              on={editForm.agentIds.includes(a.id)}
                              onToggle={() => setEditForm(f => ({ ...f, agentIds: toggleId(f.agentIds, a.id) }))}
                              label={a.name}
                            />
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  </Field>
                )}
              </View>
            )}
          </View>
        )}
      </FormModal>

      {/* Deactivate confirm */}
      <ConfirmModal
        visible={!!toggleTarget}
        title="Deactivate user?"
        message={toggleTarget ? `${toggleTarget.name} will lose access until reactivated.` : ''}
        icon={<Power size={24} color={T.danger} />}
        tone="danger"
        confirmLabel={saving ? 'Deactivating…' : 'Deactivate'}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />

      {/* Delete confirm */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete user?"
        message={deleteTarget ? `This will permanently remove ${deleteTarget.name}. This cannot be undone.` : ''}
        icon={<Trash2 size={24} color={T.danger} />}
        tone="danger"
        confirmLabel={saving ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
};


/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: r.gutter, gap: r.gap, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' },
  count: { fontSize: r.rf(11.5), fontWeight: '600' },
  filters: { flexDirection: r.isTablet ? 'row' : 'column', gap: r.gap, alignItems: 'stretch' },
  filterCell: r.isTablet ? { flex: 1 } : {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  manager: { fontSize: r.rf(10.5), fontWeight: '800', letterSpacing: 0.3 },
  refChip: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  refChipTxt: { fontSize: r.rf(11), fontWeight: '800', letterSpacing: 0.2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: r.rs(46), alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
  fabWrap: { position: 'absolute', right: r.rs(18), bottom: r.rs(22) },
  err: { fontSize: r.rf(12), fontWeight: '600' },
  pickList: { borderWidth: 1.5, borderRadius: 13, padding: 12 },
  pickEmpty: { fontSize: r.rf(12), fontWeight: '500' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP },
});

export default B2CUserManagementScreen;
