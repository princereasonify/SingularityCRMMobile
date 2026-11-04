import { renderSalesDocumentHtml } from '../src/utils/salesDocPdfHtml';
import { DOC_TYPES, emptyDocument, finalizeDocument, DocType } from '../src/utils/salesDocUtils';

const build = (type: DocType) => {
  const d: any = emptyDocument(type);
  d.documentDate = '2026-11-04'; d.qty = '10'; d.rate = '1500';
  d.school = { ...(d.school || {}), name: 'A & B School', state: 'Gujarat', stateCode: '24' };
  d.letterhead = { schoolName: 'A & B School' };
  d.schoolSignatory = { name: 'P', date: '2026-11-04' };
  d.documentNumber = 'RTPL/X/2026-27/0001';
  return renderSalesDocumentHtml(type, finalizeDocument(type, d), 'data:image/png;base64,AA==', null);
};

describe('sales document PDF html', () => {
  it('appends Annexure A to the Quotation and the PO, but not the Tax Invoice', () => {
    expect(build(DOC_TYPES.QUOTATION)).toContain('Annexure A');
    expect(build(DOC_TYPES.PURCHASE_ORDER)).toContain('Annexure A');
    expect(build(DOC_TYPES.TAX_INVOICE)).not.toContain('Annexure A');
  });
  it('prints bank details on the Tax Invoice only', () => {
    expect(build(DOC_TYPES.TAX_INVOICE)).toContain('IFSC');
    expect(build(DOC_TYPES.QUOTATION)).not.toContain('IFSC Code');
  });
  it('escapes a school name once (no &amp;amp;)', () => {
    [DOC_TYPES.QUOTATION, DOC_TYPES.PURCHASE_ORDER, DOC_TYPES.TAX_INVOICE].forEach((t) => {
      const html = build(t);
      expect(html).toContain('A &amp; B School');
      expect(html).not.toContain('&amp;amp;');
    });
  });
  it('is A4 with zero page margin so layout does not depend on the print engine default', () => {
    expect(build(DOC_TYPES.QUOTATION)).toContain('@page { size: 595pt 842pt; margin: 0; }');
  });
});
