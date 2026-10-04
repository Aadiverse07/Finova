import { describe, expect, it } from 'vitest';
import { extractReceiptFromText } from '@/lib/receipt/extractor';
import { validateExtraction } from '@/lib/receipt/validation';
import { pdfItemsToText, type PdfTextItem } from '@/lib/receipt/ocr';
import { collapseSpacedLetters } from '@/lib/receipt/engine/text';
import { repairGSTIN } from '@/lib/receipt/engine/gstin';

const run = (text: string, history: Record<string, string> = {}) => validateExtraction(extractReceiptFromText(text, history), new Date('2026-10-03T12:00:00+05:30'));

// The exact flat, letter-spaced text that the PDF reader produced for INV-2026-013 (the reported bug).
const FLAT_INVOICE = 'Finova  Accounting workspace  I N V O I C E  INV-2026-013  B I L L E D T O  BlueSky Retail  Invoice date  20 Sept 2026  Due date  30 Sept 2026  Status  Overdue  D E S C R I P T I O N  Q T Y  U N I T P R I C E  A M O U N T  Consulting services  10  Rs. 4,500.00  Rs. 45,000.00  Subtotal  Rs. 45,000.00  Tax (GST)  Rs. 8,100.00  Discount  – Rs. 0.00  T O T A L D U E  Rs. 53,100.00  N O T E S  Follow-up required. Thank you for your business.  INV-2026-013 |';

describe('receipt engine: reported INV-2026-013 regression', () => {
  const e = run(FLAT_INVOICE);
  it('picks the issuer as vendor, not the billed-to party', () => { expect(e.vendor.value).toBe('Finova'); expect(e.vendor.confidence).toBeGreaterThan(0.7); expect(e.vendor.value).not.toContain('BlueSky'); });
  it('uses the invoice date, not the due date', () => expect(e.date.value).toBe('2026-09-20'));
  it('finds the real total (not "1")', () => expect(e.totalPaise.value).toBe('5310000'));
  it('reads subtotal, tax and discount and reconciles the arithmetic', () => { expect(e.subtotalPaise.value).toBe('4500000'); expect(e.totalTaxPaise).toBe('810000'); expect(e.discountPaise.value).toBe('0'); expect(e.validationErrors).toEqual([]); });
  it('finds the invoice number and the line item', () => { expect(e.invoiceNumber.value).toBe('INV-2026-013'); expect(e.lineItems).toHaveLength(1); expect(e.lineItems[0]?.quantity).toBe(10); expect(e.lineItems[0]?.amountPaise).toBe('4500000'); });
  it('does not claim a GSTIN problem it cannot support', () => { expect(e.gstin.value).toBeNull(); expect(e.warnings.join(' ')).not.toContain('could not be validated'); });
  it('marks an unpaid invoice payment as Unknown but not as a hard failure', () => { expect(e.paymentMethod.value).toBe('Unknown'); expect(e.paymentMethod.confidence).toBeGreaterThanOrEqual(0.6); });
});

describe('receipt engine: PDF line reconstruction', () => {
  const F = (str: string, x: number, y: number): PdfTextItem => ({ str, transform: [1, 0, 0, 10, x, y], width: str.length * 5.5, height: 10 });
  it('rebuilds rows from coordinates regardless of item order', () => {
    const items = [F('TOTAL DUE', 340, 540), F('Rs. 53,100.00', 460, 540), F('Subtotal', 340, 600), F('Rs. 45,000.00', 460, 600)];
    expect(pdfItemsToText(items.reverse()).split('\n')).toEqual(['Subtotal  Rs. 45,000.00', 'TOTAL DUE  Rs. 53,100.00']);
  });
});

describe('receipt engine: text cleanup', () => {
  it('collapses letter-spaced headings and restores word gaps', () => { expect(collapseSpacedLetters('I N V O I C E')).toBe('INVOICE'); expect(collapseSpacedLetters('B I L L E D T O')).toBe('BILLED TO'); expect(collapseSpacedLetters('T O T A L D U E')).toBe('TOTAL DUE'); });
  it('repairs OCR look-alikes in a GSTIN and re-verifies the checksum', () => { expect(repairGSTIN('27AAPFUO939F1ZV')?.value).toBe('27AAPFU0939F1ZV'); expect(repairGSTIN('27AAPFU0939F1ZX')).toBeNull(); });
});

describe('receipt engine: decisions on other layouts', () => {
  it('GST retail receipt with CGST/SGST, items and negative round-off', () => {
    const e = run('ABC Supplies Pvt Ltd\n12 MG Road, Indore 452001\nGSTIN: 27AAPFU0939F1ZV\nPh: 9876543210\nInvoice No: ABC/2026/0456\nDate: 28/09/2026\nItem Qty Rate Amount\nPrinter Paper A4 5 400.00 2,000.00\nStapler 2 150.00 300.00\nSubtotal 2,300.00\nCGST @9% 207.00\nSGST @9% 207.00\nRound off -0.40\nTOTAL 2,713.60\nPaid by UPI');
    expect(e.vendor.value).toBe('ABC Supplies Pvt Ltd'); expect(e.totalPaise.value).toBe('271360'); expect(e.roundOffPaise.value).toBe('-40'); expect(e.gstin.value).toBe('27AAPFU0939F1ZV');
    expect(e.invoiceNumber.value).toBe('ABC/2026/0456'); expect(e.paymentMethod.value).toBe('UPI'); expect(e.lineItems).toHaveLength(2); expect(e.validationErrors).toEqual([]);
  });
  it('attributes the supplier GSTIN, not the buyer GSTIN, and never uses the due date', () => {
    const e = run('TAX INVOICE\nBill To: Zenith Traders\nGSTIN: 29AABCZ1234B1Z5\nSold By: Metro Stationers\nGSTIN: 27AAPFU0939F1ZV\nInvoice Date: 03-10-2026\nDue Date: 18-10-2026\nTaxable Value 10,000.00\nIGST 18% 1,800.00\nGrand Total 11,800.00');
    expect(e.vendor.value).toBe('Metro Stationers'); expect(e.gstin.value).toBe('27AAPFU0939F1ZV'); expect(e.date.value).toBe('2026-10-03'); expect(e.totalPaise.value).toBe('1180000');
  });
  it('repairs a garbled GSTIN and O/0 confusion inside amounts', () => {
    const e = run('Sharma Electronics\nGSTIN 27AAPFUO939F1ZV\nDate 02/10/26\nSubtotal Rs 1,OOO.00\nGST 18% 180.00\nTotal Rs 1,180.00\nCash');
    expect(e.gstin.value).toBe('27AAPFU0939F1ZV'); expect(e.totalPaise.value).toBe('118000'); expect(e.paymentMethod.value).toBe('Cash'); expect(e.validationErrors).toEqual([]);
  });
  it('restaurant bill: service charge is separated and totals reconcile', () => {
    const e = run('The Spice Kitchen\nTable 12  Server: Ravi\nDate: 02/10/2026 21:14\nSub Total 560.00\nService Charge 10% 56.00\nCGST 2.5% 14.00\nSGST 2.5% 14.00\nTotal 644.00\nPaid by Card XXXX 4421');
    expect(e.documentType).toBe('restaurant_bill'); expect(e.tipPaise.value).toBe('5600'); expect(e.totalPaise.value).toBe('64400'); expect(e.paymentMethod.value).toBe('Card'); expect(e.cardLast4.value).toBe('4421'); expect(e.validationErrors).toEqual([]);
  });
  it('UPI screenshot: payee is the vendor and the transaction id is not an invoice number', () => {
    const e = run('Payment Successful\nPaid to Rahul Sharma\nAmount ₹ 1,250\nDate 1 Oct 2026, 10:42 AM\nUPI Transaction ID: 427351982364\nPaid via Google Pay');
    expect(e.vendor.value).toBe('Rahul Sharma'); expect(e.totalPaise.value).toBe('125000'); expect(e.invoiceNumber.value).toBeNull(); expect(e.upiReference.value).toBe('427351982364'); expect(e.paymentMethod.value).toBe('UPI');
  });
  it('tax-inclusive receipt is not flagged as an arithmetic mismatch', () => {
    const e = run('DMart Avenue Supermarts Ltd\nBill Date 01/10/2026\nMilk 2 30.00 60.00\nBread 1 45.00 45.00\nTotal (incl. of all taxes) 105.00\nGST included 5.00');
    expect(e.totalPaise.value).toBe('10500'); expect(e.validationErrors).toEqual([]);
  });
  it('fuel slip: a rate line is not a line item and no false mismatch is raised', () => {
    const e = run('INDIAN OIL - HP PETROL PUMP\nDate: 30/09/2026\nPetrol 20.5 ltr\nRate 102.50\nTotal Rs 2,101.25\nCash');
    expect(e.totalPaise.value).toBe('210125'); expect(e.documentType).toBe('fuel_slip'); expect(e.category.value).toBe('Travel'); expect(e.validationErrors).toEqual([]);
  });
  it('still flags a genuine arithmetic mismatch', () => {
    const e = run('Store\n28/09/2026\nSubtotal 1000\nCGST 90\nSGST 90\nTOTAL 999');
    expect(e.validationErrors.some((x) => x.includes('Arithmetic mismatch'))).toBe(true);
  });
  it('admits it does not know the vendor instead of guessing a title or label', () => {
    const e = run('Invoice\nDate 01/10/2026\nTotal 500');
    expect(e.vendor.value).toBe('Unknown vendor'); expect(e.vendor.confidence).toBeLessThan(0.4);
  });
  it('reuses a previously confirmed category for a known vendor', () => {
    const e = run('Metro Stationers\nDate 01/10/2026\nTotal 500.00', { 'metro stationers': 'Office Supplies' });
    expect(e.category.confidence).toBeGreaterThan(0.9);
  });
});
