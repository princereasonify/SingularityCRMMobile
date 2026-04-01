import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, X, Globe, UserCheck, Clock, Eye, EyeOff } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { authApi } from '../../api/auth';
import { UserDto, Region, Zone } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, RoleBadge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const CREATABLE_ROLES: Record<string, string[]> = {
  SCA: ['SH', 'RH', 'ZH', 'FO'],
  SH:  ['RH', 'ZH', 'FO'],
  RH:  ['ZH', 'FO'],
  ZH:  ['FO'],
};

export const UserManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'ZH';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

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
    setForm({ name: '', email: '', password: '', role: CREATABLE_ROLES[role]?.[0] || 'FO', zoneId: '', regionId: '' });
    setShowUserModal(true);
  };

  const openEdit = (u: any) => {
    const uName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
    setEditingUser(u);
    setForm({ name: uName, email: u.email, password: '', role: u.role, zoneId: u.zoneId || '', regionId: u.regionId || '' });
    setShowUserModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { Alert.alert('Error', 'Name and email are required'); return; }
    if (!editingUser && !form.password) { Alert.alert('Error', 'Password is required for new users'); return; }
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
        const regionId = role === 'ZH' ? (user?.regionId || undefined) : (form.regionId ? Number(form.regionId) : undefined);
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

  const handleDelete = (u: any) => {
    const uName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'this user';
    Alert.alert('Delete User', `Delete ${uName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await authApi.deleteUser(u.id);
          fetchData();
        } catch { Alert.alert('Error', 'Failed to delete user'); }
      }},
    ]);
  };

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

  const renderUser = ({ item }: { item: any }) => {
    const displayName = item.name || [item.firstName, item.lastName].filter(Boolean).join(' ') || '—';
    return (
    <Card style={styles.userCard}>
      <View style={styles.userRow}>
        <Avatar initials={item.avatar || displayName.charAt(0)} color={(ROLE_COLORS as any)[item.role]?.primary || '#6B7280'} size={44} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMeta}>
            <RoleBadge role={item.role} />
            {item.zone && <Text style={styles.metaText}>{item.zone}</Text>}
            {item.region && <Text style={styles.metaText}>{item.region}</Text>}
          </View>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Edit2 size={14} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Trash2 size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <DrawerMenuButton />
          <Text style={styles.headerTitle}>Manage Users</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={openCreate}>
            <Plus size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        {(role === 'SH' || role === 'SCA') && (
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
              <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>👥 Users</Text>
            </TouchableOpacity>
            {role === 'SCA' && (
              <TouchableOpacity style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
                <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
                  🕐 Pending{pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}
                </Text>
              </TouchableOpacity>
            )}
            {role === 'SH' && (
              <TouchableOpacity style={[styles.tab, tab === 'regions' && styles.tabActive]} onPress={() => setTab('regions')}>
                <Text style={[styles.tabText, tab === 'regions' && styles.tabTextActive]}>🌍 Regions</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} />
      ) : tab === 'pending' ? (
        <FlatList
          data={pendingUsers}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => {
            const pName = item.name || [item.firstName, item.lastName].filter(Boolean).join(' ') || '—';
            return (
            <Card style={styles.userCard}>
              <View style={styles.userRow}>
                <Avatar initials={item.avatar || pName.charAt(0)} color="#F59E0B" size={44} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{pName}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <View style={styles.userMeta}>
                    <RoleBadge role={item.role} />
                    {item.phoneNumber && <Text style={styles.metaText}>{item.phoneNumber}</Text>}
                  </View>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(item.id)}
                    disabled={approvingId === item.id || rejectingId === item.id}
                    activeOpacity={0.7}
                  >
                    {approvingId === item.id ? (
                      <Text style={styles.approveBtnText}>...</Text>
                    ) : (
                      <>
                        <UserCheck size={14} color="#FFF" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item.id)}
                    disabled={approvingId === item.id || rejectingId === item.id}
                    activeOpacity={0.7}
                  >
                    {rejectingId === item.id ? (
                      <Text style={styles.rejectBtnText}>...</Text>
                    ) : (
                      <>
                        <X size={14} color="#FFF" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
          }}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pendingUsers.length > 0 ? (
              <View style={styles.pendingHeader}>
                <Clock size={16} color="#D97706" />
                <Text style={styles.pendingHeaderText}>
                  Users who signed up and are waiting for approval
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState title="No pending approvals" subtitle="All signup requests have been reviewed" icon="✅" />}
        />
      ) : tab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={[styles.list, tablet && { maxWidth: 700, alignSelf: 'center', width: '100%' }]}
          ListEmptyComponent={<EmptyState title="No users found" icon="👥" />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Regions */}
          <Text style={styles.subTitle}>Regions ({regions.length})</Text>
          {regions.map((reg) => (
            <Card key={reg.id} style={styles.regionCard}>
              <View style={styles.regionRow}>
                <Globe size={16} color={COLOR.primary} />
                <Text style={styles.regionName}>{reg.name}</Text>
                <Text style={styles.regionZones}>{zones.filter((z) => z.regionId === reg.id).length} zones</Text>
              </View>
            </Card>
          ))}
          <Text style={[styles.subTitle, { marginTop: 16 }]}>Zones ({zones.length})</Text>
          {zones.map((zone) => {
            const reg = regions.find((r) => r.id === zone.regionId);
            return (
              <Card key={zone.id} style={styles.regionCard}>
                <View style={styles.regionRow}>
                  <Text style={styles.zoneIcon}>📍</Text>
                  <Text style={styles.regionName}>{zone.name}</Text>
                  {reg && <Text style={styles.regionZones}>{reg.name}</Text>}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* User Create/Edit Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowUserModal(false)}>
          <Pressable style={[styles.modalSheet, tablet && styles.modalTablet]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User' : 'Create User'}</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input label="Full Name *" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Arjun Mehta" accentColor={COLOR.primary} />
              <Input label="Email *" value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="email@educrm.in" accentColor={COLOR.primary} />
              <Input
                label={editingUser ? 'New Password (optional)' : 'Password *'}
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry={!showPwd}
                placeholder="••••••••"
                accentColor={COLOR.primary}
                rightIcon={showPwd ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                onRightIconPress={() => setShowPwd((v) => !v)}
              />
              <SelectPicker
                label="Role *"
                options={(CREATABLE_ROLES[role] || []).map((r) => ({ label: r, value: r }))}
                value={form.role}
                onChange={(v) => set('role', v)}
                accentColor={COLOR.primary}
              />
              {role === 'ZH' && !editingUser ? (
                <View style={styles.autoZoneBox}>
                  <Text style={styles.autoZoneLabel}>
                    <Text style={styles.autoZoneBold}>Zone: </Text>
                    {user?.zone || 'Your zone'}
                    {user?.region ? `  (${user.region})` : ''}
                  </Text>
                  <Text style={styles.autoZoneHint}>New user will be assigned to your zone automatically.</Text>
                </View>
              ) : (
                <>
                  {needsRegion && (
                    <SelectPicker
                      label="Region"
                      options={regions.map((r) => ({ label: r.name, value: r.id }))}
                      value={form.regionId}
                      onChange={(v) => { set('regionId', v); set('zoneId', ''); }}
                      accentColor={COLOR.primary}
                    />
                  )}
                  {needsZone && (
                    <SelectPicker
                      label="Zone"
                      options={filteredZones.map((z) => ({ label: z.name, value: z.id }))}
                      value={form.zoneId}
                      onChange={(v) => set('zoneId', v)}
                      accentColor={COLOR.primary}
                    />
                  )}
                </>
              )}
              <Button title={editingUser ? 'Update User' : 'Create User'} onPress={handleSave} loading={formLoading} color={COLOR.primary} size="lg" style={{ marginTop: 8, marginBottom: 32 }} />
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
  tabText: { fontSize: rf(12), color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  tabTextActive: { color: '#374151' },
  list: { padding: 12, gap: 8 },
  userCard: { padding: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userInfo: { flex: 1 },
  userName: { fontSize: rf(15), fontWeight: '600', color: '#111827' },
  userEmail: { fontSize: rf(12), color: '#6B7280', marginTop: 1, marginBottom: 4 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: rf(12), color: '#9CA3AF' },
  userActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: rf(14), fontWeight: '700', color: '#374151', marginBottom: 8 },
  regionCard: { padding: 14, marginBottom: 6 },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  regionName: { flex: 1, fontSize: rf(14), fontWeight: '600', color: '#111827' },
  regionZones: { fontSize: rf(12), color: '#9CA3AF' },
  zoneIcon: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%',
  },
  modalTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 24, marginBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#16A34A', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  approveBtnText: { fontSize: rf(12), fontWeight: '600', color: '#FFF' },
  pendingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  pendingHeaderText: { fontSize: rf(12), color: '#92400E', flex: 1 },
  pendingActions: { flexDirection: 'row', gap: 6 },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  rejectBtnText: { fontSize: rf(12), fontWeight: '600', color: '#FFF' },
  autoZoneBox: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  autoZoneLabel: { fontSize: rf(13), color: '#6B7280' },
  autoZoneBold: { fontWeight: '700', color: '#374151' },
  autoZoneHint: { fontSize: rf(11), color: '#9CA3AF', marginTop: 4 },
});
