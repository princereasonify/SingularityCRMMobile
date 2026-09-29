/**
 * Quotations, purchase/work orders and tax invoices — every B2B sales role; SH/SCA see all +
 * the register. Mirrors web's src/api/salesDocumentService.js. Stored in GCS by the backend
 * under SalesDocuments/{Quotations|PurchaseOrders|TaxInvoices}/{id}/ — data.json + the PDF.
 * `type` is one of DOC_TYPES: 'quotation' | 'purchase-order' | 'tax-invoice'.
 */
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
  qty: number;
  rate: number;
  schoolGstin?: string;
  placeOfSupply?: string;
  /** Tax invoice: the purchase order it bills (Ref. Order No.). */
  refOrderNumber?: string;
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

  /** A signed GCS link valid 7 days — mobile opens/shares this instead of downloading raw
   *  bytes (no filesystem module on this client for an arbitrary remote download). */
  shareLink: (type: DocType, id: string) =>
    apiClient.get<SalesDocumentShareLink>(`/sales-documents/${type}/${id}/share-link`),

  remove: (type: DocType, id: string) =>
    apiClient.delete(`/sales-documents/${type}/${id}`),
};
