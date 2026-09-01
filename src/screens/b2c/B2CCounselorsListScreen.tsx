import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Plus, Mail, Trash2, Edit2 } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, Field, Input, Pagination, ListCard, Avatar, StatusBadge, Fab, FormModal, ConfirmModal, Toggle,
} from '../../components/crud';
import { Chip } from '../../components/ui';
import { b2cCounselorService } from '../../api/b2c/b2cCounselorService';
import { invalidateFieldStaff } from '../../components/b2c/useFieldStaff';
import { B2CCounselorListDto, B2CCounselorDetailDto } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP } from '../../hooks/useResponsive';

const PAGE_SIZE = 20;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

export const B2CCounselorsListScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<B2CCounselorListDto[]>([]);
  const [specs, setSpecs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Detail + edit
  const [detail, setDetail] = useState<B2CCounselorDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', mobile: '', bio: '', specializations: [] as string[], isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const fetchList = useCallback(async (pg = 1) => {
    try {
      const res = await b2cCounselorService.getCounselors({ page: pg, pageSize: PAGE_SIZE });
      setItems(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      setItems([]); setTotalPages(1); setTotalCount(0);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); fetchList(1); }, [fetchList]);
  useEffect(() => {
    b2cCounselorService.getSpecializations().then(res => setSpecs(res.data ?? [])).catch(() => {});
  }, []);

  // Add Counselor is its own (drawer) screen and this one stays mounted behind it, so the
  // list has to refetch on the way back or a brand-new counselor simply isn't there.
  useFocusEffect(useCallback(() => { fetchList(page); }, [fetchList, page]));

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchList(p);
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await b2cCounselorService.getCounselorById(id);
      setDetail(res.data); setEditing(false);
    } catch {
      toast.error('Could not load this counselor.');
    } finally { setDetailLoading(false); }
  };

  const startEdit = () => {
    if (!detail) return;
    setEditForm({
      name: detail.name || '', mobile: detail.mobile ?? '', bio: detail.bio || '',
      specializations: detail.specializations || [], isActive: detail.isActive ?? true,
    });
    setEditing(true);
  };

  const handleUpdate = async () => {
    if (!detail || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await b2cCounselorService.updateCounselor(detail.id, {
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        bio: editForm.bio.trim() || null,
        specializations: editForm.specializations,
        isActive: editForm.isActive,
      });
      setDetail(null); setEditing(false);
      invalidateFieldStaff();
      toast.success('Counsellor updated');
      fetchList(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update counselor');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    // `saving` gates the confirm button too — a slow delete used to accept a second tap.
    setSaving(true);
    try {
      await b2cCounselorService.deleteCounselor(confirmDelete.id);
      setConfirmDelete(null); setDetail(null);
      invalidateFieldStaff();
      toast.success('Counsellor deleted');
      fetchList(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete counselor');
    } finally { setSaving(false); }
  };

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchList(page); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.count, { color: T.dim }]}>{totalCount} counselor{totalCount === 1 ? '' : 's'}</Text>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : items.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No counselors yet</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Add your first counselor with the + button.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {items.map(c => (
                <ListCard key={c.id} onPress={() => openDetail(c.id)} style={{ alignItems: 'flex-start', width: cardW }}>
                  <Avatar initials={initialsOf(c.name)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                      {!c.isActive && <StatusBadge label="Inactive" color={T.danger} />}
                    </View>
                    <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{c.email}</Text>
                    {c.specializations.length > 0 && <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>{c.specializations.join(', ')}</Text>}
                    <Text style={[s.sub, { color: T.dim }]}>{c.activeLeadsCount} active lead{c.activeLeadsCount === 1 ? '' : 's'}{c.avgAiScore != null ? ` · AI ${c.avgAiScore.toFixed(1)}` : ''}</Text>
                  </View>
                </ListCard>
              ))}
            </View>
            {totalPages > 1 && (
              <View style={s.pgRow}><Pagination page={page} pageCount={totalPages} onChange={goToPage} /></View>
            )}
          </>
        )}
        <View style={{ height: 72 }} />
      </ScrollView>

      <View style={s.fabWrap}>
        <Fab label="Add Counselor" onPress={() => navigation.navigate('Add Counselor')}>
          <Plus size={22} color="#FFF" strokeWidth={2.4} />
        </Fab>
      </View>

      {/* Detail / edit modal */}
      <FormModal wide={r.isTablet} visible={detailLoading || !!detail} title={editing ? 'Edit Counselor' : (detail?.name || 'Counselor')} onClose={() => { setDetail(null); setEditing(false); }}
        footer={!detail ? undefined : editing
          ? <><Btn label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} /><Btn label={saving ? 'Saving…' : 'Save'} onPress={handleUpdate} loading={saving} disabled={saving || !editForm.name.trim()} style={{ flex: 1 }} /></>
          : <><Btn label="Delete" variant="dangerGhost" onPress={() => detail && setConfirmDelete({ id: detail.id, name: detail.name })} icon={<Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />} style={{ flex: 1 }} /><Btn label="Edit" onPress={startEdit} icon={<Edit2 size={14} color="#FFF" strokeWidth={ICON_STROKE} />} style={{ flex: 1 }} /></>}
      >
        {detailLoading && !detail && (
          <ActivityIndicator color={T.accent} style={{ marginVertical: 24 }} />
        )}
        {detail && !editing && (
          <View style={{ gap: 12 }}>
            <View style={s.dHeader}>
              <Avatar initials={initialsOf(detail.name)} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: T.text }]}>{detail.name}</Text>
                <View style={s.dMail}><Mail size={11} color={T.dim} /><Text style={[s.sub, { color: T.dim }]}>{detail.email}</Text></View>
              </View>
              {!detail.isActive && <StatusBadge label="Inactive" color={T.danger} />}
            </View>
            {detail.specializations.length > 0 && (
              <View style={s.chipWrap}>{detail.specializations.map(sp => <Chip key={sp} label={sp} />)}</View>
            )}
            {!!detail.bio && <Text style={[s.bio, { color: T.sub }]}>{detail.bio}</Text>}
            <View style={s.statsRow}>
              <View style={s.statBox}><Text style={[s.statNum, { color: T.text }]}>{detail.activeLeadsCount}</Text><Text style={[s.statLbl, { color: T.dim }]}>Active</Text></View>
              <View style={s.statBox}><Text style={[s.statNum, { color: T.text }]}>{detail.totalSessionsRecorded}</Text><Text style={[s.statLbl, { color: T.dim }]}>Sessions</Text></View>
              <View style={s.statBox}><Text style={[s.statNum, { color: T.text }]}>{detail.conversionRate != null ? `${Math.round(detail.conversionRate)}%` : '—'}</Text><Text style={[s.statLbl, { color: T.dim }]}>Conversion</Text></View>
            </View>
          </View>
        )}
        {detail && editing && (
          <View style={{ gap: 12 }}>
            <Input label="Name" value={editForm.name} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} placeholder="Counselor name" />
            <Input label="Mobile" value={editForm.mobile} onChangeText={v => setEditForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Field label="Specializations">
              {specs.length === 0 ? <Text style={{ color: T.dim, fontSize: r.rf(12) }}>No specializations available</Text> : (
                <View style={s.chipWrap}>
                  {specs.map(sp => (
                    <Chip key={sp} label={sp} active={editForm.specializations.includes(sp)} onPress={() => setEditForm(f => ({ ...f, specializations: toggleIn(f.specializations, sp) }))} />
                  ))}
                </View>
              )}
            </Field>
            <Field label="Bio">
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput value={editForm.bio} onChangeText={v => setEditForm(f => ({ ...f, bio: v }))} placeholder="Short bio…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
              </View>
            </Field>
            <View style={s.activeRow}>
              <Text style={[s.name, { color: T.text }]}>Active</Text>
              <Toggle on={editForm.isActive} onToggle={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))} />
            </View>
          </View>
        )}
      </FormModal>

      <ConfirmModal visible={!!confirmDelete} title="Delete Counselor" message={`Remove ${confirmDelete?.name}? This cannot be undone.`} icon={<Trash2 size={24} color={T.danger} />} tone="danger" confirmLabel={saving ? 'Deleting…' : 'Delete'} loading={saving} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: r.rs(46), alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
  fabWrap: { position: 'absolute', right: r.rs(18), bottom: r.rs(22) },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textarea: { minHeight: r.rs(72), borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: r.rs(52) },
  dHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dMail: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  bio: { fontSize: r.rf(13), fontWeight: '500', lineHeight: r.rf(19) },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: r.rf(18), fontWeight: '800' },
  statLbl: { fontSize: r.rf(10.5), fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP },
});
