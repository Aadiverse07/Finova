import { invoiceStatus, invoiceSubtotal, invoiceTotal } from '@/lib/data/calc';
import { fmtDate, r2 } from '@/lib/data/format';
import type { Invoice } from '@/lib/data/types';
import { PdfDoc, downloadPdf, hex } from './pdf';

const INK = hex('#14213d'), MUTED = hex('#6b7893'), RULE = hex('#d9dfeb'), ACCENT = hex('#2f4b9a'), SOFT = hex('#f3f5fa'), WHITE: [number, number, number] = [1, 1, 1];
const inr = (n: number) => `Rs. ${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_COLOR: Record<string, string> = { Paid: '#15803d', Pending: '#b45309', Overdue: '#b91c1c', Draft: '#6b7280' };

export function buildInvoicePdf(inv: Invoice): Uint8Array {
  const d = new PdfDoc(); const L = 48, R = d.width - 48, W = R - L;
  const status = invoiceStatus(inv);
  const colQty = L + W * 0.62, colPrice = L + W * 0.8, colAmt = R;

  const header = () => {
    d.rect(0, 0, d.width, 8, ACCENT);
    d.text('Finova', L, 62, { font: 'serifBold', size: 26, color: INK });
    d.text('Accounting workspace', L, 78, { font: 'serifItalic', size: 10.5, color: MUTED });
    d.text('INVOICE', R, 60, { font: 'serif', size: 26, color: ACCENT, align: 'right', spacing: 3 });
    d.text(inv.number, R, 78, { font: 'sansBold', size: 11, color: INK, align: 'right' });
  };
  const tableHead = (y: number) => {
    d.rect(L, y, W, 26, INK);
    const ty = y + 17;
    d.text('DESCRIPTION', L + 12, ty, { font: 'sansBold', size: 8.5, color: WHITE, spacing: 1 });
    d.text('QTY', colQty, ty, { font: 'sansBold', size: 8.5, color: WHITE, align: 'right', spacing: 1 });
    d.text('UNIT PRICE', colPrice, ty, { font: 'sansBold', size: 8.5, color: WHITE, align: 'right', spacing: 1 });
    d.text('AMOUNT', colAmt - 12, ty, { font: 'sansBold', size: 8.5, color: WHITE, align: 'right', spacing: 1 });
    return y + 26;
  };
  const footer = () => {
    d.line(L, 800, R, 800, RULE);
    d.text('Thank you for your business.', L, 816, { font: 'serifItalic', size: 10, color: MUTED });
    d.text(`${inv.number}  |  Page ${d.pageCount}`, R, 816, { font: 'sans', size: 8.5, color: MUTED, align: 'right' });
  };

  header();
  // Meta block
  let y = 118;
  d.text('BILLED TO', L, y, { font: 'sansBold', size: 8.5, color: MUTED, spacing: 1 });
  d.text(d.fit(inv.customer, 'serifBold', 17, W * 0.5), L, y + 22, { font: 'serifBold', size: 17, color: INK });
  const mx = L + W * 0.58;
  const meta: [string, string][] = [['Invoice date', fmtDate(inv.date)], ['Due date', fmtDate(inv.dueDate)], ['Status', status]];
  if (inv.paidOn) meta.push(['Paid on', fmtDate(inv.paidOn)]);
  meta.forEach(([k, v], i) => {
    const my = y + i * 19;
    d.text(k, mx, my, { font: 'sans', size: 9.5, color: MUTED });
    d.text(v, R, my, { font: 'sansBold', size: 10, color: k === 'Status' ? hex(STATUS_COLOR[status] ?? '#14213d') : INK, align: 'right' });
  });
  y = Math.max(y + 44, y + meta.length * 19) + 22;
  d.line(L, y - 10, R, y - 10, RULE);

  y = tableHead(y);
  inv.lines.forEach((l, i) => {
    const descLines = d.wrap(l.description || '-', 'serif', 11.5, colQty - L - 70);
    const rowH = Math.max(30, descLines.length * 15 + 14);
    if (y + rowH > 700) { footer(); d.addPage(); header(); y = tableHead(118); }
    if (i % 2 === 1) d.rect(L, y, W, rowH, SOFT);
    descLines.forEach((t, k) => d.text(t, L + 12, y + 19 + k * 15, { font: 'serif', size: 11.5, color: INK }));
    const qty = Number(l.quantity || 0), price = Number(l.unitPrice || 0);
    d.text(String(qty), colQty, y + 19, { font: 'sans', size: 10.5, color: INK, align: 'right' });
    d.text(inr(price), colPrice, y + 19, { font: 'sans', size: 10.5, color: INK, align: 'right' });
    d.text(inr(r2(qty * price)), colAmt - 12, y + 19, { font: 'sansBold', size: 10.5, color: INK, align: 'right' });
    y += rowH;
  });
  d.line(L, y, R, y, RULE);

  // Totals
  if (y > 640) { footer(); d.addPage(); header(); y = 118; }
  y += 22; const tx = L + W * 0.55;
  const row = (k: string, v: string) => { d.text(k, tx, y, { font: 'serif', size: 11.5, color: MUTED }); d.text(v, colAmt - 12, y, { font: 'sans', size: 10.5, color: INK, align: 'right' }); y += 21; };
  row('Subtotal', inr(invoiceSubtotal(inv)));
  row('Tax (GST)', inr(inv.tax));
  row('Discount', `- ${inr(inv.discount)}`);
  y -= 6; d.rect(tx - 10, y, colAmt - tx + 10, 36, INK);
  d.text('TOTAL DUE', tx + 4, y + 23, { font: 'sansBold', size: 9.5, color: WHITE, spacing: 1 });
  d.text(status === 'Paid' ? `${inr(invoiceTotal(inv))}  PAID` : inr(invoiceTotal(inv)), colAmt - 12, y + 23, { font: 'serifBold', size: 15, color: WHITE, align: 'right' });
  y += 36 + 28;

  if (inv.notes?.trim()) {
    const lines = d.wrap(inv.notes, 'serifItalic', 11, W * 0.55);
    if (y + 30 + lines.length * 15 > 780) { footer(); d.addPage(); header(); y = 118; }
    d.text('NOTES', L, y, { font: 'sansBold', size: 8.5, color: MUTED, spacing: 1 });
    lines.forEach((t, k) => d.text(t, L, y + 18 + k * 15, { font: 'serifItalic', size: 11, color: INK }));
  }
  footer();
  return d.build({ title: `Invoice ${inv.number}` });
}

export function downloadInvoicePdf(inv: Invoice) {
  downloadPdf(buildInvoicePdf(inv), `${inv.number.replace(/[^\w.-]+/g, '_')}.pdf`);
}
