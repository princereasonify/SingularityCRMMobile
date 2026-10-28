import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNShare from 'react-native-share';
import { Download, Eye, Share2 } from 'lucide-react-native';
import { ShareSheet, ShareTarget, openStoredPdf } from '../../components/salesDocs/ShareSheet';
import { useToast } from '../../context/ToastContext';
import { salesDocumentService, SalesRegisterRow, fileShareOptions } from '../../api/salesDocumentService';
import { Btn, SearchBar, Segmented, StatusBadge } from '../../components/crud';
import { Card, StatTile } from '../../components/ui';
import { ICON_STROKE } from '../../components/common/Icon';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatDateTime } from '../../utils/formatting';
import { DOC_TYPES, DocType, displayDate, money, billingPeriod } from '../../utils/salesDocUtils';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { AdminFilters, applyFilters, creatorLine, DocFilters, EMPTY_FILTERS } from './SalesDocumentsListScreen';

/**
 * Sales Register (SH/SCA only) — web's admin-only Register tab from SalesDocuments.jsx
 * RegisterView: every PO, tax invoice and quotation, each PO with the invoices raised against
 * it. Like web it loads the whole register once (no default date window — "every document
 * generated so far") and filters client-side with the same search + person/role/zone/region/
 * date filters as the per-type list (shared from SalesDocumentsListScreen).
 *
 * Export: the server-built .xlsx from `/register/excel`, fetched as an ArrayBuffer and handed to
 * RNShare as a base64 data URL (it writes the temp file itself — no filesystem module needed),
 * with the same filters as the on-screen table, like web. If that fails on a device, the user
 * can still share the shown rows as CSV (the old export) instead.
 *
 * Verified against SalesDocumentsController.cs: both `/register` and `/register/excel` gate
 * on `SalesRegisterService.SeesEverything(caller.Role)` — SH/SCA only, 403 otherwise.
 */

const DASH = '—';

type TypeFilter = 'all' | 'quotation' | 'purchase-order' | 'tax-invoice';
const TYPE_TABS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'PO', value: 'purchase-order' },
  { label: 'Invoice', value: 'tax-invoice' },
  { label: 'Quotation', value: 'quotation' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const csvCell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CGST+SGST (intra-state) and IGST (inter-state) are never both non-zero on one document —
 *  summing all three just adds whichever applied (web SalesDocuments.jsx totals). */
const gstOf = (r: SalesRegisterRow) => (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0);

/** Web's linkCell: invoice → its PO; PO → its invoices (or "Not invoiced yet"). */
const linkCell = (r: SalesRegisterRow) => {
  if (r.type === DOC_TYPES.TAX_INVOICE) return r.refOrderNumber ? `PO ${r.refOrderNumber}` : '';
  if (r.type === DOC_TYPES.PURCHASE_ORDER) {
    return r.invoiceNumbers?.length ? `Invoiced: ${r.invoiceNumbers.join(', ')}` : 'Not invoiced yet';
  }
  return '';
};

export const SalesRegisterScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DocFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<SalesRegisterRow[]>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await salesDocumentService.register();
      setRows(Array.isArray(res.data) ? res.data : []);
      setLoadedAt(new Date().toISOString());
      setLoadFailed(false);
    } catch {
      setRows([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const shown = useMemo(
    () => applyFilters(rows, filters, search).filter(r => typeFilter === 'all' || r.type === typeFilter),
    [rows, filters, search, typeFilter],
  );

  const totals = useMemo(() => {
    const t = { count: shown.length, sub: 0, gst: 0, total: 0, byType: {} as Record<string, number> };
    shown.forEach(r => {
      t.sub += r.subTotal || 0;
      t.gst += gstOf(r);
      t.total += r.grandTotal || 0;
      t.byType[r.type] = (t.byType[r.type] || 0) + 1;
    });
    return t;
  }, [shown]);

  const exportCsv = async () => {
    if (shown.length === 0) return;
    const head = ['Type', 'Number', 'Date', 'School', 'Sub Total', 'GST', 'Amount', 'PO / Invoice', 'Created By', 'Zone', 'Region', 'Balance to Invoice'];
    const body = shown.map(r => [
      r.typeLabel, r.documentNumber, displayDate(r.documentDate),
      r.schoolName || '', r.subTotal, gstOf(r), r.grandTotal, linkCell(r), r.createdByName || '', r.zone || '', r.region || '',
      r.balanceToInvoice ?? '',
    ]);
    const csv = [head.map(csvCell).join(','), ...body.map(row => row.map(csvCell).join(','))].join('\n');
    try {
      await RNShare.open({ title: 'Export Sales Register', subject: 'Sales Register Export', message: csv, failOnCancel: false });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Error', 'Failed to export register.');
    }
  };

  // SH/SCA can open or share any generated document straight from the register.
  const viewDoc = async (r: SalesRegisterRow) => {
    const key = `${r.type}-${r.id}`;
    setViewingKey(key);
    try {
      await openStoredPdf(r.type as DocType, r.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not open the PDF.');
    } finally {
      setViewingKey(null);
    }
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      // Same filters as the list, so the file matches what is on screen (web downloadExcel).
      const file = await salesDocumentService.registerExcel({
        createdById: filters.person ? Number(filters.person) : undefined,
        role: filters.role || undefined,
        zone: filters.zone || undefined,
        region: filters.region || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        q: search.trim() || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      // Web always saves as Sales-Documents-Register-{today}.xlsx, whatever the server names it.
      file.fileName = `Sales-Documents-Register-${todayStr()}.xlsx`;
      setDownloading(false);
      await RNShare.open({ ...fileShareOptions(file), title: 'Sales Register', subject: 'Sales Documents Register', failOnCancel: false });
    } catch (err: any) {
      setDownloading(false);
      if (err?.message === 'User did not share') return;
      Alert.alert('Could not create the Excel file', 'Share the rows shown as CSV instead?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share CSV', onPress: exportCsv },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <LoadingSpinner fullScreen message="Loading sales register…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.title, { color: T.text }]}>Sales Register</Text>
        <Text style={[s.subtitle, { color: T.sub }]}>
          Every Purchase Order, Tax Invoice and Quotation across the company.
          {loadedAt && !loadFailed ? ` ${rows.length} saved in total · updated ${formatDateTime(loadedAt)}.` : ''}
        </Text>

        <Segmented<TypeFilter> value={typeFilter} options={TYPE_TABS} onChange={setTypeFilter} />

        <SearchBar value={search} onChangeText={setSearch} placeholder="Number, school, person…" />

        {rows.length > 0 && (
          <View style={{ marginTop: -10 }}>
            <AdminFilters rows={rows} filters={filters} setFilters={setFilters} />
          </View>
        )}

        <Btn
          label="Download Excel (PO & Invoices)"
          variant="secondary"
          small
          loading={downloading}
          disabled={downloading || rows.length === 0}
          icon={<Download size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
          onPress={downloadExcel}
        />

        {shown.length > 0 && (
          <View style={s.tiles}>
            <StatTile label="Documents" value={totals.count} style={s.tile} />
            <StatTile
              label="PO / Invoice / Quotation"
              value={`${totals.byType[DOC_TYPES.PURCHASE_ORDER] || 0} / ${totals.byType[DOC_TYPES.TAX_INVOICE] || 0} / ${totals.byType[DOC_TYPES.QUOTATION] || 0}`}
              style={s.tile}
            />
            <StatTile label="Sub total" value={`₹${money(totals.sub)}`} style={s.tile} />
            <StatTile label="GST (CGST+SGST or IGST)" value={`₹${money(totals.gst)}`} style={s.tile} />
            <StatTile label="Grand total" value={`₹${money(totals.total)}`} style={s.tileWide} />
          </View>
        )}

        {loadFailed ? (
          <EmptyState icon="⚠️" title="Couldn't load the register" subtitle="Check your connection and pull down to retry." />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="📒"
            title={rows.length === 0 ? 'No documents have been generated yet' : 'Nothing matches these filters'}
            subtitle={rows.length === 0 ? undefined : 'Try clearing the search, type or filters.'}
          />
        ) : (
          shown.map(r => {
            const link = linkCell(r);
            return (
              <Card key={`${r.type}-${r.id}`} style={s.row}>
                <View style={s.rowBetween}>
                  <View style={s.flexMin}>
                    <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{r.documentNumber}</Text>
                    <Text numberOfLines={1} style={[s.rowSub, { color: T.sub }]}>
                      {r.schoolName || DASH} · {displayDate(r.documentDate) || DASH}
                    </Text>
                  </View>
                  <View style={s.alignEnd}>
                    <Text style={[s.rowVal, { color: T.text }]}>₹{money(r.grandTotal)}</Text>
                    <StatusBadge label={r.typeLabel} color={T.accent} />
                  </View>
                </View>
                <Text numberOfLines={1} style={[s.rowMeta, { color: T.sub }]}>
                  Sub total ₹{money(r.subTotal)} · GST ₹{money(gstOf(r))}
                </Text>
                {!!link && (
                  <Text
                    numberOfLines={2}
                    style={[s.linkRow, { color: r.type === DOC_TYPES.PURCHASE_ORDER && !r.invoiceNumbers?.length ? T.sub : T.success }]}
                  >
                    {link}
                  </Text>
                )}
                {r.balanceToInvoice != null && r.balanceToInvoice > 0 && (
                  <Text numberOfLines={1} style={[s.linkRow, { color: T.warning }]}>
                    Balance to invoice: ₹{money(r.balanceToInvoice)}
                  </Text>
                )}
                {r.type === DOC_TYPES.QUOTATION && (
                  <Text numberOfLines={1} style={[s.linkRow, { color: r.approvalStatus === 'approved' ? T.success : T.sub }]}>
                    {r.approvalStatus === 'approved' ? '✓ Approved' : 'Pending approval'} · {billingPeriod(r.billingPeriod).label}
                  </Text>
                )}
                <View style={s.rowBetween}>
                  <Text numberOfLines={1} style={[s.rowMeta, s.flexMin, { color: T.dim }]}>
                    {creatorLine(r) || DASH}{r.createdAt ? ` · Created ${formatDateTime(r.createdAt)}` : ''}
                  </Text>
                  {r.hasPdf && (
                    <View style={s.actions}>
                      {viewingKey === `${r.type}-${r.id}` ? <ActivityIndicator size="small" color={T.dim} /> : (
                        <>
                          <TouchableOpacity onPress={() => viewDoc(r)} hitSlop={8} accessibilityLabel="View PDF" style={[s.iconBtn, { backgroundColor: T.accentSoft }]}>
                            <Eye size={15} color={T.accent} strokeWidth={ICON_STROKE} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setShareTarget({ type: r.type as DocType, id: r.id, documentNumber: r.documentNumber, schoolName: r.schoolName })}
                            hitSlop={8} accessibilityLabel="Share PDF" style={[s.iconBtn, { backgroundColor: T.accentSoft }]}>
                            <Share2 size={15} color={T.accent} strokeWidth={ICON_STROKE} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  title: { fontSize: rf(18), fontWeight: '700' },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: -6 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '45%', flexGrow: 1 },
  tileWide: { flexBasis: '100%' },

  row: { padding: 12, gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  flexMin: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: 'flex-end', gap: 5 },
  rowTitle: { fontSize: rf(13.5), fontWeight: '700' },
  rowSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
  rowVal: { fontSize: rf(14), fontWeight: '700' },
  rowMeta: { fontSize: rf(11), fontWeight: '500' },
  linkRow: { fontSize: rf(11.5), fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
