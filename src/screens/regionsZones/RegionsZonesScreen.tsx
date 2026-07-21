import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, Map, MapPin, Check, Info } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge,
  ListCard, FormModal, ConfirmModal,
} from '../../components/crud';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

const DASH = '—';

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

  async function refresh() {
    setLoading(true);
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
        showFlash('success', 'Region updated');
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
        showFlash('success', 'Zone updated');
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
      // Surface the backend guard clearly (e.g. RH deleting a zone with assigned users
      // gets "Cannot delete zone with assigned users").
      showFlash('error', err?.response?.data?.message || 'Failed to delete');
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
              label={editingRegion ? 'Save' : 'Create'}
              onPress={saveRegion}
              loading={savingRegion}
              disabled={savingRegion || !regionName.trim()}
              small
            />
          </>
        }
      >
        <Input
          label="Region Name *"
          value={regionName}
          onChangeText={setRegionName}
          placeholder="e.g. Gujarat"
          autoFocus
        />
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
              label={editingZone ? 'Save' : 'Create'}
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
        </View>
      </FormModal>

      {/* Delete confirm — dependents error is surfaced via the flash banner. */}
      <ConfirmModal
        visible={!!deleteItem}
        tone="danger"
        title={`Delete ${deleteItem?.type === 'region' ? 'Region' : 'Zone'}?`}
        message={
          deleteItem?.type === 'zone'
            ? `${deleteItem?.name || 'This zone'} will be removed. A zone with assigned users can't be deleted.`
            : `${deleteItem?.name || 'This region'} will be permanently removed. This can't be undone.`
        }
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
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
});
