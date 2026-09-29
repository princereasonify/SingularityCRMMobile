/**
 * Purchase Order & Invoice — mobile twin of web's SalesDocuments.jsx list (the Generate/Edit
 * form lives in SalesDocumentEditorScreen). Every B2B role generates documents; SH/SCA also see
 * everyone's. The admin-only Register/Excel tab from web is not built here yet — the per-type
 * list below is the core gap this closes (a field officer had no mobile path to issue a PO at
 * all before this).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import RNShare from 'react-native-share';
import { FileText, Plus, Eye, Share2, Trash2 } from 'lucide-react-native';
import { Btn, SearchBar, ListCard, IconBtn, Segmented, ConfirmModal } from '../../components/crud';
import { Screen } from '../../components/ui';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { salesDocumentService, SalesDocumentSummary } from '../../api/salesDocumentService';
import { DOC_TYPES, DOC_META, DocType, displayDate, money } from '../../utils/salesDocUtils';

const ADMIN_ROLES = ['SH', 'SCA'];
const DOC_TABS: { label: string; value: DocType }[] = [
  { label: 'Purchase Order', value: DOC_TYPES.PURCHASE_ORDER },
  { label: 'Tax Invoice', value: DOC_TYPES.TAX_INVOICE },
  { label: 'Quotation', value: DOC_TYPES.QUOTATION },
];

export const SalesDocumentsListScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const myId = String(user?.id ?? '');

  const [type, setType] = useState<DocType>(DOC_TYPES.PURCHASE_ORDER);
  const [rows, setRows] = useState<SalesDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SalesDocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const meta = DOC_META[type];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesDocumentService.list(type);
      setRows(res.data || []);
    } catch (err: any) {
      setRows([]);
      toast.error(err?.response?.data?.message || `Could not load ${meta.label.toLowerCase()}s.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Re-load whenever this tab regains focus (e.g. after saving one in the editor) — matches
  // web's editor calling back into the list on save.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r_) => [r_.documentNumber, r_.schoolName, r_.createdByName, r_.refOrderNumber]
      .some((x) => (x || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const canDelete = (row: SalesDocumentSummary) => isAdmin || String(row.createdById) === myId;

  const view = async (row: SalesDocumentSummary) => {
    if (!row.hasPdf) return;
    setBusyId(row.id);
    try {
      const res = await salesDocumentService.shareLink(type, row.id);
      if (res.data?.url) Linking.openURL(res.data.url);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not open the PDF.');
    } finally {
      setBusyId(null);
    }
  };

  const share = async (row: SalesDocumentSummary) => {
    if (!row.hasPdf) return;
    setBusyId(row.id);
    try {
      const res = await salesDocumentService.shareLink(type, row.id);
      const link = res.data;
      if (!link) return;
      const subject = `${meta.label} ${row.documentNumber}${row.schoolName ? ` – ${row.schoolName}` : ''}`;
      await RNShare.open({ url: link.url, title: subject, message: subject, failOnCancel: false });
    } catch (err: any) {
      if (err?.message !== 'User did not share') toast.error(err?.response?.data?.message || 'Could not create a share link.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await salesDocumentService.remove(type, toDelete.id);
      toast.success(`${meta.label} ${toDelete.documentNumber} deleted.`);
      setToDelete(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not delete the document.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: r.gutter, paddingTop: r.gutter, paddingBottom: insets.bottom + 90, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />}
      >
        <Text style={[styles.h1, { color: T.text }]}>Purchase Order &amp; Invoice</Text>
        <Text style={[styles.h2, { color: T.sub }]}>
          Generate, save and share Singularity TEACH purchase orders, tax invoices and quotations.
          {isAdmin ? ' You see everyone’s documents.' : ' You see your own documents and your team’s.'}
        </Text>

        <View style={styles.tabsRow}>
          <Segmented value={type} options={DOC_TABS} onChange={(t) => { setType(t); setSearch(''); }} style={{ flex: 1 }} />
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search number or school" style={{ marginTop: 12 }} />

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <FileText size={32} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[styles.emptyTxt, { color: T.sub }]}>
              {rows.length === 0 ? `No ${meta.label.toLowerCase()}s saved yet.` : 'Nothing matches your search.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            {filtered.map((row) => (
              <ListCard key={row.id}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={styles.rowTop}>
                    <TouchableOpacity onPress={() => view(row)} disabled={!row.hasPdf} style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.number, { color: row.hasPdf ? T.accent : T.text }]} numberOfLines={1}>{row.documentNumber}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.amount, { color: T.text }]}>₹{money(row.grandTotal)}</Text>
                  </View>
                  <Text style={[styles.school, { color: T.sub }]} numberOfLines={1}>{row.schoolName || '—'}</Text>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.meta, { color: T.dim }]} numberOfLines={1}>
                      {[row.createdByName, displayDate(row.documentDate)].filter(Boolean).join(' · ') || '—'}
                    </Text>
                    <View style={styles.actions}>
                      {busyId === row.id ? (
                        <ActivityIndicator size="small" color={T.dim} />
                      ) : (
                        <>
                          <IconBtn kind="view" label="View" onPress={() => view(row)}><Eye size={15} color={T.text} strokeWidth={ICON_STROKE} /></IconBtn>
                          <TouchableOpacity onPress={() => share(row)} disabled={!row.hasPdf} hitSlop={8} style={[styles.iconBtn, { backgroundColor: T.accentSoft }]}>
                            <Share2 size={15} color={T.accent} strokeWidth={ICON_STROKE} />
                          </TouchableOpacity>
                          <IconBtn kind="edit" label="Edit" onPress={() => navigation.navigate('SalesDocumentEditor', { type, docId: row.id })}>
                            <FileText size={15} color={T.text} strokeWidth={ICON_STROKE} />
                          </IconBtn>
                          {canDelete(row) && (
                            <IconBtn kind="del" label="Delete" onPress={() => setToDelete(row)}>
                              <Trash2 size={15} color={T.danger} strokeWidth={ICON_STROKE} />
                            </IconBtn>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </ListCard>
            ))}
          </View>
        )}
      </ScrollView>

      <Btn
        label={`Generate ${meta.label}`}
        onPress={() => navigation.navigate('SalesDocumentEditor', { type })}
        icon={<Plus size={16} color="#FFF" strokeWidth={ICON_STROKE} />}
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
      />

      <ConfirmModal
        visible={!!toDelete}
        onCancel={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete ${meta.label}?`}
        message={toDelete ? `${toDelete.documentNumber}${toDelete.schoolName ? ` (${toDelete.schoolName})` : ''} and its PDF will be removed permanently.` : ''}
        confirmLabel="Delete"
        icon={<Trash2 size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        loading={deleting}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  tabsRow: { flexDirection: 'row', marginTop: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  amount: { fontSize: 14, fontWeight: '700' },
  school: { fontSize: 12.5, fontWeight: '500' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 },
  meta: { fontSize: 11, fontWeight: '500', flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', left: 16, right: 16 },
});

export default SalesDocumentsListScreen;
