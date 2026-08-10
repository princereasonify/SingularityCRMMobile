import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Power, Edit2, Trash2 } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Segmented, Pagination, ListCard, Avatar, StatusBadge,
  Fab, Btn, IconBtn, Input, Field, Checkbox, Toggle, FormModal, ConfirmModal,
} from '../../components/crud';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

const PAGE_SIZE = 20;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

type RoleFilter = '' | 'Agent' | 'Counselor';
type StatusFilter = '' | 'active' | 'inactive';

interface B2CUser {
  id: number;
  name: string;
  email?: string;
  mobile?: string;
  address?: string;
  bio?: string;
  role: string;
  isActive: boolean;
  isManager?: boolean;
  teamSize?: number;
  teamAgentIds?: number[];
  managerName?: string;
}

const emptyCreate = {
  name: '', email: '', mobile: '', address: '', password: '',
  role: 'Agent' as 'Agent' | 'Counselor', bio: '', isManager: false, agentIds: [] as number[],
};

const toggleId = (arr: number[], id: number) =>
  arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

export const B2CUserManagementScreen = () => {
  const T = useAppTheme();
  const toast = useToast();

  const [users, setUsers] = useState<B2CUser[]>([]);
  const [allAgents, setAllAgents] = useState<B2CUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createErr, setCreateErr] = useState('');

  // Edit
  const [editUser, setEditUser] = useState<B2CUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', address: '', bio: '', isActive: true, isManager: false, agentIds: [] as number[],
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
      const list: B2CUser[] = res.data?.items ?? res.data ?? [];
      setUsers(list);
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
      .then(res => setAllAgents(res.data?.items ?? res.data ?? []))
      .catch(() => setAllAgents([]));
  }, []);

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

  // ── Create ──────────────────────────────────────────────────────────────
  const openCreate = () => { setCreateForm(emptyCreate); setCreateErr(''); setShowCreate(true); };

  const handleCreate = async () => {
    setSaving(true); setCreateErr('');
    try {
      await b2cUserService.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        mobile: createForm.mobile.trim(),
        address: createForm.address.trim() || undefined,
        password: createForm.password,
        role: createForm.role,
        bio: createForm.role === 'Counselor' ? createForm.bio.trim() || undefined : undefined,
        isManager: createForm.role === 'Agent' ? createForm.isManager : false,
        agentIds: createForm.role === 'Agent' && createForm.isManager ? createForm.agentIds : undefined,
      });
      setShowCreate(false);
      toast.success('User created');
      setLoading(true); load();
    } catch (err: any) {
      setCreateErr(err?.response?.data?.message || 'Failed to create user');
      toast.error(err?.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (u: B2CUser) => {
    setEditUser(u);
    setEditForm({
      name: u.name || '',
      mobile: u.mobile || '',
      address: u.address || '',
      bio: u.bio || '',
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
        isActive: editForm.isActive,
        isManager: editUser.role === 'Agent' ? editForm.isManager : undefined,
        agentIds: editUser.role === 'Agent' && editForm.isManager ? editForm.agentIds : undefined,
      });
      setEditUser(null);
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
      toast.success('User deleted');
      setLoading(true); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user');
    } finally { setSaving(false); }
  };

  const createValid =
    createForm.name.trim() && createForm.email.trim() && createForm.mobile.trim() && createForm.password.length >= 6;

  // Agents this manager can oversee (exclude the edited user itself).
  const editSelectableAgents = allAgents.filter(a => a.id !== editUser?.id);

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

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, email, mobile…" />

        <Segmented<RoleFilter>
          value={role}
          onChange={setRole}
          options={[{ label: 'All', value: '' }, { label: 'Agents', value: 'Agent' }, { label: 'Counselors', value: 'Counselor' }]}
        />
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[{ label: 'Any', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        />

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No users found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Add an agent or counselor with the + button.</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              {paged.map(u => (
                <ListCard key={u.id} style={{ alignItems: 'flex-start' }}>
                  <Avatar initials={initialsOf(u.name)} color={roleColor(u.role)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{u.name}</Text>
                      <StatusBadge label={u.role} color={roleColor(u.role)} />
                      <StatusBadge label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? T.success : T.danger} />
                    </View>
                    {!!u.email && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{u.email}</Text>}
                    {!!u.mobile && <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>{u.mobile}</Text>}
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
        <Fab label="Add User" onPress={openCreate}>
          <Plus size={22} color="#FFF" strokeWidth={2.4} />
        </Fab>
      </View>

      {/* Create */}
      <FormModal
        visible={showCreate}
        title="Add User"
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
            <Btn label={saving ? 'Creating…' : 'Create User'} onPress={handleCreate} loading={saving} disabled={!createValid || saving} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          {!!createErr && <Text style={[s.err, { color: T.danger }]}>{createErr}</Text>}
          <Field label="Role">
            <Segmented<'Agent' | 'Counselor'>
              value={createForm.role}
              onChange={v => setCreateForm(f => ({ ...f, role: v }))}
              options={[{ label: 'Agent', value: 'Agent' }, { label: 'Counselor', value: 'Counselor' }]}
            />
          </Field>
          <Input label="Full Name *" value={createForm.name} onChangeText={v => setCreateForm(f => ({ ...f, name: v }))} placeholder="Full name" />
          <Input label="Email *" value={createForm.email} onChangeText={v => setCreateForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="user@example.com" />
          <Input label="Mobile *" value={createForm.mobile} onChangeText={v => setCreateForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" placeholder="10-digit mobile" />
          <Input label="Password *" value={createForm.password} onChangeText={v => setCreateForm(f => ({ ...f, password: v }))} secureTextEntry placeholder="Temporary password (min 6 chars)" />
          <Field label="Address">
            <Input value={createForm.address} onChangeText={v => setCreateForm(f => ({ ...f, address: v }))} placeholder="Residential / base address" multiline />
          </Field>
          {createForm.role === 'Counselor' && (
            <Field label="Bio">
              <Input value={createForm.bio} onChangeText={v => setCreateForm(f => ({ ...f, bio: v }))} placeholder="Short bio…" multiline />
            </Field>
          )}
          {createForm.role === 'Agent' && (
            <View style={{ gap: 12 }}>
              <Checkbox
                on={createForm.isManager}
                onToggle={() => setCreateForm(f => ({ ...f, isManager: !f.isManager }))}
                label="Also a Manager (oversees a team)"
              />
              {createForm.isManager && (
                <Field label="Agents under this manager">
                  <View style={[s.pickList, { borderColor: T.line }]}>
                    {allAgents.length === 0 ? (
                      <Text style={[s.pickEmpty, { color: T.dim }]}>No agents yet.</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
                        {allAgents.map(a => (
                          <Checkbox
                            key={a.id}
                            on={createForm.agentIds.includes(a.id)}
                            onToggle={() => setCreateForm(f => ({ ...f, agentIds: toggleId(f.agentIds, a.id) }))}
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
      </FormModal>

      {/* Edit */}
      <FormModal
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

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  manager: { fontSize: rf(10.5), fontWeight: '800', letterSpacing: 0.3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
  fabWrap: { position: 'absolute', right: 18, bottom: 22 },
  err: { fontSize: rf(12), fontWeight: '600' },
  pickList: { borderWidth: 1.5, borderRadius: 13, padding: 12 },
  pickEmpty: { fontSize: rf(12), fontWeight: '500' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

export default B2CUserManagementScreen;
