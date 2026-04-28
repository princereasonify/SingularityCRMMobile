import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Pencil, Trash2, Map, MapPin, X, Check, Info } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({ visible, item, regions, isRhScoped, onClose, onSave, saving }: any) {
  const [name, setName] = useState(item?.name || '');
  const [regionId, setRegionId] = useState(item?.regionId ? String(item.regionId) : '');

  useEffect(() => {
    setName(item?.name || '');
    setRegionId(item?.regionId ? String(item.regionId) : '');
  }, [item]);

  const regionOptions = regions.map((r: any) => ({ value: String(r.id), label: r.name }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={em.overlay}>
        <View style={em.box}>
          <View style={em.header}>
            <Text style={em.title}>Edit {item?.type === 'region' ? 'Region' : 'Zone'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={em.label}>Name</Text>
          <TextInput
            style={em.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#9CA3AF"
          />
          {item?.type === 'zone' && (
            <SelectPicker
              label="Region"
              options={regionOptions}
              value={regionId}
              onChange={v => setRegionId(String(v))}
              accentColor="#0D9488"
              containerStyle={{ marginTop: 4 }}
            />
          )}
          <View style={em.actions}>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose}>
              <Text style={em.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[em.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={() => {
                if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
                if (item?.type === 'zone' && !regionId) { Alert.alert('Error', 'Region is required'); return; }
                onSave(name.trim(), regionId ? Number(regionId) : undefined);
              }}
            >
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Check size={14} color="#FFF" />}
              <Text style={em.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  label: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: rf(14), color: '#111827', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ visible, item, onClose, onDelete, deleting }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.box}>
          <View style={dm.iconWrap}>
            <Trash2 size={24} color="#DC2626" />
          </View>
          <Text style={dm.title}>Delete {item?.type === 'region' ? 'Region' : 'Zone'}</Text>
          <Text style={dm.msg}>Delete <Text style={{ fontWeight: '700' }}>{item?.name}</Text>? This cannot be undone.</Text>
          <View style={dm.actions}>
            <TouchableOpacity style={dm.cancelBtn} onPress={onClose}>
              <Text style={dm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[dm.deleteBtn, deleting && { opacity: 0.6 }]} onPress={onDelete} disabled={deleting}>
              <Text style={dm.deleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: rf(16), fontWeight: '700', color: '#111827', marginBottom: 6 },
  msg: { fontSize: rf(13), color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
  deleteText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const RegionsZonesScreen = () => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const canManageRegions = role === 'SH' || role === 'SCA';
  const canManageZones = ['RH', 'SH', 'SCA'].includes(role);
  const isRhScoped = role === 'RH';

  const [regions, setRegions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [newRegion, setNewRegion] = useState('');
  const [savingRegion, setSavingRegion] = useState(false);

  const [newZone, setNewZone] = useState('');
  const [newZoneRegionId, setNewZoneRegionId] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  const [zoneRegionFilter, setZoneRegionFilter] = useState('ALL');

  const [editItem, setEditItem] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (isRhScoped && user?.regionId) {
      setNewZoneRegionId(String(user.regionId));
      setZoneRegionFilter(String(user.regionId));
    }
  }, [isRhScoped, user?.regionId]);

  const showFlash = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3500);
  };

  async function refresh() {
    setLoading(true);
    try {
      const [regRes, zonesRes] = await Promise.all([
        authApi.getRegions().catch(() => ({ data: [] })),
        authApi.getZones().catch(() => ({ data: [] })),
      ]);
      setRegions(regRes.data || []);
      setZones(zonesRes.data || []);
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

  const handleCreateRegion = async () => {
    const name = newRegion.trim();
    if (!name) return;
    setSavingRegion(true);
    try {
      await authApi.createRegion(name);
      setNewRegion('');
      await refresh();
      showFlash('success', `Region "${name}" created`);
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message || 'Failed to create region');
    } finally {
      setSavingRegion(false);
    }
  };

  const handleCreateZone = async () => {
    const name = newZone.trim();
    if (!name || !newZoneRegionId) return;
    setSavingZone(true);
    try {
      await authApi.createZone(name, Number(newZoneRegionId));
      setNewZone('');
      if (!isRhScoped) setNewZoneRegionId('');
      await refresh();
      showFlash('success', `Zone "${name}" created`);
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message || 'Failed to create zone');
    } finally {
      setSavingZone(false);
    }
  };

  const handleEditSave = async (name: string, regionId?: number) => {
    if (!editItem) return;
    setEditSaving(true);
    try {
      if (editItem.type === 'region') {
        await authApi.updateRegion(editItem.id, name);
      } else {
        await authApi.updateZone(editItem.id, name, regionId!);
      }
      setEditItem(null);
      await refresh();
      showFlash('success', `${editItem.type === 'region' ? 'Region' : 'Zone'} updated`);
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

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
      showFlash('error', err?.response?.data?.message || 'Failed to delete');
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  const regionFilterOptions = [
    { value: 'ALL', label: `All regions (${zones.length})` },
    ...regions.map(r => ({ value: String(r.id), label: `${r.name} (${zones.filter(z => z.regionId === r.id).length})` })),
  ];

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Title */}
        <Text style={s.pageTitle}>Regions & Zones</Text>
        <Text style={s.pageSub}>
          {canManageRegions
            ? 'Add regions first, then zones. Used when assigning users.'
            : 'Add zones to your managed regions.'}
        </Text>

        {/* Flash */}
        {flash && (
          <View style={[s.flashBanner, { backgroundColor: flash.type === 'success' ? '#D1FAE5' : '#FEE2E2' }]}>
            {flash.type === 'success' ? <Check size={14} color="#059669" /> : <Info size={14} color="#DC2626" />}
            <Text style={[s.flashText, { color: flash.type === 'success' ? '#059669' : '#DC2626' }]}>{flash.msg}</Text>
          </View>
        )}

        {/* ─── REGIONS ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Map size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={s.sectionTitle}><Text style={{ color: '#2563EB', fontWeight: '800' }}>1. </Text>Regions <Text style={s.sectionCount}>({visibleRegions.length})</Text></Text>
              <Text style={s.sectionSub}>{canManageRegions ? 'Top-level regions' : isRhScoped ? 'Your assigned region' : 'Managed by Sales Head'}</Text>
            </View>
          </View>

          {canManageRegions && (
            <View style={s.addRow}>
              <TextInput
                style={s.addInput}
                value={newRegion}
                onChangeText={setNewRegion}
                placeholder="e.g. Gujarat"
                placeholderTextColor="#9CA3AF"
                editable={!savingRegion}
              />
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: '#2563EB' }, (!newRegion.trim() || savingRegion) && { opacity: 0.5 }]}
                onPress={handleCreateRegion}
                disabled={!newRegion.trim() || savingRegion}
              >
                {savingRegion ? <ActivityIndicator color="#FFF" size="small" /> : <Plus size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
          )}

          {visibleRegions.length === 0 ? (
            <View style={s.emptySmall}>
              <Map size={24} color="#D1D5DB" />
              <Text style={s.emptySmallText}>{canManageRegions ? 'No regions yet. Add one above.' : 'No region assigned.'}</Text>
            </View>
          ) : (
            visibleRegions.map((r: any) => (
              <View key={r.id} style={s.listItem}>
                <View style={[s.itemIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Map size={13} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{r.name}</Text>
                  <Text style={s.itemSub}>{r.zoneCount || 0} zone{(r.zoneCount || 0) === 1 ? '' : 's'}</Text>
                </View>
                {canManageRegions && (
                  <View style={s.itemActions}>
                    <TouchableOpacity style={s.editBtn} onPress={() => setEditItem({ type: 'region', id: r.id, name: r.name })}>
                      <Pencil size={13} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => setDeleteItem({ type: 'region', id: r.id, name: r.name })}>
                      <Trash2 size={13} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* ─── ZONES ─── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIcon, { backgroundColor: '#CCFBF1' }]}>
              <MapPin size={18} color="#0D9488" />
            </View>
            <View>
              <Text style={s.sectionTitle}><Text style={{ color: '#0D9488', fontWeight: '800' }}>2. </Text>Zones <Text style={s.sectionCount}>({zones.length})</Text></Text>
              <Text style={s.sectionSub}>{canManageZones ? 'Select a region, then add zones' : 'Read-only'}</Text>
            </View>
          </View>

          {canManageZones && (
            selectableRegions.length === 0 ? (
              <View style={[s.infoBanner]}>
                <Info size={14} color="#D97706" />
                <Text style={s.infoText}>
                  {isRhScoped ? 'No region is assigned to you.' : 'Add at least one region before creating zones.'}
                </Text>
              </View>
            ) : (
              <View style={s.addZoneBlock}>
                {!isRhScoped && (
                  <SelectPicker
                    placeholder="Select region"
                    options={selectableRegions.map((r: any) => ({ value: String(r.id), label: r.name }))}
                    value={newZoneRegionId}
                    onChange={v => setNewZoneRegionId(String(v))}
                    accentColor="#0D9488"
                    containerStyle={{ marginBottom: 8 }}
                  />
                )}
                <View style={s.addRow}>
                  <TextInput
                    style={s.addInput}
                    value={newZone}
                    onChangeText={setNewZone}
                    placeholder="e.g. Ahmedabad"
                    placeholderTextColor="#9CA3AF"
                    editable={!savingZone}
                  />
                  <TouchableOpacity
                    style={[s.addBtn, { backgroundColor: '#0D9488' }, (!newZone.trim() || !newZoneRegionId || savingZone) && { opacity: 0.5 }]}
                    onPress={handleCreateZone}
                    disabled={!newZone.trim() || !newZoneRegionId || savingZone}
                  >
                    {savingZone ? <ActivityIndicator color="#FFF" size="small" /> : <Plus size={18} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}

          {/* Zone region filter */}
          {!isRhScoped && regions.length > 0 && zones.length > 0 && (
            <SelectPicker
              placeholder="All regions"
              options={regionFilterOptions}
              value={zoneRegionFilter}
              onChange={v => setZoneRegionFilter(String(v))}
              accentColor="#0D9488"
              containerStyle={{ marginBottom: 8 }}
            />
          )}

          {filteredZones.length === 0 ? (
            <View style={s.emptySmall}>
              <MapPin size={24} color="#D1D5DB" />
              <Text style={s.emptySmallText}>{zones.length === 0 ? 'No zones yet.' : 'No zones in this region.'}</Text>
            </View>
          ) : (
            filteredZones.map((z: any) => (
              <View key={z.id} style={s.listItem}>
                <View style={[s.itemIcon, { backgroundColor: '#CCFBF1' }]}>
                  <MapPin size={13} color="#0D9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{z.name}</Text>
                  <Text style={s.itemSub}>{z.region || 'No region'}</Text>
                </View>
                {canManageZones && (
                  <View style={s.itemActions}>
                    <TouchableOpacity style={s.editBtn} onPress={() => setEditItem({ type: 'zone', id: z.id, name: z.name, regionId: z.regionId })}>
                      <Pencil size={13} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => setDeleteItem({ type: 'zone', id: z.id, name: z.name })}>
                      <Trash2 size={13} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <EditModal
        visible={!!editItem}
        item={editItem}
        regions={selectableRegions}
        isRhScoped={isRhScoped}
        onClose={() => setEditItem(null)}
        onSave={handleEditSave}
        saving={editSaving}
      />

      {/* Delete Modal */}
      <DeleteModal
        visible={!!deleteItem}
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  pageTitle: { fontSize: rf(20), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 8 },
  flashBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  flashText: { fontSize: rf(13), fontWeight: '600', flex: 1 },
  section: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  sectionCount: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '400' },
  sectionSub: { fontSize: rf(11), color: '#9CA3AF', marginTop: 1 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827' },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addZoneBlock: { gap: 0 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  infoText: { fontSize: rf(12), color: '#D97706', fontWeight: '500', flex: 1 },
  emptySmall: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptySmallText: { fontSize: rf(12), color: '#9CA3AF' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderRadius: 10 },
  itemIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  itemSub: { fontSize: rf(11), color: '#9CA3AF' },
  itemActions: { flexDirection: 'row', gap: 4 },
  editBtn: { padding: 6, borderRadius: 8, backgroundColor: '#DBEAFE' },
  delBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
});
