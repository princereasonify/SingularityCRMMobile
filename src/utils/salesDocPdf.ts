/**
 * Renders a finalized sales document (see finalizeDocument) to a real PDF file on-device,
 * ready to upload or share — the mobile twin of web's renderSalesDocumentPdf (which calls
 * @react-pdf's pdf().toBlob()). Same generatePDF({html}) → local file pattern already proven
 * in ReportsScreen's AI-report PDF export.
 */
import { generatePDF } from 'react-native-html-to-pdf';
import { renderSalesDocumentHtml } from './salesDocPdfHtml';
import { teachLogoDataUri } from '../assets/teachLogoBase64';
import { singularityLogoXml } from '../assets/singularityLogoXml';
import { DocType, SalesDocData, pdfFileName } from './salesDocUtils';
import { LocalPdfFile } from '../api/salesDocumentService';

// The plain SVG mark, faded via the template's `.watermark { opacity: 0.07 }` — web instead
// pre-bakes the fade into a canvas-rendered PNG because @react-pdf can't apply CSS opacity to
// an Image; a WebView-based renderer can, so the extra step isn't needed here.
const watermarkDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(singularityLogoXml)}`;

export async function renderSalesDocumentPdf(type: DocType, doc: SalesDocData): Promise<LocalPdfFile> {
  const html = renderSalesDocumentHtml(type, doc, teachLogoDataUri, watermarkDataUri);
  const baseName = pdfFileName(type, doc.documentNumber).replace(/\.pdf$/i, '');
  const result = await generatePDF({
    html,
    fileName: baseName,
    directory: 'Documents',
    base64: false,
    height: 842,
    width: 595,
  });
  if (!result.filePath) throw new Error('PDF generation failed');
  return { uri: `file://${result.filePath}`, name: `${baseName}.pdf`, type: 'application/pdf' };
}
