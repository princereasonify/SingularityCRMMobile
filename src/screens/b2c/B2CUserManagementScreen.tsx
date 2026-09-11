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
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP, gridCardWidth} from '../../hooks/useResponsive';

const PAGE_SIZE = 20;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

type RoleFilter = '' | 'Agent' | 'Counselor' | 'B2CAdmin';
type StatusFilter = '' | 'active' | 'inactive';

// Local alias — this screen only ever deals with the roster list shape.
type B2CUser = B2CUserListDto;

const toggleId = (arr: number[], id: number) =>
  arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

export const B2CUserManagementScreen = () => {
  const { user: me } = useAuth();
  /** Your own row — the server refuses a self-deactivate and a self-delete outright. */
  const isSelf = (u: { id: number }) => u.id === me?.id;
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
  // Reset-password lives in this dialog on web and had no mobile equivalent at all — so the
  // thing an admin most often needs to do away from a desk (an agent locked out mid-shift)
  // was the one thing only the desktop could do.
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', address: '', bio: '', referralCode: '', isActive: true, isManager: false, agentIds: [] as number[],
    // Payout identity, fetched per-user when the dialog opens. Web has had these since the
    // dialog was built; without them an admin could not correct a wrong bank account from
    // a phone, which is exactly when a failed payout gets noticed.
    panNumber: '', aadhaarNumber: '', accountNumber: '', ifscCode: '',
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
    setNewPassword('');
    // Seed the whole form FIRST, payout blank, then fill payout in when the fetch lands.
    // The other way round, this reset would wipe the fetched values whenever the request
    // happened to win the race.
    setEditForm({
      name: u.name || '',
      mobile: u.mobile || '',
      address: u.address || '',
      bio: u.bio || '',
      referralCode: u.referralCode || '',
      isActive: u.isActive ?? true,
      isManager: u.isManager ?? false,
      agentIds: u.teamAgentIds || [],
      panNumber: '', aadhaarNumber: '', accountNumber: '', ifscCode: '',
    });
    setEditErr('');

    // Non-fatal: a failed fetch leaves the payout fields empty rather than blocking a rename.
    b2cUserService.getPayoutDetails(u.id)
      .then(res => setEditForm(f => ({
        ...f,
        panNumber: res.data?.panNumber || '',
        aadhaarNumber: res.data?.aadhaarNumber || '',
        accountNumber: res.data?.accountNumber || '',
        ifscCode: res.data?.ifscCode || '',
      })))
      .catch(() => {});
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true); setEditErr('');
    try {
      await b2cUserService.updateUser(editUser.id, {
        panNumber: editForm.panNumber.trim(),
        aadhaarNumber: editForm.aadhaarNumber.trim(),
        accountNumber: editForm.accountNumber.trim(),
        ifscCode: editForm.ifscCode.trim().toUpperCase(),
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        address: editForm.address.trim(),
        bio: editUser.role === 'Counselor' ? editForm.bio.trim() : undefined,
        referralCode: editForm.referralCode.trim(),
        isActive: editForm.isActive,
        isManager: editUser.role === 'Agent' ? editForm.isManager : undefined,
        agentIds: editUser.role === 'Agent' && editForm.isManager ? editForm.agentIds : undefined,
      });
      closeEdit();
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
  const closeEdit = () => { setEditUser(null); setNewPassword(''); };

  const handleResetPassword = async () => {
    if (!editUser || newPassword.trim().length < 6) return;
    setResetting(true);
    setEditErr('');
    try {
      await b2cUserService.resetPassword(editUser.id, newPassword.trim());
      setNewPassword('');
      toast.success(`Password reset for ${editUser.name}`);
    } catch (e: any) {
      setEditErr(e?.response?.data?.message || 'Could not reset the password.');
    } finally {
      setResetting(false);
    }
  };

  const editSelectableAgents = allAgents.filter(a => a.id !== editUser?.id);

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  // Columns come from the shared responsive rule (1 phone / 2 tablet / 3 wide) rather than a
  // hard-coded 2, so a wide iPad — especially with the sidebar collapsed to a rail — fills the
  // row instead of leaving a third of it blank.
   // Shared rule: exact points, and columns capped at the number of cards.
  const cardW = gridCardWidth(r, paged.length);

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
            options={[{ label: 'All', value: '' }, { label: 'Agents', value: 'Agent' }, { label: 'Counselors', value: 'Counselor' }, { label: 'Admins', value: 'B2CAdmin' }]}
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
                    {/* Edit stays on your own row — that is how an admin resets their own
                        password. Deactivate and Delete do not: the server refuses both for
                        your own account, so offering them only invites a failed tap. */}
                    <View style={s.actions}>
                      {!isSelf(u) && (
                        <IconBtn kind="view" label={u.isActive ? 'Deactivate' : 'Activate'} onPress={() => handleToggle(u)}>
                          <Power size={15} color={u.isActive ? T.success : T.dim} strokeWidth={ICON_STROKE} />
                        </IconBtn>
                      )}
                      <IconBtn kind="edit" label="Edit" onPress={() => openEdit(u)}>
                        <Edit2 size={15} color={T.text} strokeWidth={ICON_STROKE} />
                      </IconBtn>
                      {!isSelf(u) && (
                        <IconBtn kind="del" label="Delete" onPress={() => setDeleteTarget(u)}>
                          <Trash2 size={15} color={T.danger} strokeWidth={ICON_STROKE} />
                        </IconBtn>
                      )}
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
        onClose={closeEdit}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={closeEdit} style={{ flex: 1 }} />
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
            {/* Payout identity — saved with the rest of the dialog. */}
            <Input label="PAN" value={editForm.panNumber} onChangeText={v => setEditForm(f => ({ ...f, panNumber: v.toUpperCase() }))} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" />
            <Input label="Aadhaar" value={editForm.aadhaarNumber} onChangeText={v => setEditForm(f => ({ ...f, aadhaarNumber: v.replace(/\D/g, '').slice(0, 12) }))} keyboardType="number-pad" maxLength={12} placeholder="12-digit Aadhaar" />
            <Input label="Bank Account" value={editForm.accountNumber} onChangeText={v => setEditForm(f => ({ ...f, accountNumber: v.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="Account number" />
            <Input label="IFSC" value={editForm.ifscCode} onChangeText={v => setEditForm(f => ({ ...f, ifscCode: v.toUpperCase() }))} autoCapitalize="characters" maxLength={11} placeholder="HDFC0001234" />

            {/* Its own action, not part of Save: a password change is immediate and must not
                ride along with an unrelated rename the admin may still be editing. */}
            <Field label="Reset Password">
              <Input
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 6 characters)"
                secureTextEntry
              />
              <Btn
                label={resetting ? 'Resetting…' : 'Reset Password'}
                variant="secondary"
                small
                loading={resetting}
                disabled={resetting || newPassword.trim().length < 6}
                onPress={handleResetPassword}
                style={{ marginTop: 8 }}
              />
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
