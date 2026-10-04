/**
 * Document-understanding engine for receipts / invoices.
 *
 * Instead of "take the first line / the last number", every field is a *decision*:
 *   candidates -> role-aware scoring -> cross-field reconciliation -> calibrated confidence + an explanation.
 *
 *  - Vendor  = the ISSUER of the document (never the "Billed To" party, a title, an address or a tagline).
 *  - Date    = the issue date (never the due date).
 *  - Total   = the amount that makes subtotal + tax - discount (+ tip/round-off) add up.
 *  - GSTIN   = checksum-verified, OCR-repaired, and attributed to the supplier rather than the buyer.
 */
import { decideAmounts, parseItems } from './amounts';
import { pickDate } from './dates';
import { detectDocType, pickAddress, pickCardLast4, pickCurrency, pickInvoiceNumber, pickPayment, pickPhone, pickUpiRef } from './fields';
import { findAllGSTINs } from './gstin';
import { toLines } from './text';
import type { LayoutLine } from './types';
import { pickVendor } from './vendor';

export type Analysis = ReturnType<typeof analyzeDocument>;

export function analyzeDocument(ocrText: string, history: Record<string, string> = {}, _layout: LayoutLine[] = []) {
  const lines = toLines(ocrText);
  const text = lines.map((l) => l.text).join('\n');
  const { valid: gstins, invalidRaw } = findAllGSTINs(lines);
  const supplierGstin = gstins.find((g) => g.role !== 'recipient') ?? null;
  const buyerGstin = gstins.find((g) => g.role === 'recipient') ?? null;

  const vendor = pickVendor(lines, history, supplierGstin?.lineIndex ?? null);
  const vendorLine = vendor.value === 'Unknown vendor' ? -1 : lines.findIndex((l) => l.text.toLowerCase().includes(vendor.value.toLowerCase()));
  const { items } = parseItems(lines, vendorLine);
  const amounts = decideAmounts(lines, items, text);
  const date = pickDate(lines);
  const payment = pickPayment(lines, text);
  const invoice = pickInvoiceNumber(lines);
  const taxMentioned = /\bgst\b|\bcgst\b|\bsgst\b|\bigst\b|tax\s*invoice/i.test(text) || amounts.taxPaise > 0n;
  const docType = detectDocType(text, Boolean(supplierGstin));

  return {
    lines, vendor, vendorLine, items, amounts, date, payment, invoice, docType, taxMentioned,
    supplierGstin, buyerGstin, invalidGstinRaw: invalidRaw,
    currency: pickCurrency(text), upiRef: pickUpiRef(text), cardLast4: pickCardLast4(text), phone: pickPhone(text), address: pickAddress(lines),
  };
}
