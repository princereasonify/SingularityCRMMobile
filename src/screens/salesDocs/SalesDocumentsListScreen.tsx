/**
 * Purchase Order & Invoice — mobile twin of web's SalesDocuments.jsx list (the Generate/Edit
 * form lives in SalesDocumentEditorScreen). Every B2B role generates documents; SH/SCA also see
 * everyone's, with web's person/role/zone/region/date filters. The SH/SCA Register lives in
 * SalesRegisterScreen, which reuses the filters exported from here.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, Plus, Eye, Share2, Trash2, SlidersHorizontal, X, CheckCircle2 } from 'lucide-react-native';
import { Btn, SearchBar, ListCard, IconBtn, Segmented, ConfirmModal } from '../../components/crud';
import { Screen } from '../../components/ui';
import { ICON_STROKE } from '../../components/common/Icon';
import { SelectPicker } from '../../components/common/SelectPicker';
import { DateInput } from '../../components/common/DateInput';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { salesDocumentService, SalesDocumentSummary } from '../../api/salesDocumentService';
import { ShareSheet, ShareTarget, openStoredPdf } from '../../components/salesDocs/ShareSheet';
import { DOC_TYPES, DOC_META, DocType, displayDate, money, billingPeriod, instalmentTotals, amountBasis } from '../../utils/salesDocUtils';
import { formatDateTime } from '../../utils/formatting';

/** Quotation approval state: the plan it is approved for, or "Pending". */
export const planLabel = (r: SalesDocumentSummary) =>
  `${r.approvalStatus === 'approved' ? 'Approved' : 'Pending'} · ${billingPeriod(r.billingPeriod).label}`;

/** What approving locks in: the plan, and the amount (GST included) of one instalment of it. */
export function approveMessage(q: SalesDocumentSummary): string {
  const plan = billingPeriod(q.billingPeriod);
  const each = instalmentTotals(q.subTotal, plan, !((q.igst || 0) > 0), amountBasis(q)).grandTotal;
  const per = plan.count === 1 ? 'for the full year' : `per ${plan.each}`;
  return `${q.documentNumber} will be approved for the ${plan.label} plan — ₹${money(each)} ${per} including GST. `
    + 'The plan and amount can’t be changed afterwards, and the purchase order and invoice will be raised for this amount.';
}

const ADMIN_ROLES = ['SH', 'SCA'];

// ── SH/SCA filters (web SalesDocuments.jsx applyFilters / AdminFilters) ──────────────────────
// Client-side over rows already in scope, exactly like web: the people/zone/region options are
// derived from the loaded rows (no users/zones endpoint), so they only ever list values that
// can match something.

export const ROLE_LABEL: Record<string, string> = { FO: 'Field Officer', ZH: 'Zonal Head', RH: 'Regional Head', SH: 'Sales Head', SCA: 'Admin' };

export interface DocFilters { person: string; role: string; zone: string; region: string; from: string; to: string; }
export const EMPTY_FILTERS: DocFilters = { person: '', role: '', zone: '', region: '', from: '', to: '' };

type FilterableRow = SalesDocumentSummary & { invoiceNumbers?: string[] };

export function applyFilters<R extends FilterableRow>(rows: R[], f: DocFilters, search: string): R[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r_) => {
    if (f.person && String(r_.createdById) !== f.person) return false;
    if (f.role && r_.createdByRole !== f.role) return false;
    if (f.zone && r_.zone !== f.zone) return false;
    if (f.region && r_.region !== f.region) return false;
    if (f.from && (r_.documentDate || '') < f.from) return false;
    if (f.to && (r_.documentDate || '') > f.to) return false;
    if (q && ![r_.documentNumber, r_.schoolName, r_.createdByName, r_.refOrderNumber, ...(r_.invoiceNumbers || [])]
      .some((x) => (x || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

/** "Name · Role · Zone" — web's creatorLine. */
export const creatorLine = (r_: SalesDocumentSummary) =>
  [r_.createdByName, ROLE_LABEL[r_.createdByRole || ''] || r_.createdByRole, r_.zone].filter(Boolean).join(' · ');

/** Collapsible person / role / zone / region / date filters for SH and SCA. */
export const AdminFilters = ({ rows, filters, setFilters }: {
  rows: SalesDocumentSummary[]; filters: DocFilters; setFilters: (f: DocFilters) => void;
}) => {
  const T = useAppTheme();
  const [open, setOpen] = useState(false);
  const people = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((x) => { if (x.createdById != null) m.set(String(x.createdById), x.createdByName || `User ${x.createdById}`); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const uniq = (key: 'zone' | 'region') => [...new Set(rows.map((x) => x[key]).filter(Boolean) as string[])].sort();
  const set = (k: keyof DocFilters) => (v: string | number) => setFilters({ ...filters, [k]: String(v) });
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.filterBar}>
        <TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.8}
          style={[styles.filterToggle, { backgroundColor: activeCount ? T.accentSoft : T.card, borderColor: activeCount ? T.accent : T.line }]}>
          <SlidersHorizontal size={14} color={activeCount ? T.accent : T.sub} strokeWidth={ICON_STROKE} />
          <Text style={[styles.filterToggleTxt, { color: activeCount ? T.accent : T.sub }]}>
            Filters{activeCount ? ` (${activeCount})` : ''}
          </Text>
        </TouchableOpacity>
        {activeCount > 0 && (
          <TouchableOpacity onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={8} style={styles.filterClear}>
            <X size={13} color={T.sub} strokeWidth={ICON_STROKE} />
            <Text style={[styles.filterToggleTxt, { color: T.sub }]}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
      {open && (
        <View style={styles.filterGrid}>
          <SelectPicker label="Created by" value={filters.person} onChange={set('person')} containerStyle={styles.filterCell}
            options={[{ label: 'Everyone', value: '' }, ...people.map(([id, name]) => ({ label: name, value: id }))]} />
          <SelectPicker label="Role" value={filters.role} onChange={set('role')} containerStyle={styles.filterCell}
            options={[{ label: 'All roles', value: '' }, ...Object.entries(ROLE_LABEL).map(([k, v]) => ({ label: v, value: k }))]} />
          <SelectPicker label="Zone" value={filters.zone} onChange={set('zone')} containerStyle={styles.filterCell}
            options={[{ label: 'All zones', value: '' }, ...uniq('zone').map((z) => ({ label: z, value: z }))]} />
          <SelectPicker label="Region" value={filters.region} onChange={set('region')} containerStyle={styles.filterCell}
            options={[{ label: 'All regions', value: '' }, ...uniq('region').map((z) => ({ label: z, value: z }))]} />
          <View style={styles.filterCell}>
            <DateInput label="From" value={filters.from} onChange={set('from')} placeholder="Any date" maxDate={filters.to || undefined} />
          </View>
          <View style={styles.filterCell}>
            <DateInput label="To" value={filters.to} onChange={set('to')} placeholder="Any date" minDate={filters.from || undefined} />
          </View>
        </View>
      )}
    </View>
  );
};
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
  const [filters, setFilters] = useState<DocFilters>(EMPTY_FILTERS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SalesDocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toApprove, setToApprove] = useState<SalesDocumentSummary | null>(null);
  const [approving, setApproving] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

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

  const filtered = useMemo(
    () => applyFilters(rows, isAdmin ? filters : EMPTY_FILTERS, search),
    [rows, filters, search, isAdmin],
  );

  const canDelete = (row: SalesDocumentSummary) => isAdmin || String(row.createdById) === myId;

  const view = async (row: SalesDocumentSummary) => {
    if (!row.hasPdf) return;
    setBusyId(row.id);
    try {
      await openStoredPdf(type, row.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not open the PDF.');
    } finally {
      setBusyId(null);
    }
  };

  const share = (row: SalesDocumentSummary) => {
    if (!row.hasPdf) return;
    setShareTarget({ type, id: row.id, documentNumber: row.documentNumber, schoolName: row.schoolName });
  };

  // Only the person who created a quotation approves it, and only once it has its PDF.
  const canApprove = (row: SalesDocumentSummary) =>
    type === DOC_TYPES.QUOTATION && row.approvalStatus !== 'approved' && row.hasPdf && String(row.createdById) === myId;

  const confirmApprove = async () => {
    if (!toApprove) return;
    setApproving(true);
    try {
      await salesDocumentService.approveQuotation(toApprove.id);
      toast.success(`Quotation ${toApprove.documentNumber} approved for the ${billingPeriod(toApprove.billingPeriod).label} plan.`);
      setToApprove(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not approve the quotation.');
    } finally {
      setApproving(false);
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

        <Text style={[styles.countTxt, { color: T.text }]}>
          Saved {meta.label}s{!loading && <Text style={{ color: T.sub, fontWeight: '500' }}> ({rows.length})</Text>}
        </Text>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search number or school" style={{ marginTop: 8 }} />

        {isAdmin && !loading && rows.length > 0 && <AdminFilters rows={rows} filters={filters} setFilters={setFilters} />}

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
                  <Text style={[styles.school, { color: T.sub }]} numberOfLines={1}>
                    {row.schoolName || '—'}{row.documentDate ? ` · ${displayDate(row.documentDate)}` : ''}
                  </Text>
                  {type === DOC_TYPES.QUOTATION && (
                    <Text style={[styles.badge, { color: row.approvalStatus === 'approved' ? T.success : T.sub }]} numberOfLines={1}>
                      {row.approvalStatus === 'approved' ? '✓ ' : ''}{planLabel(row)}
                    </Text>
                  )}
                  <View style={styles.rowBottom}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.meta, { color: T.dim }]} numberOfLines={1}>{creatorLine(row) || '—'}</Text>
                      {!!row.updatedAt && (
                        <Text style={[styles.meta, { color: T.dim }]} numberOfLines={1}>
                          Last updated {formatDateTime(row.updatedAt)}
                          {row.updatedByName && row.updatedByName !== row.createdByName ? ` · ${row.updatedByName}` : ''}
                        </Text>
                      )}
                    </View>
                    <View style={styles.actions}>
                      {busyId === row.id ? (
                        <ActivityIndicator size="small" color={T.dim} />
                      ) : (
                        <>
                          <IconBtn kind="view" label="View / download PDF" onPress={() => view(row)}><Eye size={15} color={T.text} strokeWidth={ICON_STROKE} /></IconBtn>
                          {canApprove(row) && (
                            <TouchableOpacity onPress={() => setToApprove(row)} hitSlop={8} accessibilityLabel="Approve" style={[styles.iconBtn, { backgroundColor: T.success + '1F' }]}>
                              <CheckCircle2 size={15} color={T.success} strokeWidth={ICON_STROKE} />
                            </TouchableOpacity>
                          )}
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
        visible={!!toApprove}
        onCancel={() => !approving && setToApprove(null)}
        onConfirm={confirmApprove}
        title="Approve quotation?"
        message={toApprove ? approveMessage(toApprove) : ''}
        confirmLabel="Approve"
        tone="success"
        icon={<CheckCircle2 size={22} color={T.success} strokeWidth={ICON_STROKE} />}
        loading={approving}
      />

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />

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
  countTxt: { fontSize: 14, fontWeight: '700', marginTop: 14 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  filterToggleTxt: { fontSize: 12, fontWeight: '600' },
  filterClear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, marginTop: 10 },
  filterCell: { flexBasis: '45%', flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  amount: { fontSize: 14, fontWeight: '700' },
  school: { fontSize: 12.5, fontWeight: '500' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 },
  meta: { fontSize: 11, fontWeight: '500' },
  badge: { fontSize: 11.5, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', left: 16, right: 16 },
});

export default SalesDocumentsListScreen;
