import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Plus, Mail, Trash2, Edit2, Check, AlertTriangle } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, Field, Input, SearchBar, Pagination, ListCard, Avatar, StatusBadge, Fab, FormModal, ConfirmModal, Toggle,
} from '../../components/crud';
import { Chip } from '../../components/ui';
import { b2cCounselorService, B2CCounselorQuery } from '../../api/b2c/b2cCounselorService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { invalidateFieldStaff } from '../../components/b2c/useFieldStaff';
import { B2CCounselorListDto, B2CCounselorDetailDto } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP, gridCardWidth} from '../../hooks/useResponsive';
import {
  PayoutFields, PayoutDetailsResponse, payoutState, payoutPayload, payoutFormFrom,
  EMPTY_PAYOUT, PAYOUT_HINT_OPTIONAL,
} from './B2CCreateUserScreen';

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
  // `search` is what's typed; `query` is what was last sent — 300ms behind, like web :58.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // Detail + edit
  const [detail, setDetail] = useState<B2CCounselorDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  // Email and the four payout fields belong to the underlying B2CUser, not the counselor
  // record — the counselor endpoint does not touch them. Web saves both in one action; this
  // screen could not edit them at all, so an admin had to open the web app to change a
  // counselor's email or bank details.
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', bio: '', specializations: [] as string[], isActive: true,
    email: '', ...EMPTY_PAYOUT,
  });
  // The fetched payout record, or null until (and unless) the fetch succeeds. handleUpdate
  // only sends payout fields when this is set: the server treats '' as "clear", so sending
  // the blank seed — mid-fetch, or after a failed fetch — would erase real KYC data.
  const [payoutData, setPayoutData] = useState<PayoutDetailsResponse | null>(null);
  // Gates Save while the per-person payout fetch is in flight.
  const [payoutLoading, setPayoutLoading] = useState(false);
  // Which B2CUser the open edit's payout fetch belongs to. A ref, so the async continuation
  // reads what is on screen NOW — a stale response must never land in another person's form.
  const openEditUserIdRef = useRef<number | null>(null);
  // Which detail fetch is current. Opening another counselor, or closing the modal, before an
  // earlier fetch resolves must not let that response repaint (or reopen) the modal.
  const detailTokenRef = useRef(0);
  // Latest list request wins — a slow page-1 response must not overwrite a newer search.
  const listTokenRef = useRef(0);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const fetchList = useCallback(async (pg: number, q: string) => {
    const token = ++listTokenRef.current;
    try {
      // The controller takes `search` (B2CCounselorsController.cs), but the shared query type
      // doesn't declare it yet — widened here rather than in the service file.
      const params: B2CCounselorQuery & { search?: string } = { page: pg, pageSize: PAGE_SIZE, search: q || undefined };
      const res = await b2cCounselorService.getCounselors(params);
      if (token !== listTokenRef.current) return;
      setItems(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      if (token !== listTokenRef.current) return;
      setItems([]); setTotalPages(1); setTotalCount(0);
    } finally {
      if (token === listTokenRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  // A new search always starts from page 1 (also the initial load).
  useEffect(() => { setPage(1); setLoading(true); fetchList(1, query); }, [fetchList, query]);
  useEffect(() => {
    b2cCounselorService.getSpecializations().then(res => setSpecs(res.data ?? [])).catch(() => {});
  }, []);

  // Add Counselor is its own (drawer) screen and this one stays mounted behind it, so the
  // list has to refetch on the way back or a brand-new counselor simply isn't there.
  // Refs so the focus refetch reloads whatever page/search is showing without re-firing (and
  // racing the search effect) every time either changes.
  const pageRef = useRef(page); pageRef.current = page;
  const queryRef = useRef(query); queryRef.current = query;
  useFocusEffect(useCallback(() => { fetchList(pageRef.current, queryRef.current); }, [fetchList]));

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchList(p, query);
  };

  const openDetail = async (id: number) => {
    const token = ++detailTokenRef.current;
    setDetailLoading(true);
    try {
      const res = await b2cCounselorService.getCounselorById(id);
      if (token !== detailTokenRef.current) return;
      setDetail(res.data); setEditing(false);
    } catch {
      if (token !== detailTokenRef.current) return;
      toast.error('Could not load this counselor.');
    } finally {
      if (token === detailTokenRef.current) setDetailLoading(false);
    }
  };

  /** Ends the edit's payout fetch ownership — a late response then has nowhere to land. */
  const endEdit = () => {
    openEditUserIdRef.current = null;
    setEditing(false);
    setPayoutData(null);
    setPayoutLoading(false);
  };

  // Bumps the token too: an in-flight fetch must never repaint the modal after it was closed.
  const closeDetail = () => {
    detailTokenRef.current++;
    setDetail(null);
    setDetailLoading(false);
    endEdit();
  };

  const startEdit = async () => {
    if (!detail) return;
    const userId = detail.userId ?? null;
    openEditUserIdRef.current = userId;
    setPayoutData(null);
    setPayoutLoading(!!userId);
    // Payout seeded blank and filled in when the fetch lands. Save is disabled meanwhile and
    // handleUpdate omits payout entirely until payoutData is set — see the state above.
    setEditForm({
      name: detail.name || '', mobile: detail.mobile ?? '', bio: detail.bio || '',
      specializations: detail.specializations || [], isActive: detail.isActive ?? true,
      email: detail.email || '',
      ...EMPTY_PAYOUT,
    });
    setNewPassword('');
    setEditing(true);

    // Non-fatal: if this fails the rest of the dialog still works and the payout fields
    // simply start empty, rather than one failed fetch blocking a rename.
    if (!userId) return;
    try {
      const res = await b2cUserService.getPayoutDetails(userId);
      if (openEditUserIdRef.current !== userId) return;
      const data = (res.data ?? {}) as PayoutDetailsResponse;
      setPayoutData(data);
      setEditForm(f => ({ ...f, ...payoutFormFrom(data) }));
    } catch {
      if (openEditUserIdRef.current !== userId) return;
      setPayoutData(null);
    } finally {
      if (openEditUserIdRef.current === userId) setPayoutLoading(false);
    }
  };

  const editKyc = payoutState(editForm);
  const canSaveEdit = !saving && !payoutLoading && !!editForm.name.trim() && !!editForm.email.trim()
    // Blocked on a value that is present but WRONG, never on merely incomplete.
    && !editKyc.hasErrors;

  const handleResetPassword = async () => {
    if (!detail?.userId || newPassword.trim().length < 6) return;
    setResetting(true);
    try {
      await b2cUserService.resetPassword(detail.userId, newPassword.trim());
      setNewPassword('');
      toast.success(`Password updated for ${detail.name}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update the password');
    } finally { setResetting(false); }
  };

  const handleUpdate = async () => {
    if (!detail || !canSaveEdit) return;
    setSaving(true);
    try {
      await b2cCounselorService.updateCounselor(detail.id, {
        name: editForm.name.trim(),
        mobile: editForm.mobile.trim(),
        bio: editForm.bio.trim() || null,
        specializations: editForm.specializations,
        isActive: editForm.isActive,
      });

      // Same action, second record: email and payout live on the B2CUser, so saving only the
      // counselor would leave those edits silently discarded.
      if (detail.userId) {
        await b2cUserService.updateUser(detail.userId, {
          email: editForm.email.trim(),
          // Only once the fetch actually succeeded: omitted is "leave alone" server-side,
          // whereas the blank seed would be read as "clear" and wipe real KYC. Save is also
          // disabled while payoutLoading — this is defense in depth.
          ...(payoutData ? payoutPayload(editForm) : {}),
        });
      }

      closeDetail();
      invalidateFieldStaff();
      toast.success('Counsellor updated');
      fetchList(page, query);
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
      setConfirmDelete(null); closeDetail();
      invalidateFieldStaff();
      toast.success('Counsellor deleted');
      fetchList(page, query);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete counselor');
    } finally { setSaving(false); }
  };

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  // Columns come from the shared responsive rule (1 phone / 2 tablet / 3 wide) rather than a
  // hard-coded 2, so a wide iPad — especially with the sidebar collapsed to a rail — fills the
  // row instead of leaving a third of it blank.
   // Shared rule: exact points, and columns capped at the number of cards.
  const cardW = gridCardWidth(r, items.length);

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchList(page, query); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.count, { color: T.dim }]}>{totalCount} counselor{totalCount === 1 ? '' : 's'}</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or email…" />

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : items.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>{query ? 'No counselors match your search' : 'No counselors yet'}</Text>
            {!query && <Text style={[s.emptyTxt, { color: T.dim }]}>Add your first counselor with the + button.</Text>}
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
      <FormModal wide={r.isTablet} visible={detailLoading || !!detail} title={editing ? 'Edit Counselor' : (detail?.name || 'Counselor')} onClose={closeDetail}
        footer={!detail ? undefined : editing
          ? <><Btn label="Cancel" variant="secondary" onPress={endEdit} style={{ flex: 1 }} /><Btn label={saving ? 'Saving…' : payoutLoading ? 'Loading payout details…' : 'Save'} onPress={handleUpdate} loading={saving} disabled={!canSaveEdit} style={{ flex: 1 }} /></>
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
              <View style={s.statBox}><Text style={[s.statNum, { color: T.text }]}>{detail.avgAiScore != null ? detail.avgAiScore.toFixed(1) : '—'}</Text><Text style={[s.statLbl, { color: T.dim }]}>Avg AI Score</Text></View>
              <View style={s.statBox}><Text style={[s.statNum, { color: T.text }]}>{detail.conversionRate != null ? `${Math.round(detail.conversionRate)}%` : '—'}</Text><Text style={[s.statLbl, { color: T.dim }]}>Conversion</Text></View>
            </View>
          </View>
        )}
        {detail && editing && (
          <View style={{ gap: 12 }}>
            <Input label="Name" value={editForm.name} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} placeholder="Counselor name" />
            <Input label="Mobile" value={editForm.mobile} onChangeText={v => setEditForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Input label="Email" value={editForm.email} onChangeText={v => setEditForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="counselor@example.com" />

            {/* Payout identity — saved to the underlying user in the same action as the rest,
                through the same field set and rules as Add User. Not required here: people who
                predate the fields fill them in over time; anything typed is still validated. */}
            <View style={[s.payoutBlock, { borderTopColor: T.line }]}>
              <Text style={[s.sectionTitle, { color: T.accent }]}>Payout Details</Text>
              <Text style={[s.hint, { color: T.dim }]}>{PAYOUT_HINT_OPTIONAL}</Text>
              {payoutData && (
                <View style={[s.banner, { backgroundColor: (payoutData.isComplete ? T.success : T.warning) + '1F' }]}>
                  {payoutData.isComplete
                    ? <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
                    : <AlertTriangle size={14} color={T.warning} strokeWidth={ICON_STROKE} />}
                  <Text style={[s.bannerTxt, { color: payoutData.isComplete ? T.success : T.warning }]}>
                    {payoutData.isComplete
                      ? 'All payout details on file — this person can be paid.'
                      : `Still needed: ${(payoutData.missing ?? []).join(', ')}.`}
                  </Text>
                </View>
              )}
              <PayoutFields
                values={editForm}
                onChange={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
                colW="100%"
              />
            </View>

            {/* Its own action, not part of Save: a password change is immediate and must not
                ride along with an unrelated rename the admin may still be editing. */}
            <Field label="Reset Password">
              <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password (min 6 characters)" />
              <Btn
                label={resetting ? 'Resetting…' : 'Reset Password'}
                variant="secondary" small loading={resetting}
                disabled={resetting || newPassword.trim().length < 6}
                onPress={handleResetPassword}
                style={{ marginTop: 8 }}
              />
            </Field>
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
  hint: { fontSize: r.rf(11.5), fontWeight: '500' },
  sectionTitle: { fontWeight: '700', fontSize: r.rf(12), letterSpacing: 1, textTransform: 'uppercase' },
  payoutBlock: { gap: 12, paddingTop: 12, borderTopWidth: 1 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10 },
  bannerTxt: { flex: 1, fontSize: r.rf(12), fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP },
});
