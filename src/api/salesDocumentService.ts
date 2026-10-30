/**
 * Quotations, purchase/work orders and tax invoices — every B2B sales role; SH/SCA see all +
 * the register. Mirrors web's src/api/salesDocumentService.js. Stored in GCS by the backend
 * under SalesDocuments/{Quotations|PurchaseOrders|TaxInvoices}/{id}/ — data.json + the PDF.
 * `type` is one of DOC_TYPES: 'quotation' | 'purchase-order' | 'tax-invoice'.
 */
import { Platform } from 'react-native';
import { apiClient } from './client';
import { DocType, SalesDocData } from '../utils/salesDocUtils';

export interface SalesDocumentSummary {
  id: string;
  type: DocType;
  documentNumber: string;
  documentDate?: string;
  schoolName?: string;
  grandTotal: number;
  hasPdf: boolean;
  createdByName?: string;
  createdAt?: string;
  updatedByName?: string;
  updatedAt?: string;
  createdById?: number;
  createdByRole?: string;
  zone?: string;
  region?: string;
  subTotal: number;
  cgst: number;
  sgst: number;
  /** Inter-state supply (place of supply outside Gujarat) — CGST/SGST are 0 then. */
  igst?: number;
  qty: number;
  rate: number;
  schoolGstin?: string;
  placeOfSupply?: string;
  /** Tax invoice: the purchase order it bills (Ref. Order No.). */
  refOrderNumber?: string;
  /** Quotation: monthly | quarterly | half-yearly | annual — the plan chosen on the form. */
  billingPeriod?: string;
  /** Quotation: 'monthly' when the form's total is one month's amount; absent/'annual' on older quotations. */
  amountBasis?: string;
  /** Quotation: 'approved' once its creator approved it (plan + amount are then locked). */
  approvalStatus?: string | null;
  approvedAt?: string;
  approvedByName?: string;
}

export interface SalesRegisterRow extends SalesDocumentSummary {
  typeLabel: string;
  /** Purchase order: the tax invoices raised against it. */
  invoiceNumbers: string[];
  /** Purchase order: the order total minus what has been invoiced against it. */
  balanceToInvoice?: number;
}

export interface SalesDocumentDetail extends SalesDocumentSummary {
  /** The form exactly as it was saved. */
  data: SalesDocData;
}

export interface SalesDocumentShareLink {
  url: string;
  expiresAt: string;
  fileName: string;
}

export interface SalesDocumentFilter {
  createdById?: number;
  role?: string;
  zone?: string;
  region?: string;
  type?: DocType;
  from?: string;
  to?: string;
  q?: string;
}

/** A locally-generated PDF ready to upload — the RN twin of web's Blob. */
export interface LocalPdfFile { uri: string; name: string; type: 'application/pdf'; }

/** A binary download ready for RNShare: base64 body + the file name to save it as. */
export interface SalesDocumentFile { base64: string; fileName: string; mime: string; }

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PDF_MIME = 'application/pdf';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** ArrayBuffer → base64 without a native module (no RNFS/blob-util in this app). RN's XHR
 *  hands axios an ArrayBuffer for responseType 'arraybuffer'; RNShare takes the base64 as a
 *  data: URL and writes it to a temp file itself, so the user shares a real .xlsx/.pdf. */
/* eslint-disable no-bitwise */
const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  const out: string[] = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==');
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=');
  }
  return out.join('');
};
/* eslint-enable no-bitwise */

/** Same Content-Disposition parse as web's registerExcel. */
const fileNameFrom = (headers: any, fallback: string) => {
  const cd = String(headers?.['content-disposition'] || '');
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
};

/**
 * RNShare options for a downloaded file. Two react-native-share quirks (checked in its native
 * source): both platforms append the extension themselves, so `filename` goes without one; and
 * iOS guesses that extension with /[a-zA-Z0-9]+; on the data-URL header, which the dotted
 * .xlsx MIME never matches (it would fall back to ".png") — so iOS gets a short "application/xlsx"
 * header. Android needs the real MIME to resolve "xlsx" via MimeTypeMap.
 */
export const fileShareOptions = (f: SalesDocumentFile) => {
  const ext = f.mime === XLSX_MIME ? 'xlsx' : 'pdf';
  const header = Platform.OS === 'ios' ? `application/${ext}` : f.mime;
  return {
    url: `data:${header};base64,${f.base64}`,
    filename: f.fileName.replace(/\.(xlsx|pdf)$/i, '').replace(/[\\/]/g, '-'),
  };
};

const saveForm = (data: SalesDocData, file?: LocalPdfFile | null): FormData => {
  const fd = new FormData();
  fd.append('data', JSON.stringify(data));
  if (file) fd.append('file', file as unknown as Blob);
  return fd;
};

export const salesDocumentService = {
  list: (type: DocType, filters?: SalesDocumentFilter) =>
    apiClient.get<SalesDocumentSummary[]>(`/sales-documents/${type}`, { params: filters }),

  /** SH/SCA: every document of every type (the register preview). */
  register: (filters?: SalesDocumentFilter) =>
    apiClient.get<SalesRegisterRow[]>('/sales-documents/register', { params: filters }),

  /** SH/SCA: the register as the server-built .xlsx (same filters as the on-screen table). */
  registerExcel: async (filters?: SalesDocumentFilter, fallbackName = 'Sales-Documents-Register.xlsx'): Promise<SalesDocumentFile> => {
    const res = await apiClient.get<ArrayBuffer>('/sales-documents/register/excel', {
      params: filters, responseType: 'arraybuffer', timeout: 60000,
    });
    return { base64: toBase64(res.data), fileName: fileNameFrom(res.headers, fallbackName), mime: XLSX_MIME };
  },

  get: (type: DocType, id: string) =>
    apiClient.get<SalesDocumentDetail>(`/sales-documents/${type}/${id}`),

  nextNumber: (type: DocType, date?: string) =>
    apiClient.get<{ number: string }>(`/sales-documents/${type}/next-number`, { params: { date } }),

  create: (type: DocType, payload: SalesDocData, file?: LocalPdfFile | null) =>
    apiClient.post<SalesDocumentSummary>(`/sales-documents/${type}`, saveForm(payload, file), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (type: DocType, id: string, payload: SalesDocData, file?: LocalPdfFile | null) =>
    apiClient.put<SalesDocumentSummary>(`/sales-documents/${type}/${id}`, saveForm(payload, file), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** The stored PDF itself (web's downloadPdf) — for sharing the actual file, not a link. */
  downloadPdf: async (type: DocType, id: string, fileName: string): Promise<SalesDocumentFile> => {
    const res = await apiClient.get<ArrayBuffer>(`/sales-documents/${type}/${id}/pdf`, {
      responseType: 'arraybuffer', timeout: 60000,
    });
    return { base64: toBase64(res.data), fileName, mime: PDF_MIME };
  },

  /** A signed GCS link valid 7 days — View opens it; Share sends it (or the file, above). */
  shareLink: (type: DocType, id: string) =>
    apiClient.get<SalesDocumentShareLink>(`/sales-documents/${type}/${id}/share-link`),

  /** Quotation only — approves it for the plan on it (creator only); locks the plan and amount. */
  approveQuotation: (id: string) =>
    apiClient.post<SalesDocumentSummary>(`/sales-documents/quotation/${id}/approve`),

  remove: (type: DocType, id: string) =>
    apiClient.delete(`/sales-documents/${type}/${id}`),
};
