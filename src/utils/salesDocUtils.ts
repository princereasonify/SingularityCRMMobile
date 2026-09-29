/**
 * Shared constants and maths for the three TEACH-mode sales documents (Quotation,
 * Purchase / Work Order, Tax Invoice). Mobile twin of web's
 * src/pages/common/salesDocs/salesDocUtils.js — ported near-verbatim so the two clients can
 * never disagree about a number or a required field. The printed text of each template lives
 * in the editor + PDF template; everything here is data the two must agree on.
 */
import { todayStr } from './dates';

export const DOC_TYPES = {
  PURCHASE_ORDER: 'purchase-order',
  TAX_INVOICE: 'tax-invoice',
  QUOTATION: 'quotation',
} as const;

export type DocType = (typeof DOC_TYPES)[keyof typeof DOC_TYPES];

export const DOC_META: Record<DocType, { label: string; title: string; filePrefix: string; numberPrefix: string }> = {
  [DOC_TYPES.PURCHASE_ORDER]: { label: 'Purchase Order', title: 'PURCHASE / WORK ORDER', filePrefix: 'PurchaseOrder', numberPrefix: 'RTPL/PO' },
  [DOC_TYPES.TAX_INVOICE]: { label: 'Tax Invoice', title: 'TAX INVOICE', filePrefix: 'TaxInvoice', numberPrefix: 'RTPL/TI' },
  [DOC_TYPES.QUOTATION]: { label: 'Quotation', title: 'QUOTATION', filePrefix: 'Quotation', numberPrefix: 'RTPL/QT' },
};

export const COMPANY = {
  name: 'REASONIFY TECHNOLOGY PVT LTD',
  legalName: 'Reasonify Technology Pvt Ltd',
  address1: 'A/301, Mondeal Heights, Beside Hotel Novotel,',
  address2: 'S G Highway, Ahmedabad - 380015, Gujarat',
  state: 'Gujarat',
  stateCode: '24',
  gstin: '24AAOCR5284N1ZM',
  email: 'enquiry@singularity-teach.com',
  web: 'app.singularity-teach.com',
};

// Printed on every Tax Invoice exactly as given — not editable per document.
export const BANK = {
  accountName: 'REASONIFY TECHNOLOGY PVT LTD-SALES',
  bankName: 'HDFC BANK LTD',
  accountNo: '50200121676390',
  ifsc: 'HDFC0009173',
  branch: 'HDFC BANK LTD SHOP NO 14 GROUND FLOOR DEV ARC COMPLEX ISCON CROSS ROAD AHMEDABAD 380015 GUJARAT',
};

export const SAC = '997331';

/** GST state codes, keyed by the state name Google Places returns. */
export const GST_STATE_CODES: Record<string, string> = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04', 'Uttarakhand': '05',
  'Haryana': '06', 'Delhi': '07', 'Rajasthan': '08', 'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11',
  'Arunachal Pradesh': '12', 'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16', 'Meghalaya': '17',
  'Assam': '18', 'West Bengal': '19', 'Jharkhand': '20', 'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23',
  'Gujarat': '24', 'Dadra and Nagar Haveli and Daman and Diu': '26', 'Maharashtra': '27', 'Karnataka': '29', 'Goa': '30',
  'Lakshadweep': '31', 'Kerala': '32', 'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman and Nicobar Islands': '35',
  'Telangana': '36', 'Andhra Pradesh': '37', 'Ladakh': '38',
};
export const CGST_RATE = 9;
export const SGST_RATE = 9;
export const GST_RATE = CGST_RATE + SGST_RATE;

// ── dates ────────────────────────────────────────────────────────────────────

/** Indian financial / academic year (April–March) a yyyy-mm-dd falls in, e.g. "2026-27". */
export function financialYear(dateStr?: string | null): string {
  const [y, m] = (dateStr || todayStr()).split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** yyyy-mm-dd → dd/mm/yyyy, '' when empty. */
export function displayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── money ────────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const money = (n?: number | string | null): string =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parses what the user typed into Qty / Rate ("5,000" is fine). NaN-safe. */
export const num = (v?: string | number | null): number => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export interface Totals {
  subTotal: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  grandTotal: number;
}

/** Qty × Rate → amount, CGST 9% + SGST 9% on it, and the grand total. */
export function computeTotals(qty?: string | number | null, rate?: string | number | null): Totals {
  const subTotal = round2(num(qty) * num(rate));
  const cgst = round2((subTotal * CGST_RATE) / 100);
  const sgst = round2((subTotal * SGST_RATE) / 100);
  return { subTotal, cgst, sgst, totalTax: round2(cgst + sgst), grandTotal: round2(subTotal + cgst + sgst) };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

/** Whole number in the Indian system (crore / lakh / thousand). */
function indianWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

/** 59000 → "Rupees Fifty-Nine Thousand Only"; 1180.5 → "Rupees One Thousand One Hundred Eighty and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const total = round2(amount);
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  let words = `Rupees ${indianWords(rupees)}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

// ── blank forms ──────────────────────────────────────────────────────────────
// Every "____" on the Word templates is a field here, starting empty. Only the dates the
// templates print as "___ / ___ / 2026" start empty too — the year is not baked in.

export interface SalesDocSignatures { company: string; school: string; }
export interface SalesDocSchool {
  name: string; address1?: string; address2?: string; address?: string;
  contactPerson?: string; phoneEmail?: string; gstin: string; state: string; stateCode: string;
}
export interface SalesDocCoordinator { name: string; designation: string; phone: string; email: string; }
export interface SalesDocSignatory { name: string; date: string; }

/** The shape is a union in practice — quotation/PO/invoice each add their own fields on top of
 *  this base. Kept loose (Record) rather than three exclusive interfaces because the editor
 *  merges a saved document over emptyDocument() and passes the same object through every path
 *  (finalize, validate, autofill) regardless of type, exactly like the web client does. */
export interface SalesDocData {
  version: number;
  type: DocType;
  documentNumber: string;
  documentDate: string;
  qty: string;
  rate: string;
  signatures: SalesDocSignatures;
  numberSuffix?: string;
  school?: SalesDocSchool;
  coordinator?: SalesDocCoordinator;
  placeOfSupply?: string;
  preparedBy?: string;
  validDays?: string;
  academicYearOverride?: string;
  academicYear?: string;
  classes?: string;
  activationBy?: string;
  subscriptionMonths?: string;
  validTill?: string;
  paymentTerms?: string;
  advance?: string;
  letterhead?: { schoolName: string; address: string; gstin: string; phoneEmail: string };
  refQuotationNumber?: string;
  teacherLogins?: string;
  schoolSignatory?: SalesDocSignatory;
  vendorSignatory?: SalesDocSignatory;
  refOrderNumber?: string;
  periodFrom?: string;
  periodTo?: string;
  paymentRef?: string;
  totals?: Totals;
  amountInWords?: string;
  [key: string]: any;
}

export function emptyDocument(type: DocType): SalesDocData {
  const base: SalesDocData = {
    version: 1, type, documentNumber: '', documentDate: '', qty: '', rate: '',
    signatures: { company: '', school: '' },
  };

  if (type === DOC_TYPES.QUOTATION) {
    return {
      ...base,
      numberSuffix: '',
      school: { name: '', address1: '', address2: '', contactPerson: '', phoneEmail: '', gstin: '', state: '', stateCode: '' },
      // A second, more specific contact than school.contactPerson above — kept separate so it maps
      // 1:1 onto the purchase order's own "SCHOOL CONTACT FOR ACTIVATION" box (coordinator.*).
      coordinator: { name: '', designation: '', phone: '', email: '' },
      placeOfSupply: '',
      preparedBy: '',
      // Quotation validity in days (printed in Valid Until and in terms 2) and an optional
      // academic year; empty academic year prints the one worked out from the quotation date.
      validDays: '30',
      academicYearOverride: '',
      classes: '',
      activationBy: '',
      subscriptionMonths: '',
      validTill: '',
      paymentTerms: '',
      advance: '',
    };
  }

  if (type === DOC_TYPES.PURCHASE_ORDER) {
    return {
      ...base,
      numberSuffix: '',
      letterhead: { schoolName: '', address: '', gstin: '', phoneEmail: '' },
      placeOfSupply: '',
      // Typed by the user (e.g. "2026-27") — never derived from the order date.
      academicYearOverride: '',
      school: { name: '', address: '', gstin: '', state: '', stateCode: '' },
      refQuotationNumber: '',
      coordinator: { name: '', designation: '', phone: '', email: '' },
      teacherLogins: '',
      classes: '',
      activationBy: '',
      subscriptionMonths: '',
      validTill: '',
      paymentTerms: '',
      advance: '',
      schoolSignatory: { name: '', date: '' },
      vendorSignatory: { name: '', date: '' },
    };
  }

  return {
    ...base,
    numberSuffix: '',
    school: { name: '', address1: '', address2: '', contactPerson: '', phoneEmail: '', gstin: '', state: '', stateCode: '' },
    refOrderNumber: '',
    placeOfSupply: '',
    periodFrom: '',
    periodTo: '',
    paymentRef: '',
  };
}

/**
 * A purchase order saved before POs had their own RTPL/PO series carries the school's free-text
 * order number and no suffix; it keeps that number rather than being renumbered on edit.
 */
export function isLegacyNumber(type: DocType, doc: SalesDocData): boolean {
  const prefix = DOC_META[type].numberPrefix;
  return !!prefix && !doc.numberSuffix && !!doc.documentNumber && !doc.documentNumber.startsWith(`${prefix}/`);
}

/** Full document number as printed: prefix + FY of the document date + the suffix. */
export function fullNumber(type: DocType, doc: SalesDocData): string {
  const prefix = DOC_META[type].numberPrefix;
  if (!prefix || isLegacyNumber(type, doc)) return (doc.documentNumber || '').trim();
  return `${prefix}/${financialYear(doc.documentDate)}/${(doc.numberSuffix || '').trim() || '____'}`;
}

/** Fills the derived fields (number, totals, words, school name for the list) before save/print. */
export function finalizeDocument(type: DocType, doc: SalesDocData): SalesDocData {
  const totals = computeTotals(doc.qty, doc.rate);
  const schoolName = type === DOC_TYPES.PURCHASE_ORDER
    ? (doc.school?.name || doc.letterhead?.schoolName || '')
    : (doc.school?.name || '');
  return {
    ...doc,
    type,
    documentNumber: fullNumber(type, doc),
    // A quotation with no academic year typed prints the one worked out from its date; a purchase
    // order prints exactly what the user typed (the field is required there).
    academicYear: (doc.academicYearOverride || '').trim()
      || (type === DOC_TYPES.PURCHASE_ORDER ? '' : financialYear(doc.documentDate)),
    totals,
    amountInWords: amountInWords(totals.grandTotal),
    school: { ...doc.school, name: schoolName } as SalesDocSchool,
  };
}

export type SalesDocErrors = Record<string, string | undefined>;

/** What stops a save: the fields the document can't be identified or priced without. */
export function validateDocument(type: DocType, doc: SalesDocData): SalesDocErrors {
  const errors: SalesDocErrors = {};
  const numberLabel = type === DOC_TYPES.PURCHASE_ORDER ? 'Order No.' : `${DOC_META[type].label} No.`;
  if (DOC_META[type].numberPrefix && !isLegacyNumber(type, doc) ? !doc.numberSuffix?.trim() : !doc.documentNumber?.trim())
    errors.number = `${numberLabel} is required`;
  if (!doc.documentDate) errors.date = `${type === DOC_TYPES.PURCHASE_ORDER ? 'Order' : DOC_META[type].label} Date is required`;
  if (type === DOC_TYPES.PURCHASE_ORDER && !doc.academicYearOverride?.trim())
    errors.academicYearOverride = 'Academic Year is required';
  if (!doc.school?.name?.trim()) errors.schoolName = 'School Name is required';
  if (!(num(doc.qty) > 0)) errors.qty = 'Qty must be more than 0';
  if (!(num(doc.rate) > 0)) errors.rate = 'Rate must be more than 0';
  return errors;
}

export function pdfFileName(type: DocType, documentNumber?: string): string {
  const slug = (documentNumber || 'document').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${DOC_META[type].filePrefix}-${slug || 'document'}.pdf`;
}

// ── purchase order → tax invoice ─────────────────────────────────────────────

const first = (...vals: (string | null | undefined)[]): string =>
  vals.map((v) => (v == null ? '' : String(v).trim())).find(Boolean) || '';

/**
 * The invoice fields a saved purchase order fills in when it is picked as the Ref. Order No.:
 * the school (name, address, GSTIN, state), its contact, place of supply, qty and rate (so the
 * invoice amount equals the order), and the subscription period. A field the order left empty is
 * left out of the patch, so it never wipes what the user already typed on the invoice. The
 * invoice's own number, date, payment reference and signatures are never touched.
 */
export function invoiceFieldsFromOrder(po?: SalesDocData | null): Record<string, string> {
  if (!po) return {};
  const sc = po.school || ({} as SalesDocSchool);
  const lh = po.letterhead || ({} as any);
  const co = po.coordinator || ({} as SalesDocCoordinator);
  const phoneEmail = [co.phone, co.email].map((x) => (x || '').trim()).filter(Boolean).join(' / ');

  const patch: Record<string, string> = {
    'school.name': first(sc.name, lh.schoolName),
    'school.address1': first(sc.address, lh.address),
    'school.contactPerson': first(co.name),
    'school.phoneEmail': first(phoneEmail, lh.phoneEmail),
    'school.gstin': first(sc.gstin, lh.gstin).toUpperCase(),
    'school.state': first(sc.state),
    'school.stateCode': first(sc.stateCode),
    placeOfSupply: first(po.placeOfSupply),
    qty: first(po.qty),
    rate: first(po.rate),
    periodFrom: first(po.activationBy),
    periodTo: first(po.validTill),
  };
  const out: Record<string, string> = {};
  Object.entries(patch).forEach(([k, val]) => { if (val !== '') out[k] = val; });
  // The order has one address line; the invoice has two. When line 1 is replaced, line 2 must be
  // cleared too or the old second line would sit under the order's address.
  if (out['school.address1']) out['school.address2'] = '';
  return out;
}

// ── quotation → purchase order ───────────────────────────────────────────────

/**
 * The order fields a saved quotation fills in when it is picked as the Ref. Quotation No.: the
 * school (name, address, GSTIN, state) on both the letterhead and the Bill To box, the activation
 * coordinator, place of supply, academic year, scope (teacher logins — the same number as the
 * quotation's Qty — and classes), timeline, payment terms and advance, and qty/rate (so the order
 * value equals the quotation). A field the quotation left empty is left out of the patch, so it
 * never wipes what the user already typed on the order. The order's own number, date, signatures
 * and the two order-only signatory blocks are never touched.
 */
export function orderFieldsFromQuotation(quotation?: SalesDocData | null): Record<string, string> {
  if (!quotation) return {};
  const sc = quotation.school || ({} as SalesDocSchool);
  const co = quotation.coordinator || ({} as SalesDocCoordinator);
  const address = [sc.address1, sc.address2].map((x) => (x || '').trim()).filter(Boolean).join(', ');
  const gstin = first(sc.gstin).toUpperCase();

  const patch: Record<string, string> = {
    'letterhead.schoolName': first(sc.name),
    'school.name': first(sc.name),
    'letterhead.address': address,
    'school.address': address,
    'letterhead.gstin': gstin,
    'school.gstin': gstin,
    'letterhead.phoneEmail': first(sc.phoneEmail),
    'school.state': first(sc.state),
    'school.stateCode': first(sc.stateCode),
    'coordinator.name': first(co.name, sc.contactPerson),
    'coordinator.designation': first(co.designation),
    'coordinator.phone': first(co.phone),
    'coordinator.email': first(co.email),
    placeOfSupply: first(quotation.placeOfSupply),
    academicYearOverride: first(quotation.academicYearOverride),
    // The quotation's Qty is quoted as teacher-login subscriptions, so it is the login count.
    teacherLogins: first(quotation.qty),
    classes: first(quotation.classes),
    activationBy: first(quotation.activationBy),
    subscriptionMonths: first(quotation.subscriptionMonths),
    validTill: first(quotation.validTill),
    paymentTerms: first(quotation.paymentTerms),
    advance: first(quotation.advance),
    qty: first(quotation.qty),
    rate: first(quotation.rate),
  };
  const out: Record<string, string> = {};
  Object.entries(patch).forEach(([k, val]) => { if (val !== '') out[k] = val; });
  return out;
}

/** Immutable set of a dotted path ("school.name"). */
export function setPath<T extends Record<string, any>>(obj: T, path: string, value: any): T {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj[head] || {}, rest.join('.'), value) };
}
