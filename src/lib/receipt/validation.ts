import { extractionSchema, type ReceiptExtraction } from './types';
import { isValidGSTIN } from './gstin';
export function validateExtraction(input: ReceiptExtraction, now = new Date(), maxAgeDays = 3650): ReceiptExtraction {
  const parsed = extractionSchema.parse(input); const errors = [...parsed.validationErrors]; const date = new Date(`${parsed.date.value}T00:00:00+05:30`); const age = (now.getTime() - date.getTime()) / 86400000;
  if (Number.isNaN(date.getTime())) errors.push('Date is invalid.'); else if (date.getTime() > now.getTime() + 86400000) errors.push('Date appears to be in the future.'); else if (age > maxAgeDays) errors.push('Receipt date is older than the configured limit.');
  if (parsed.gstin.value && !isValidGSTIN(parsed.gstin.value)) errors.push('GSTIN failed format/checksum validation.');
  const subtotal = parsed.subtotalPaise.value ? BigInt(parsed.subtotalPaise.value) : null; const tax = BigInt(parsed.totalTaxPaise); const discount = parsed.discountPaise.value ? BigInt(parsed.discountPaise.value) : 0n; const round = parsed.roundOffPaise.value ? BigInt(parsed.roundOffPaise.value) : 0n; const tip = parsed.tipPaise.value ? BigInt(parsed.tipPaise.value) : 0n; const total = BigInt(parsed.totalPaise.value);
  if (subtotal !== null) {
    const diff = subtotal + tax - discount + round + tip - total; const gap = diff < 0n ? -diff : diff;
    const taxIncluded = subtotal === total && tax > 0n; // total already includes the printed tax
    if (gap > 99n && !taxIncluded) errors.push('Arithmetic mismatch: subtotal + tax - discount + round-off + tip does not equal total.');
  }
  return { ...parsed, validationErrors: [...new Set(errors)] };
}
