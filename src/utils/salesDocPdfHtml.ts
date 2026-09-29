/**
 * HTML/CSS rendering of the three TEACH-mode sales documents, fed to
 * react-native-html-to-pdf. Mobile has no @react-pdf equivalent, so this is a from-scratch port
 * of web's salesDocs/SalesDocumentPdf.jsx — same layout, wording and colours (navy/blue boxes,
 * bordered tables, signature frames), built as an HTML string instead of react-pdf primitives.
 * Font falls back to Arial/Helvetica (system) rather than embedding Arimo — Arimo was chosen on
 * web specifically for being metric-compatible with Arial, so this is a faithful substitute
 * without needing to bundle a font file into the mobile build.
 */
import {
  DOC_TYPES, DOC_META, COMPANY, BANK, SAC, CGST_RATE, SGST_RATE, GST_RATE,
  financialYear, displayDate, money, num, DocType, SalesDocData,
} from './salesDocUtils';

const NAVY = '#1F3A5F';
const BLUE = '#2E75B6';
const LIGHT = '#E8F0F8';
const GREY = '#666666';
const BLANK = '________________';

/** Escapes text dropped into the HTML template — every field is user-typed. */
const esc = (s: any): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const v = (value: any, blank = BLANK): string => {
  const s = value !== undefined && value !== null ? String(value).trim() : '';
  return esc(s !== '' ? value : blank);
};
const dateOrBlank = (d?: string | null): string => (d ? esc(displayDate(d)) : '___ / ___ / ______');
const qtyText = (q: any): string => (num(q) ? String(num(q)) : '');

/** "Label: value" line. */
const line = (label: string, value: any, blank?: string): string =>
  `<div class="line"><b>${esc(label)}:</b> ${v(value, blank)}</div>`;

const box = (title: string, bodyHtml: string, extraStyle = ''): string =>
  `<div class="box" style="${extraStyle}"><div class="box-title">${esc(title)}</div><div class="box-body">${bodyHtml}</div></div>`;

const twoBoxes = (leftTitle: string, leftBody: string, rightTitle: string, rightBody: string): string => `
  <div class="box-row">
    ${box(leftTitle, leftBody, 'border-right:none;')}
    ${box(rightTitle, rightBody)}
  </div>`;

interface Col { label: string; flex: number; align?: 'left' | 'center' | 'right'; }

const table = (cols: Col[], rows: string[][], headerBg = BLUE, headerColor = '#fff'): string => `
  <table class="doc-table">
    <thead><tr>
      ${cols.map((c) => `<th style="flex:${c.flex};background:${headerBg};color:${headerColor};">${esc(c.label)}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((cell, ci) => `<td style="flex:${cols[ci].flex};text-align:${cols[ci].align || 'left'};">${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`;

interface TotalsRow { label: string; value: string; strong?: boolean; }

const totalsBlock = (doc: SalesDocData, note: string, rows: TotalsRow[]): string => `
  <div class="totals-wrap">
    <div class="totals-note">
      <div><b>Amount in words:</b> <i>${esc(doc.amountInWords)}</i></div>
      <div class="totals-note-sub">${esc(note)}</div>
    </div>
    <table class="totals-table">
      ${rows.map((r, i) => {
        const bg = r.strong ? NAVY : i === 0 ? LIGHT : undefined;
        const color = r.strong ? '#fff' : undefined;
        const weight = r.strong || i === 0 ? '700' : '400';
        return `<tr style="${bg ? `background:${bg};` : ''}${color ? `color:${color};` : ''}">
          <td style="font-weight:${weight};">${esc(r.label)}</td>
          <td style="text-align:right;font-weight:${weight};">${esc(r.value)}</td>
        </tr>`;
      }).join('')}
    </table>
  </div>`;

const terms = (lines: string[]): string =>
  box('TERMS & CONDITIONS', `<ol class="terms">${lines.map((l) => `<li>${l}</li>`).join('')}</ol>`, 'margin-top:9pt;');

interface SignSide { heading: string; caption: string; signature?: string; extra?: string; }

const signatures = (left: SignSide, right: SignSide): string => {
  const cell = (side: SignSide, alignRight: boolean) => `
    <div class="sign-cell" style="${alignRight ? 'align-items:flex-end;text-align:right;' : 'border-right:1px solid #000;'}">
      <b>${esc(side.heading)}</b>
      ${side.signature ? `<img class="sign-img" src="${side.signature}" />` : '<div class="sign-space"></div>'}
      <div>
        <div class="grey">${esc(side.caption)}</div>
        ${side.extra || ''}
      </div>
    </div>`;
  return `<div class="sign-row">${cell(left, false)}${cell(right, true)}</div>`;
};

const header = (title: string, subtitle: string | null, name: string, detailsHtml: string): string => `
  <div class="header">
    <div class="title-row">
      <div class="doc-title">${esc(title)}</div>
      <img class="logo" src="TEACH_LOGO_URI" />
    </div>
    ${subtitle ? `<div class="doc-subtitle">${esc(subtitle)}</div>` : ''}
    <div class="company-name">${name}</div>
    <div class="header-bottom">
      <div class="header-details">${detailsHtml}</div>
      <div class="tagline">Teacher Login Subscription</div>
    </div>
  </div>`;

const companyDetails = (withState: boolean): string => `
  <div class="grey line">${esc(COMPANY.address1)}</div>
  <div class="grey line">${esc(COMPANY.address2)}</div>
  ${withState ? `<div class="line"><b>State:</b> ${esc(COMPANY.state)}&nbsp;&nbsp;<b>State Code:</b> ${esc(COMPANY.stateCode)}</div>` : ''}
  ${line('GSTIN', COMPANY.gstin)}
  ${line('Email', COMPANY.email)}
  ${line('Web', COMPANY.web)}`;

// ── Quotation ────────────────────────────────────────────────────────────────

function quotationBody(doc: SalesDocData): string {
  const t = doc.totals!;
  const sc = doc.school || ({} as any);
  const co = doc.coordinator || ({} as any);
  const sig = doc.signatures || ({} as any);
  return `
    ${header('QUOTATION', null, esc(COMPANY.name), companyDetails(false))}
    ${twoBoxes(
      'TO (SCHOOL)',
      `${line('School Name', sc.name)}${line('Address', sc.address1)}<div class="line">${v(sc.address2, '')}</div>${line('Contact Person', sc.contactPerson)}${line('Phone / Email', sc.phoneEmail)}${line('GSTIN (if any)', sc.gstin)}${line('State / State Code', `${v(sc.state, '______________')} / ${v(sc.stateCode, '____')}`, '')}`,
      'QUOTATION DETAILS',
      `${line('Quotation No.', doc.documentNumber)}${line('Quotation Date', dateOrBlank(doc.documentDate))}${line('Valid Until', `${v(doc.validDays, '____')} days from date of issue`, '')}${line('Place of Supply', doc.placeOfSupply)}${line('Academic Year', doc.academicYear || financialYear(doc.documentDate))}${line('Prepared By', doc.preparedBy)}`,
    )}
    ${twoBoxes(
      'SCHOOL CONTACT FOR ACTIVATION',
      `${line('Coordinator Name', co.name)}${line('Designation', co.designation)}${line('Phone', co.phone)}${line('Email', co.email)}`,
      'SCOPE & TIMELINE',
      `${line('Classes', doc.classes)}${line('Expected Activation By', dateOrBlank(doc.activationBy))}${line('Subscription Valid Till', dateOrBlank(doc.validTill))}${line('Advance (if any)', doc.advance)}`,
    )}
    <p class="para"><b>Dear Sir / Madam,</b> Thank you for your interest in SINGULARITY – TEACH Mode. We are pleased to submit our quotation for the Teacher Login Subscription as detailed below.</p>
    ${table(
      [{ label: 'S.No', flex: 0.5, align: 'center' }, { label: 'Description', flex: 3.2 }, { label: 'Qty', flex: 0.5, align: 'center' },
        { label: 'Rate (₹)', flex: 0.8, align: 'right' }, { label: 'Amount (₹)', flex: 1, align: 'right' }, { label: 'GST %', flex: 0.65, align: 'center' }],
      [['1',
        `<div><b>SINGULARITY – TEACH Mode</b><div>Teacher Login Subscription (per teacher)</div><div class="italic grey small">Teacher dashboard, classroom teaching tools &amp; content, updates and support for the subscription period.</div></div>`,
        qtyText(doc.qty), esc(money(doc.rate)), esc(money(t.subTotal)), `${GST_RATE}%`]],
    )}
    ${totalsBlock(doc, 'Note: CGST 9% + SGST 9% applies for schools in Gujarat; IGST 18% applies for schools outside Gujarat.', [
      { label: 'Sub Total', value: money(t.subTotal) },
      { label: `CGST @ ${CGST_RATE}%`, value: money(t.cgst) },
      { label: `SGST @ ${SGST_RATE}%`, value: money(t.sgst) },
      { label: 'TOTAL (₹)', value: money(t.grandTotal), strong: true },
    ])}
    ${terms([
      'This is a quotation for your consideration and is not a tax invoice or a demand for payment.',
      `Prices are valid for ${v(doc.validDays, '______')} days from the date of this quotation.`,
      `Subscription is valid for ${v(doc.subscriptionMonths, '______')} months from the date of activation.`,
      'To confirm, please issue a Purchase / Work Order against this quotation.',
      'A GST Tax Invoice will be issued on confirmation of the order.',
      'Logins are non-transferable and for use by the named teacher only.',
      `Payment Terms: ${v(doc.paymentTerms, '____________________')}.&nbsp;|&nbsp;Subject to Ahmedabad jurisdiction.`,
    ])}
    ${signatures(
      { heading: `For ${COMPANY.legalName}`, caption: 'Authorised Signatory', signature: sig.company },
      { heading: 'Acknowledged by (School)', caption: 'Signature & Seal', signature: sig.school },
    )}
    <div class="footer">This is a quotation only and not a Tax Invoice. Prices are subject to the validity and terms stated above.</div>`;
}

// ── Purchase / Work Order ────────────────────────────────────────────────────

function purchaseOrderBody(doc: SalesDocData): string {
  const t = doc.totals!;
  const lh = doc.letterhead || ({} as any);
  const sc = doc.school || ({} as any);
  const co = doc.coordinator || ({} as any);
  const sig = doc.signatures || ({} as any);
  const months = v(doc.subscriptionMonths, '______');
  return `
    ${header('PURCHASE / WORK ORDER', null, v(lh.schoolName, '[SCHOOL NAME]'),
      `<div class="grey line">${v(lh.address, '[School Address, City – PIN]')}</div>${line('GSTIN (if any)', lh.gstin)}${line('Phone / Email', lh.phoneEmail)}`)}
    ${twoBoxes(
      'TO (VENDOR / SERVICE PROVIDER)',
      `<div class="line"><b>${esc(COMPANY.legalName)}</b></div><div class="line">${esc(COMPANY.address1)}</div><div class="line">${esc(COMPANY.address2)}</div>${line('GSTIN', COMPANY.gstin)}${line('Email', COMPANY.email)}${line('Web', COMPANY.web)}`,
      'ORDER DETAILS',
      `${line('Order No.', doc.documentNumber)}${line('Order Date', dateOrBlank(doc.documentDate))}${line('Place of Supply', doc.placeOfSupply)}${line('Academic Year', doc.academicYear)}`,
    )}
    ${twoBoxes(
      'BILL TO (SCHOOL)',
      `${line('School Name', sc.name)}${line('Address', sc.address)}${line('GSTIN (if any)', sc.gstin)}${line('State / State Code', `${v(sc.state, '______________')} / ${v(sc.stateCode, '____')}`, '')}`,
      'SCHOOL CONTACT FOR ACTIVATION',
      `${line('Coordinator Name', co.name)}${line('Designation', co.designation)}${line('Phone', co.phone)}${line('Email', co.email)}`,
    )}
    ${table(
      [{ label: 'S.No', flex: 0.5, align: 'center' }, { label: 'Scope of Work / Supply', flex: 4.2 }, { label: 'Quantity / Details', flex: 1.4, align: 'center' }],
      [
        ['1', 'Creation and activation of Teacher Logins for SINGULARITY – TEACH Mode', esc(`${v(doc.teacherLogins, '______')} teacher logins`)],
        ['2', 'Access to TEACH Mode teaching tools &amp; content for subscribed classes', esc(`Classes: ${v(doc.classes, '__________')}`)],
        ['3', 'Platform updates and technical support during the subscription period', 'As per subscription'],
      ],
    )}
    ${table(
      [{ label: 'S.No', flex: 0.5, align: 'center' }, { label: 'Description', flex: 3.2 }, { label: 'SAC', flex: 0.7, align: 'center' },
        { label: 'Qty', flex: 0.5, align: 'center' }, { label: 'Rate (₹)', flex: 0.8, align: 'right' }, { label: 'Amount (₹)', flex: 1, align: 'right' }],
      [['1', `<b>SINGULARITY – TEACH Mode</b><span class="grey"> — Teacher Login Subscription (per teacher)</span>`, SAC, qtyText(doc.qty), esc(money(doc.rate)), esc(money(t.subTotal))]],
    )}
    ${totalsBlock(doc, 'Note: CGST + SGST applies for schools located in Gujarat; IGST @ 18% applies for schools outside Gujarat.', [
      { label: 'Sub Total', value: money(t.subTotal) },
      { label: `CGST @ ${CGST_RATE}%`, value: money(t.cgst) },
      { label: `SGST @ ${SGST_RATE}%`, value: money(t.sgst) },
      { label: 'TOTAL ORDER VALUE (₹)', value: money(t.grandTotal), strong: true },
    ])}
    ${twoBoxes(
      'TIMELINE',
      `${line('Login Activation By', dateOrBlank(doc.activationBy))}${line('Subscription Period', `${months} months from activation`, '')}${line('Subscription Valid Till', dateOrBlank(doc.validTill))}`,
      'PAYMENT',
      `${line('Payment Terms', doc.paymentTerms)}${line('Mode', 'NEFT / RTGS / Cheque')}${line('Advance (if any)', doc.advance)}`,
    )}
    ${terms([
      'The school will share the list of teachers (name, email ID, mobile no.) for login creation.',
      'Logins will be activated on receipt of payment and the teacher list from the school.',
      `Subscription Period: ${months} months from the date of activation.`,
      'Logins are non-transferable and for use by the named teacher only.',
      'The vendor shall raise a GST Tax Invoice quoting this Order number; any change in scope shall be made through a revised order.',
      'Subject to Ahmedabad jurisdiction.',
    ])}
    ${signatures(
      {
        heading: `For ${v(lh.schoolName || sc.name, '[School Name]')}`,
        caption: 'Authorised Signatory (Principal / Trustee) & Seal',
        signature: sig.school,
        extra: `<div class="grey small extra">Name: ${v(doc.schoolSignatory?.name, '____________')}&nbsp;&nbsp;Date: ${doc.schoolSignatory?.date ? esc(displayDate(doc.schoolSignatory.date)) : '__________'}</div>`,
      },
      {
        heading: `Accepted by ${COMPANY.legalName}`,
        caption: 'Authorised Signatory',
        signature: sig.company,
        extra: `<div class="grey small extra">Name: ${v(doc.vendorSignatory?.name, '____________')}&nbsp;&nbsp;Date: ${doc.vendorSignatory?.date ? esc(displayDate(doc.vendorSignatory.date)) : '__________'}</div>`,
      },
    )}
    <div class="footer">Please quote this Order number in all invoices and correspondence.</div>`;
}

// ── Tax Invoice ──────────────────────────────────────────────────────────────

function taxInvoiceBody(doc: SalesDocData): string {
  const t = doc.totals!;
  const sc = doc.school || ({} as any);
  const sig = doc.signatures || ({} as any);
  const period = `${dateOrBlank(doc.periodFrom)} to ${dateOrBlank(doc.periodTo)}`;
  return `
    ${header('TAX INVOICE', 'ORIGINAL FOR RECIPIENT', esc(COMPANY.name), companyDetails(true))}
    ${twoBoxes(
      'BILL TO (SCHOOL)',
      `${line('School Name', sc.name)}${line('Address', sc.address1)}<div class="line">${v(sc.address2, '')}</div>${line('Contact Person', sc.contactPerson)}${line('Phone / Email', sc.phoneEmail)}${line('School GSTIN (if any)', sc.gstin)}${line('State / State Code', `${v(sc.state, '______________')} / ${v(sc.stateCode, '____')}`, '')}`,
      'INVOICE DETAILS',
      `${line('Invoice No.', doc.documentNumber)}${line('Invoice Date', dateOrBlank(doc.documentDate))}${line('Ref. Order No.', doc.refOrderNumber)}${line('Place of Supply', doc.placeOfSupply)}${line('Reverse Charge', 'No')}${line('Subscription Period', period, '')}${line('Payment Ref. / UTR', doc.paymentRef)}`,
    )}
    ${table(
      [{ label: 'S.No', flex: 0.5, align: 'center' }, { label: 'Description', flex: 3.2 }, { label: 'SAC', flex: 0.7, align: 'center' },
        { label: 'Qty', flex: 0.5, align: 'center' }, { label: 'Rate (₹)', flex: 0.8, align: 'right' }, { label: 'Amount (₹)', flex: 1, align: 'right' }],
      [['1',
        `<div><b>SINGULARITY – TEACH Mode</b><div>Teacher Login Subscription (Annual, per teacher)</div><div class="italic grey small">Includes teacher dashboard access, classroom-ready interactive teaching tools &amp; content, updates and support for the subscription period.</div></div>`,
        SAC, qtyText(doc.qty), esc(money(doc.rate)), esc(money(t.subTotal))]],
    )}
    ${totalsBlock(doc, 'Note: CGST + SGST applies for schools located in Gujarat; IGST @ 18% applies for schools outside Gujarat.', [
      { label: 'Sub Total', value: money(t.subTotal) },
      { label: `CGST @ ${CGST_RATE}%`, value: money(t.cgst) },
      { label: `SGST @ ${SGST_RATE}%`, value: money(t.sgst) },
      { label: `IGST @ ${GST_RATE}%`, value: '—' },
      { label: 'GRAND TOTAL (₹)', value: money(t.grandTotal), strong: true },
    ])}
    <div class="section-heading">TAX SUMMARY (SAC-WISE)</div>
    ${table(
      [{ label: 'SAC', flex: 0.8, align: 'center' }, { label: 'Taxable Value', flex: 1.2, align: 'center' }, { label: 'CGST Rate', flex: 1, align: 'center' },
        { label: 'CGST Amt', flex: 1, align: 'center' }, { label: 'SGST Rate', flex: 1, align: 'center' }, { label: 'SGST Amt', flex: 1, align: 'center' }, { label: 'Total Tax', flex: 1, align: 'center' }],
      [[SAC, esc(money(t.subTotal)), `${CGST_RATE}%`, esc(money(t.cgst)), `${SGST_RATE}%`, esc(money(t.sgst)), esc(money(t.totalTax))]],
      LIGHT, '#000',
    )}
    ${twoBoxes(
      'PAYMENT / BANK DETAILS',
      `${line('Account Name', BANK.accountName)}${line('Bank Name', BANK.bankName)}${line('Account No.', BANK.accountNo)}${line('IFSC Code', BANK.ifsc)}${line('Branch', BANK.branch)}`,
      'TERMS & CONDITIONS',
      `<ol class="terms">${[
        'Payment received in full against this invoice.',
        'Subscription is valid for the period mentioned above.',
        'Logins are non-transferable and for use by the named teacher only.',
        'Subscription fees once paid are non-refundable.',
        'Subject to Ahmedabad jurisdiction.',
        'E. &amp; O.E.',
      ].map((l) => `<li>${l}</li>`).join('')}</ol>`,
    )}
    <p class="para small"><b>Declaration:</b> <i>We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.</i></p>
    ${signatures(
      { heading: 'Received by (School)', caption: 'Signature & School Seal', signature: sig.school },
      { heading: `For ${COMPANY.legalName}`, caption: 'Authorised Signatory', signature: sig.company },
    )}
    <div class="footer">This is a computer-generated Tax Invoice.&nbsp;|&nbsp;${esc(COMPANY.email)}&nbsp;|&nbsp;${esc(COMPANY.web)}</div>`;
}

const BODIES: Record<DocType, (doc: SalesDocData) => string> = {
  [DOC_TYPES.QUOTATION]: quotationBody,
  [DOC_TYPES.PURCHASE_ORDER]: purchaseOrderBody,
  [DOC_TYPES.TAX_INVOICE]: taxInvoiceBody,
};

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; margin: 0; padding: 20pt 36pt 16pt; }
  .line { margin-bottom: 1.8pt; }
  .grey { color: ${GREY}; }
  .italic { font-style: italic; }
  .small { font-size: 8pt; }
  b { font-weight: 700; }

  .header { padding-bottom: 6pt; border-bottom: 2pt solid ${NAVY}; }
  .title-row { display: flex; flex-direction: row; justify-content: space-between; align-items: center; }
  .doc-title { font-size: 21pt; font-weight: 700; color: ${BLUE}; letter-spacing: 0.3pt; flex: 1; padding-right: 14pt; }
  .doc-subtitle { font-size: 7.5pt; font-weight: 700; color: ${GREY}; margin-top: 1pt; letter-spacing: 0.4pt; }
  .company-name { font-size: 14pt; font-weight: 700; color: ${NAVY}; margin-top: 6pt; }
  .logo { width: 150pt; height: 28.9pt; object-fit: contain; }
  .header-bottom { display: flex; flex-direction: row; justify-content: space-between; align-items: flex-end; margin-top: 5pt; }
  .header-details { flex: 1; padding-right: 14pt; }
  .tagline { font-size: 9pt; color: ${GREY}; white-space: nowrap; }

  .box-row { display: flex; flex-direction: row; margin-top: 9pt; }
  .box { flex: 1; border: 1pt solid #000; }
  .box-title { background: ${NAVY}; color: #fff; font-weight: 700; padding: 3pt 6pt; font-size: 9pt; }
  .box-body { padding: 4pt 6pt; }

  .doc-table { width: 100%; border-collapse: collapse; border: 1pt solid #000; margin-top: 9pt; }
  .doc-table thead tr, .doc-table tbody tr { display: flex; flex-direction: row; }
  .doc-table th { font-weight: 700; text-align: center; padding: 3pt 4pt; border-right: 1pt solid #000; font-size: 9pt; }
  .doc-table th:last-child { border-right: none; }
  .doc-table td { padding: 3pt 4pt; border-top: 1pt solid #000; border-right: 1pt solid #000; vertical-align: middle; }
  .doc-table td:last-child { border-right: none; }

  .totals-wrap { display: flex; flex-direction: row; margin-top: 9pt; align-items: flex-start; }
  .totals-note { flex: 1; padding-right: 14pt; }
  .totals-note-sub { font-style: italic; color: ${GREY}; font-size: 8pt; margin-top: 3pt; }
  .totals-table { width: 250pt; border-collapse: collapse; border: 1pt solid #000; flex-shrink: 0; }
  .totals-table td { padding: 3pt 6pt; border: 1pt solid #000; font-size: 9pt; }

  .terms { margin: 0; padding-left: 14pt; font-size: 8.5pt; }
  .terms li { margin-bottom: 1.8pt; }

  .sign-row { display: flex; flex-direction: row; margin-top: 10pt; border: 1pt solid #000; }
  .sign-cell { flex: 1; min-height: 60pt; padding: 6pt; display: flex; flex-direction: column; justify-content: space-between; }
  .sign-img { width: 93pt; height: 31pt; object-fit: contain; margin: 2pt 0; }
  .sign-space { height: 24pt; }
  .extra { margin-top: 2pt; }

  .para { margin: 12pt 0 0; }
  .section-heading { color: ${BLUE}; font-weight: 700; margin-top: 10pt; font-size: 9.5pt; }
  .footer { margin-top: 8pt; text-align: center; font-size: 7.5pt; font-style: italic; color: ${GREY}; }

  .watermark { position: fixed; top: 256pt; left: 132pt; width: 330pt; height: 330pt; opacity: 0.07; z-index: -1; }
`;

/** Renders the finished document (see finalizeDocument) to an HTML string ready for
 *  react-native-html-to-pdf. `teachLogoDataUri` / `watermarkDataUri` are base64 data URIs —
 *  react-native-html-to-pdf's WebView can't reach bundled asset paths reliably, so both are
 *  passed in as data URIs rather than referenced by file path. */
export function renderSalesDocumentHtml(
  type: DocType,
  doc: SalesDocData,
  teachLogoDataUri: string,
  watermarkDataUri?: string | null,
): string {
  const body = BODIES[type](doc).replace(/TEACH_LOGO_URI/g, teachLogoDataUri);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(DOC_META[type].label)} ${esc(doc.documentNumber)}</title>
  <style>${STYLE}</style>
</head>
<body>
  ${watermarkDataUri ? `<img class="watermark" src="${watermarkDataUri}" />` : ''}
  ${body}
</body>
</html>`;
}
