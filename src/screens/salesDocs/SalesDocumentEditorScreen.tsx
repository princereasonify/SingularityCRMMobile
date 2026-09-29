/**
 * Generate / edit a Quotation, Purchase Order or Tax Invoice — mobile twin of web's
 * salesDocs/SalesDocumentEditor.jsx. One screen, one shared save/preview flow; the fields
 * differ per type the same way web's PAPERS[type] does, via the three Fields components below.
 *
 * Signatures are upload-only here (see components/salesDocs/SignatureField) — web also
 * supports drawing on a canvas, which mobile doesn't have yet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNShare from 'react-native-share';
import { ArrowLeft, Eye, Save, Download } from 'lucide-react-native';
import { Btn, Field, Input } from '../../components/crud';
import { Screen, Card, SectionLabel } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { NumField } from '../../components/common/NumField';
import { ICON_STROKE } from '../../components/common/Icon';
import { AddressAutocomplete } from '../../components/salesDocs/AddressAutocomplete';
import { StatePicker } from '../../components/salesDocs/StatePicker';
import { SignatureField } from '../../components/salesDocs/SignatureField';
import { DocumentRefPicker } from '../../components/salesDocs/DocumentRefPicker';
import { salesDocumentService, SalesDocumentSummary } from '../../api/salesDocumentService';
import { renderSalesDocumentPdf } from '../../utils/salesDocPdf';
import { useAppTheme } from '../../theme/useAppTheme';
import { useToast } from '../../context/ToastContext';
import { rf } from '../../utils/responsive';
import {
  DOC_TYPES, DOC_META, COMPANY, DocType, SalesDocData,
  emptyDocument, financialYear, computeTotals, money, finalizeDocument, validateDocument,
  isLegacyNumber, invoiceFieldsFromOrder, orderFieldsFromQuotation, setPath,
} from '../../utils/salesDocUtils';

type Busy = 'save' | 'download' | 'preview' | null;

export const SalesDocumentEditorScreen = ({ navigation, route }: any) => {
  const T = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const type: DocType = route?.params?.type;
  const docId: string | undefined = route?.params?.docId;
  const meta = DOC_META[type];

  const [doc, setDoc] = useState<SalesDocData>(() => emptyDocument(type));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!docId);
  const [nextSuffix, setNextSuffix] = useState('');
  const suffixTouched = useRef(!!docId);

  const set = (path: string, value: any) => {
    if (path === 'numberSuffix') suffixTouched.current = true;
    setDoc((d) => setPath(d, path, value));
    const key: Record<string, string> = { 'school.name': 'schoolName', documentDate: 'date', numberSuffix: 'number', documentNumber: 'number' };
    const k = key[path] || path;
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Edit mode: load the saved document and merge it over a blank form so a document saved
  // before a field existed still has every key.
  useEffect(() => {
    if (!docId) return;
    let alive = true;
    salesDocumentService.get(type, docId)
      .then((res) => {
        if (!alive) return;
        const initial = res.data?.data;
        if (!initial) return;
        const blank = emptyDocument(type);
        const merged: SalesDocData = { ...blank, ...initial };
        Object.keys(blank).forEach((k) => {
          const bv = (blank as any)[k];
          if (bv && typeof bv === 'object' && !Array.isArray(bv)) (merged as any)[k] = { ...bv, ...((initial as any)[k] || {}) };
        });
        if (type === DOC_TYPES.PURCHASE_ORDER && !merged.academicYearOverride?.trim()) {
          merged.academicYearOverride = (initial as any).academicYear || '';
        }
        setDoc(merged);
      })
      .catch((err) => Alert.alert('Error', err?.response?.data?.message || 'Could not open the document.'))
      .finally(() => { if (alive) setLoadingInitial(false); });
    return () => { alive = false; };
  }, [type, docId]);

  // The next free number for the financial year, shown as the field's placeholder only.
  const fy = financialYear(doc.documentDate);
  useEffect(() => {
    if (!meta.numberPrefix) return;
    let alive = true;
    salesDocumentService.nextNumber(type, doc.documentDate || undefined)
      .then((res) => {
        const n = res.data?.number || '';
        const suffix = n.split('/').pop() || '';
        if (!alive) return;
        setNextSuffix(suffix);
        if (!suffixTouched.current && suffix) setDoc((d) => ({ ...d, numberSuffix: suffix }));
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, fy]);

  // Tax invoice: picking a Ref. Order No. copies that purchase order's details onto the invoice.
  const [orderBusy, setOrderBusy] = useState(false);
  const orderPickSeq = useRef(0);
  const pickOrder = async (number: string, order: SalesDocumentSummary | null) => {
    const seq = ++orderPickSeq.current;
    setDoc((d) => ({ ...d, refOrderNumber: number }));
    if (!order?.id) return;
    setOrderBusy(true);
    try {
      const res = await salesDocumentService.get(DOC_TYPES.PURCHASE_ORDER, order.id);
      if (seq !== orderPickSeq.current) return;
      const patch = invoiceFieldsFromOrder(res.data?.data);
      if (!Object.keys(patch).length) return;
      setDoc((d) => Object.entries(patch).reduce((acc, [path, value]) => setPath(acc, path, value), d));
      setErrors((e) => ({ ...e, schoolName: undefined, qty: undefined, rate: undefined }));
      toast.success(`Details filled in from purchase order ${number}. Check them, then add the invoice date and payment reference.`);
    } catch (err: any) {
      if (seq === orderPickSeq.current) toast.error(err?.response?.data?.message || 'Could not load that purchase order — fill the invoice in by hand.');
    } finally {
      if (seq === orderPickSeq.current) setOrderBusy(false);
    }
  };

  // Purchase order: picking a Ref. Quotation No. copies that quotation's details onto the order.
  const [quotationBusy, setQuotationBusy] = useState(false);
  const quotationPickSeq = useRef(0);
  const pickQuotation = async (number: string, quotation: SalesDocumentSummary | null) => {
    const seq = ++quotationPickSeq.current;
    setDoc((d) => ({ ...d, refQuotationNumber: number }));
    if (!quotation?.id) return;
    setQuotationBusy(true);
    try {
      const res = await salesDocumentService.get(DOC_TYPES.QUOTATION, quotation.id);
      if (seq !== quotationPickSeq.current) return;
      const patch = orderFieldsFromQuotation(res.data?.data);
      if (!Object.keys(patch).length) return;
      setDoc((d) => Object.entries(patch).reduce((acc, [path, value]) => setPath(acc, path, value), d));
      setErrors((e) => ({ ...e, schoolName: undefined, qty: undefined, rate: undefined }));
      toast.success(`Details filled in from quotation ${number}. Check them, then add the order date and academic year.`);
    } catch (err: any) {
      if (seq === quotationPickSeq.current) toast.error(err?.response?.data?.message || 'Could not load that quotation — fill the order in by hand.');
    } finally {
      if (seq === quotationPickSeq.current) setQuotationBusy(false);
    }
  };

  const hasErrors = useMemo(() => Object.values(errors).some(Boolean), [errors]);
  const totals = useMemo(() => computeTotals(doc.qty, doc.rate), [doc.qty, doc.rate]);

  const build = (): SalesDocData | null => {
    const errs = validateDocument(type, doc);
    setErrors(errs);
    const first = Object.values(errs)[0];
    if (first) {
      toast.error(first);
      return null;
    }
    return finalizeDocument(type, doc);
  };

  // No in-app PDF viewer on this client (no react-native-pdf/webview) — same pattern
  // ReportsScreen already uses for its AI-report PDF: hand the generated file to the OS share
  // sheet, which lets the user open it in any installed PDF viewer or share it directly.
  const preview = async () => {
    const final = finalizeDocument(type, doc);
    setBusy('preview');
    try {
      const file = await renderSalesDocumentPdf(type, final);
      await RNShare.open({ url: file.uri, type: 'application/pdf', filename: file.name, failOnCancel: false });
    } catch (err: any) {
      if (err?.message !== 'User did not share') toast.error(err?.message || 'Could not build the PDF preview.');
    } finally {
      setBusy(null);
    }
  };

  const save = async (andShare: boolean) => {
    let final = build();
    if (!final) return;
    setBusy(andShare ? 'download' : 'save');
    const attempt = async (f: SalesDocData) => {
      const file = await renderSalesDocumentPdf(type, f);
      const res = docId
        ? await salesDocumentService.update(type, docId, f, file)
        : await salesDocumentService.create(type, f, file);
      toast.success(`${meta.label} ${f.documentNumber} ${docId ? 'updated' : 'saved'}.`);
      if (andShare) {
        try {
          await RNShare.open({ url: file.uri, type: 'application/pdf', filename: file.name, failOnCancel: false });
        } catch (shareErr: any) {
          if (shareErr?.message !== 'User did not share') throw shareErr;
        }
      }
      navigation.goBack();
      return res;
    };
    try {
      try {
        await attempt(final);
      } catch (err: any) {
        // Everyone in the sales team numbers from the same series, so the suggested number can
        // be taken by someone else between opening the form and saving it. A number the user
        // didn't type is simply moved to the next free one (and the PDF rebuilt with it).
        if (err?.response?.status !== 409 || docId || suffixTouched.current || !meta.numberPrefix) throw err;
        const res = await salesDocumentService.nextNumber(type, doc.documentDate || undefined);
        const suffix = (res.data?.number || '').split('/').pop();
        if (!suffix) throw err;
        const retried = { ...doc, numberSuffix: suffix };
        setDoc(retried);
        setNextSuffix(suffix);
        final = finalizeDocument(type, retried);
        toast.info(`That number was just used by someone else — saving as ${final.documentNumber}.`);
        await attempt(final);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || `Could not save the ${meta.label.toLowerCase()}.`;
      toast.error(err?.response?.status === 409 ? `${msg} Choose another number.` : msg);
    } finally {
      setBusy(null);
    }
  };

  const Fields = FIELD_SECTIONS[type];

  if (loadingInitial) {
    return <Screen><View style={styles.loading}><Text style={{ color: T.sub }}>Loading…</Text></View></Screen>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={[styles.header, { borderBottomColor: T.line, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={!!busy} style={[styles.back, { backgroundColor: T.card, borderColor: T.line }]}>
          <ArrowLeft size={18} color={T.text} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: T.text }]} numberOfLines={1}>{docId ? `Edit ${meta.label}` : `Generate ${meta.label}`}</Text>
          <Text style={[styles.h2, { color: T.sub }]} numberOfLines={1}>Amount, CGST 9% and SGST 9% are calculated for you.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
        {hasErrors && (
          <View style={[styles.errBanner, { backgroundColor: T.danger + '18', borderColor: T.danger + '40' }]}>
            <Text style={{ color: T.danger, fontSize: rf(12), fontWeight: '600' }}>
              {Object.values(errors).filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        <Fields
          doc={doc} set={set} errors={errors} nextSuffix={nextSuffix}
          pickOrder={pickOrder} orderBusy={orderBusy}
          pickQuotation={pickQuotation} quotationBusy={quotationBusy}
        />

        <Card style={{ marginTop: 12 }}>
          <SectionLabel>Totals</SectionLabel>
          <View style={styles.totalsRow}><Text style={[styles.totalsLabel, { color: T.sub }]}>Sub Total</Text><Text style={[styles.totalsVal, { color: T.text }]}>₹{money(totals.subTotal)}</Text></View>
          <View style={styles.totalsRow}><Text style={[styles.totalsLabel, { color: T.sub }]}>CGST @ 9%</Text><Text style={[styles.totalsVal, { color: T.text }]}>₹{money(totals.cgst)}</Text></View>
          <View style={styles.totalsRow}><Text style={[styles.totalsLabel, { color: T.sub }]}>SGST @ 9%</Text><Text style={[styles.totalsVal, { color: T.text }]}>₹{money(totals.sgst)}</Text></View>
          <View style={[styles.totalsRow, styles.totalsGrand, { borderTopColor: T.line }]}>
            <Text style={[styles.totalsLabel, { color: T.text, fontWeight: '800' }]}>Grand Total</Text>
            <Text style={[styles.totalsVal, { color: T.accent, fontWeight: '800' }]}>₹{money(totals.grandTotal)}</Text>
          </View>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: T.bg, borderTopColor: T.line, paddingBottom: insets.bottom + 10 }]}>
        <Btn label="Preview" variant="secondary" small onPress={preview} loading={busy === 'preview'} disabled={!!busy} icon={<Eye size={14} color={T.text} strokeWidth={ICON_STROKE} />} style={{ flex: 1 }} />
        <Btn label="Save" variant="secondary" small onPress={() => save(false)} loading={busy === 'save'} disabled={!!busy} icon={<Save size={14} color={T.text} strokeWidth={ICON_STROKE} />} style={{ flex: 1 }} />
        <Btn label="Save & Share" small onPress={() => save(true)} loading={busy === 'download'} disabled={!!busy} icon={<Download size={14} color="#FFF" strokeWidth={ICON_STROKE} />} style={{ flex: 1.3 }} />
      </View>
    </View>
  );
};

// ── field sections, one per document type (web parity: PAPERS[type]) ─────────

interface FieldsProps {
  doc: SalesDocData;
  set: (path: string, value: any) => void;
  errors: Record<string, string | undefined>;
  nextSuffix: string;
  pickOrder: (number: string, order: SalesDocumentSummary | null) => void;
  orderBusy: boolean;
  pickQuotation: (number: string, quotation: SalesDocumentSummary | null) => void;
  quotationBusy: boolean;
}

const QtyRateRow = ({ doc, set, errors }: FieldsProps) => (
  <View style={styles.row2}>
    <NumField label="Qty *" value={doc.qty} onChangeText={(x) => set('qty', x)} allowDecimal={false} error={errors.qty} style={{ flex: 1 }} />
    <NumField label="Rate (₹) *" value={doc.rate} onChangeText={(x) => set('rate', x)} error={errors.rate} style={{ flex: 1 }} />
  </View>
);

const QuotationFields = ({ doc, set, errors, nextSuffix }: FieldsProps) => {
  const sc = doc.school!;
  const co = doc.coordinator!;
  return (
    <>
      <Card style={{ marginTop: 12 }}>
        <SectionLabel>To (School)</SectionLabel>
        <Input label="School Name *" value={sc.name} onChangeText={(x: string) => set('school.name', x)} error={errors.schoolName} />
        <AddressAutocomplete
          label="Address"
          value={sc.address1 || ''}
          onChangeText={(x) => set('school.address1', x)}
          onPick={(a) => { set('school.address1', a.line1); set('school.address2', a.line2); if (a.state) { set('school.state', a.state); set('school.stateCode', a.stateCode); } }}
        />
        <Input label="Address line 2" value={sc.address2} onChangeText={(x: string) => set('school.address2', x)} />
        <Input label="Contact Person" value={sc.contactPerson} onChangeText={(x: string) => set('school.contactPerson', x)} />
        <Input label="Phone / Email" value={sc.phoneEmail} onChangeText={(x: string) => set('school.phoneEmail', x)} />
        <Input label="GSTIN (if any)" value={sc.gstin} autoCapitalize="characters" onChangeText={(x: string) => set('school.gstin', x.toUpperCase())} />
        <View style={styles.row2}>
          <Input label="State" value={sc.state} onChangeText={(x: string) => set('school.state', x)} containerStyle={{ flex: 1 }} />
          <Input label="State Code" value={sc.stateCode} onChangeText={(x: string) => set('school.stateCode', x)} containerStyle={{ width: 90 }} />
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Quotation Details</SectionLabel>
        <Field label="Quotation No. *">
          <View style={styles.numberRow}><Text style={[styles.numberPrefix, { color: undefined }]}>RTPL/QT/{financialYear(doc.documentDate)}/</Text>
            <Input value={doc.numberSuffix} onChangeText={(x: string) => set('numberSuffix', x)} placeholder={nextSuffix} error={errors.number} containerStyle={{ flex: 1 }} />
          </View>
        </Field>
        <DateInput label="Quotation Date *" value={doc.documentDate} onChange={(x) => set('documentDate', x)} error={errors.date} />
        <NumField label="Valid Until (days from issue)" value={doc.validDays || ''} onChangeText={(x) => set('validDays', x)} allowDecimal={false} />
        <StatePicker label="Place of Supply" value={doc.placeOfSupply || ''} onChange={(x) => set('placeOfSupply', x)} />
        <Input label="Academic Year" value={doc.academicYearOverride} onChangeText={(x: string) => set('academicYearOverride', x)} placeholder={financialYear(doc.documentDate)} />
        <Input label="Prepared By" value={doc.preparedBy} onChangeText={(x: string) => set('preparedBy', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>School Contact for Activation</SectionLabel>
        <Input label="Coordinator Name" value={co.name} onChangeText={(x: string) => set('coordinator.name', x)} />
        <Input label="Designation" value={co.designation} onChangeText={(x: string) => set('coordinator.designation', x)} />
        <Input label="Phone" value={co.phone} keyboardType="phone-pad" onChangeText={(x: string) => set('coordinator.phone', x)} />
        <Input label="Email" value={co.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(x: string) => set('coordinator.email', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Scope & Timeline</SectionLabel>
        <Input label="Classes" value={doc.classes} onChangeText={(x: string) => set('classes', x)} />
        <DateInput label="Expected Activation By" value={doc.activationBy} onChange={(x) => set('activationBy', x)} />
        <DateInput label="Subscription Valid Till" value={doc.validTill} onChange={(x) => set('validTill', x)} />
        <NumField label="Subscription Months" value={doc.subscriptionMonths || ''} onChangeText={(x) => set('subscriptionMonths', x)} allowDecimal={false} />
        <Input label="Advance (if any)" value={doc.advance} onChangeText={(x: string) => set('advance', x)} />
        <Input label="Payment Terms" value={doc.paymentTerms} onChangeText={(x: string) => set('paymentTerms', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Teacher Login Subscription</SectionLabel>
        <QtyRateRow doc={doc} set={set} errors={errors} nextSuffix="" pickOrder={() => {}} orderBusy={false} pickQuotation={() => {}} quotationBusy={false} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Signatures</SectionLabel>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}><SignatureField label={`For ${COMPANY.legalName}`} value={doc.signatures.company} onChange={(v) => set('signatures.company', v)} /></View>
          <View style={{ flex: 1 }}><SignatureField label="Acknowledged by (School)" value={doc.signatures.school} onChange={(v) => set('signatures.school', v)} /></View>
        </View>
      </Card>
    </>
  );
};

const PurchaseOrderFields = ({ doc, set, errors, nextSuffix, pickQuotation, quotationBusy }: FieldsProps) => {
  const lh = doc.letterhead!;
  const sc = doc.school!;
  const co = doc.coordinator!;
  const legacyNumber = isLegacyNumber(DOC_TYPES.PURCHASE_ORDER, doc);
  return (
    <>
      <Card style={{ marginTop: 12 }}>
        <SectionLabel>School Letterhead</SectionLabel>
        <Input label="School Name *" value={lh.schoolName} onChangeText={(x: string) => set('letterhead.schoolName', x)} placeholder="[SCHOOL NAME]" />
        <AddressAutocomplete label="Address" value={lh.address || ''} onChangeText={(x) => set('letterhead.address', x)} onPick={(a) => set('letterhead.address', a.full)} placeholder="[School Address, City – PIN]" />
        <Input label="GSTIN (if any)" value={lh.gstin} autoCapitalize="characters" onChangeText={(x: string) => set('letterhead.gstin', x.toUpperCase())} />
        <Input label="Phone / Email" value={lh.phoneEmail} onChangeText={(x: string) => set('letterhead.phoneEmail', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Order Details</SectionLabel>
        <Field label="Order No. *">
          {legacyNumber ? (
            <Input value={doc.documentNumber} onChangeText={(x: string) => set('documentNumber', x)} error={errors.number} />
          ) : (
            <View style={styles.numberRow}>
              <Text style={styles.numberPrefix}>RTPL/PO/{financialYear(doc.documentDate)}/</Text>
              <Input value={doc.numberSuffix} onChangeText={(x: string) => set('numberSuffix', x)} placeholder={nextSuffix} error={errors.number} containerStyle={{ flex: 1 }} />
            </View>
          )}
        </Field>
        <DateInput label="Order Date *" value={doc.documentDate} onChange={(x) => set('documentDate', x)} error={errors.date} />
        <DocumentRefPicker
          type={DOC_TYPES.QUOTATION} label="Ref. Quotation No." value={doc.refQuotationNumber || ''} onChange={pickQuotation}
          busy={quotationBusy} busyLabel="Filling from quotation…" emptyLabel="No quotations saved yet" placeholder="Select quotation"
        />
        <StatePicker label="Place of Supply" value={doc.placeOfSupply || ''} onChange={(x) => set('placeOfSupply', x)} />
        <Input label="Academic Year *" value={doc.academicYearOverride} onChangeText={(x: string) => set('academicYearOverride', x)} placeholder="e.g. 2026-27" error={errors.academicYearOverride} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Bill To (School)</SectionLabel>
        <Input label="School Name *" value={sc.name} onChangeText={(x: string) => set('school.name', x)} error={errors.schoolName} />
        <AddressAutocomplete label="Address" value={sc.address || ''} onChangeText={(x) => set('school.address', x)} onPick={(a) => { set('school.address', a.full); if (a.state) { set('school.state', a.state); set('school.stateCode', a.stateCode); } }} />
        <Input label="GSTIN (if any)" value={sc.gstin} autoCapitalize="characters" onChangeText={(x: string) => set('school.gstin', x.toUpperCase())} />
        <View style={styles.row2}>
          <Input label="State" value={sc.state} onChangeText={(x: string) => set('school.state', x)} containerStyle={{ flex: 1 }} />
          <Input label="State Code" value={sc.stateCode} onChangeText={(x: string) => set('school.stateCode', x)} containerStyle={{ width: 90 }} />
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>School Contact for Activation</SectionLabel>
        <Input label="Coordinator Name" value={co.name} onChangeText={(x: string) => set('coordinator.name', x)} />
        <Input label="Designation" value={co.designation} onChangeText={(x: string) => set('coordinator.designation', x)} />
        <Input label="Phone" value={co.phone} keyboardType="phone-pad" onChangeText={(x: string) => set('coordinator.phone', x)} />
        <Input label="Email" value={co.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(x: string) => set('coordinator.email', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Scope of Supply</SectionLabel>
        <NumField label="Teacher Logins" value={doc.teacherLogins || ''} onChangeText={(x) => set('teacherLogins', x)} allowDecimal={false} />
        <Input label="Classes" value={doc.classes} onChangeText={(x: string) => set('classes', x)} />
        <QtyRateRow doc={doc} set={set} errors={errors} nextSuffix="" pickOrder={() => {}} orderBusy={false} pickQuotation={() => {}} quotationBusy={false} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Timeline & Payment</SectionLabel>
        <DateInput label="Login Activation By" value={doc.activationBy} onChange={(x) => set('activationBy', x)} />
        <NumField label="Subscription Period (months)" value={doc.subscriptionMonths || ''} onChangeText={(x) => set('subscriptionMonths', x)} allowDecimal={false} />
        <DateInput label="Subscription Valid Till" value={doc.validTill} onChange={(x) => set('validTill', x)} />
        <Input label="Payment Terms" value={doc.paymentTerms} onChangeText={(x: string) => set('paymentTerms', x)} />
        <Input label="Advance (if any)" value={doc.advance} onChangeText={(x: string) => set('advance', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Signatures</SectionLabel>
        <View style={styles.row2}>
          <View style={{ flex: 1, gap: 8 }}>
            <SignatureField label={`For ${lh.schoolName || sc.name || 'School'} (Principal / Trustee)`} value={doc.signatures.school} onChange={(v) => set('signatures.school', v)} />
            <Input label="Signatory Name" value={doc.schoolSignatory?.name} onChangeText={(x: string) => set('schoolSignatory.name', x)} />
            <DateInput label="Date" value={doc.schoolSignatory?.date} onChange={(x) => set('schoolSignatory.date', x)} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <SignatureField label={`Accepted by ${COMPANY.legalName}`} value={doc.signatures.company} onChange={(v) => set('signatures.company', v)} />
            <Input label="Signatory Name" value={doc.vendorSignatory?.name} onChangeText={(x: string) => set('vendorSignatory.name', x)} />
            <DateInput label="Date" value={doc.vendorSignatory?.date} onChange={(x) => set('vendorSignatory.date', x)} />
          </View>
        </View>
      </Card>
    </>
  );
};

const TaxInvoiceFields = ({ doc, set, errors, nextSuffix, pickOrder, orderBusy }: FieldsProps) => {
  const sc = doc.school!;
  return (
    <>
      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Bill To (School)</SectionLabel>
        <Input label="School Name *" value={sc.name} onChangeText={(x: string) => set('school.name', x)} error={errors.schoolName} />
        <AddressAutocomplete
          label="Address"
          value={sc.address1 || ''}
          onChangeText={(x) => set('school.address1', x)}
          onPick={(a) => { set('school.address1', a.line1); set('school.address2', a.line2); if (a.state) { set('school.state', a.state); set('school.stateCode', a.stateCode); } }}
        />
        <Input label="Address line 2" value={sc.address2} onChangeText={(x: string) => set('school.address2', x)} />
        <Input label="Contact Person" value={sc.contactPerson} onChangeText={(x: string) => set('school.contactPerson', x)} />
        <Input label="Phone / Email" value={sc.phoneEmail} onChangeText={(x: string) => set('school.phoneEmail', x)} />
        <Input label="School GSTIN (if any)" value={sc.gstin} autoCapitalize="characters" onChangeText={(x: string) => set('school.gstin', x.toUpperCase())} />
        <View style={styles.row2}>
          <Input label="State" value={sc.state} onChangeText={(x: string) => set('school.state', x)} containerStyle={{ flex: 1 }} />
          <Input label="State Code" value={sc.stateCode} onChangeText={(x: string) => set('school.stateCode', x)} containerStyle={{ width: 90 }} />
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Invoice Details</SectionLabel>
        <Field label="Invoice No. *">
          <View style={styles.numberRow}>
            <Text style={styles.numberPrefix}>RTPL/TI/{financialYear(doc.documentDate)}/</Text>
            <Input value={doc.numberSuffix} onChangeText={(x: string) => set('numberSuffix', x)} placeholder={nextSuffix} error={errors.number} containerStyle={{ flex: 1 }} />
          </View>
        </Field>
        <DateInput label="Invoice Date *" value={doc.documentDate} onChange={(x) => set('documentDate', x)} error={errors.date} />
        <DocumentRefPicker
          type={DOC_TYPES.PURCHASE_ORDER} label="Ref. Order No." value={doc.refOrderNumber || ''} onChange={pickOrder}
          busy={orderBusy} busyLabel="Filling from purchase order…" emptyLabel="No purchase orders saved yet" placeholder="Select purchase order"
        />
        <StatePicker label="Place of Supply" value={doc.placeOfSupply || ''} onChange={(x) => set('placeOfSupply', x)} />
        <View style={styles.row2}>
          <DateInput label="Period From" value={doc.periodFrom} onChange={(x) => set('periodFrom', x)} />
          <DateInput label="Period To" value={doc.periodTo} onChange={(x) => set('periodTo', x)} />
        </View>
        <Input label="Payment Ref. / UTR" value={doc.paymentRef} onChangeText={(x: string) => set('paymentRef', x)} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Teacher Login Subscription (Annual)</SectionLabel>
        <QtyRateRow doc={doc} set={set} errors={errors} nextSuffix="" pickOrder={() => {}} orderBusy={false} pickQuotation={() => {}} quotationBusy={false} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel>Signatures</SectionLabel>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}><SignatureField label="Received by (School)" value={doc.signatures.school} onChange={(v) => set('signatures.school', v)} /></View>
          <View style={{ flex: 1 }}><SignatureField label={`For ${COMPANY.legalName}`} value={doc.signatures.company} onChange={(v) => set('signatures.company', v)} /></View>
        </View>
      </Card>
    </>
  );
};

const FIELD_SECTIONS: Record<DocType, React.ComponentType<FieldsProps>> = {
  [DOC_TYPES.QUOTATION]: QuotationFields,
  [DOC_TYPES.PURCHASE_ORDER]: PurchaseOrderFields,
  [DOC_TYPES.TAX_INVOICE]: TaxInvoiceFields,
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontWeight: '800', fontSize: rf(18), letterSpacing: -0.3 },
  h2: { fontWeight: '500', fontSize: rf(11.5), marginTop: 1 },
  scroll: { padding: 16 },
  errBanner: { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 4 },
  row2: { flexDirection: 'row', gap: 10 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numberPrefix: { fontSize: rf(12.5), fontWeight: '600' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalsLabel: { fontSize: rf(13), fontWeight: '600' },
  totalsVal: { fontSize: rf(13), fontWeight: '700' },
  totalsGrand: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 9 },
  footer: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default SalesDocumentEditorScreen;
