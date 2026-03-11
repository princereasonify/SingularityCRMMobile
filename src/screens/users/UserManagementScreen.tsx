import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, X, Globe } from 'lucide-react-native';
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
  SH: ['RH', 'ZH', 'FO'],
  RH: ['ZH', 'FO'],
  ZH: ['FO'],
};

export const UserManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'ZH';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [tab, setTab] = useState<'users' | 'regions'>('users');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: CREATABLE_ROLES[role]?.[0] || 'FO',
    zoneId: '' as any, regionId: '' as any,
  });

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, regRes, zoneRes] = await Promise.all([
        authApi.getUsers(),
        authApi.getRegions(),
        authApi.getZones(),
      ]);
      setUsers(usersRes.data);
      setRegions(regRes.data);
      setZones(zoneRes.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: CREATABLE_ROLES[role]?.[0] || 'FO', zoneId: '', regionId: '' });
    setShowUserModal(true);
  };

  const openEdit = (u: UserDto) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, zoneId: u.zoneId || '', regionId: u.regionId || '' });
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
        await authApi.createUser({
          name: form.name, email: form.email, password: form.password,
          role: form.role,
          zoneId: form.zoneId ? Number(form.zoneId) : undefined,
          regionId: form.regionId ? Number(form.regionId) : undefined,
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

  const handleDelete = (u: UserDto) => {
    Alert.alert('Delete User', `Delete ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await authApi.deleteUser(u.id);
          fetchData();
        } catch { Alert.alert('Error', 'Failed to delete user'); }
      }},
    ]);
  };

  const filteredZones = form.regionId ? zones.filter((z) => z.regionId === Number(form.regionId)) : zones;
  const needsZone = ['FO', 'ZH'].includes(form.role);
  const needsRegion = ['ZH', 'RH', 'FO'].includes(form.role);

  const renderUser = ({ item }: { item: UserDto }) => (
    <Card style={styles.userCard}>
      <View style={styles.userRow}>
        <Avatar initials={item.avatar || item.name.charAt(0)} color={ROLE_COLORS[item.role]?.primary || '#6B7280'} size={44} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Manage Users</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={openCreate}>
            <Plus size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        {role === 'SH' && (
          <View style={styles.tabRow}>
            {(['users', 'regions'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'users' ? '👥 Users' : '🌍 Regions & Zones'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} />
      ) : tab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 12 } : undefined}
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
              <Input label={editingUser ? 'New Password (optional)' : 'Password *'} value={form.password} onChangeText={(v) => set('password', v)} secureTextEntry placeholder="••••••••" accentColor={COLOR.primary} />
              <SelectPicker
                label="Role *"
                options={(CREATABLE_ROLES[role] || []).map((r) => ({ label: r, value: r }))}
                value={form.role}
                onChange={(v) => set('role', v)}
                accentColor={COLOR.primary}
              />
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
});
