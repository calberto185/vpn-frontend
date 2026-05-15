import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const BRAND      = 'SVION VPN';
const VERIFY_URL = 'https://vpn.carlosvm.ru';

/**
 * Generates a QR code as a base64 PNG data URL.
 */
export async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width:         120,
    margin:        1,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Adds a signed footer with QR code to EVERY page of the document.
 * Call this AFTER all content has been added (just before doc.save()).
 *
 * @param doc       jsPDF instance
 * @param refId     Payment / document ID (shown in footer and encoded in QR)
 * @param serial    Short serial / hash to display (e.g. first 8 chars of id)
 */
export async function addSignedFooter(
  doc:    jsPDF,
  refId:  string,
  serial?: string,
): Promise<void> {
  const totalPages = (doc as any).internal.pages.length - 1; // jsPDF internal page count
  const qrUrl      = `${VERIFY_URL}/verify/${refId}`;
  const qrDataUrl  = await generateQRDataUrl(qrUrl);

  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const footerY = pageH - 18;         // footer block starts here
  const qrSize  = 14;                 // mm
  const lm      = 18;

  const now      = new Date();
  const dateStr  = now.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr  = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const serialStr = serial ?? refId.slice(0, 8).toUpperCase();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    // ── Separator line ──
    doc.setDrawColor(180, 180, 200);
    doc.setLineWidth(0.3);
    doc.line(lm, footerY - 2, pageW - lm, footerY - 2);

    // ── QR code (left) ──
    doc.addImage(qrDataUrl, 'PNG', lm, footerY, qrSize, qrSize, undefined, 'FAST');

    // ── Signature text (right of QR) ──
    const tx = lm + qrSize + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 95);
    doc.text(`Firmado digitalmente por ${BRAND}`, tx, footerY + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(80);
    doc.text(`Ref: ${serialStr}`, tx, footerY + 7.5);
    doc.text(`Emitido: ${dateStr} ${timeStr}`, tx, footerY + 11.5);

    // ── Verification URL (right of QR, second column) ──
    const tx2 = pageW / 2 + 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100);
    doc.text('Escanea el codigo QR para verificar', tx2, footerY + 4);
    doc.text(`este documento en: ${VERIFY_URL}`, tx2, footerY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(140);
    doc.text(`Pag. ${page} / ${totalPages}`, tx2, footerY + 13);
  }
}
