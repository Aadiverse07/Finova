import { describe, expect, it } from 'vitest';
import { parseIndianAmountToPaise } from '@/lib/receipt/money';
import { isValidGSTIN } from '@/lib/receipt/gstin';
import { extractReceiptFromText } from '@/lib/receipt/extractor';
import { validateExtraction } from '@/lib/receipt/validation';
import { extractPdfTextFromPages } from '@/lib/receipt/ocr';
describe('receipt scanner',()=>{
 it('parses Indian money into integer paise',()=>expect(parseIndianAmountToPaise('₹4,850.50')).toBe(485050n));
 it('rejects invalid GSTIN checksum',()=>{expect(isValidGSTIN('27AAPFU0939F1ZX')).toBe(false);expect(isValidGSTIN('27AAPFU0939F1ZV')).toBe(true)});
 it('extracts core fields from common receipt text',()=>{const e=extractReceiptFromText('ABC Supplies\nGSTIN: 27AAPFU0939F1ZV\nDate: 28/09/2026\nSubtotal 4,000\nCGST 360\nSGST 360\nTOTAL 4,720\nPaid by UPI');expect(e.vendor.value).toContain('ABC Supplies');expect(e.date.value).toBe('2026-09-28');expect(e.totalPaise.value).toBe('472000');expect(e.paymentMethod.value).toBe('UPI');});
 it('adds arithmetic validation errors rather than silently accepting a mismatch',()=>{const e=extractReceiptFromText('Store\n28/09/2026\nSubtotal 1000\nCGST 90\nSGST 90\nTOTAL 999');const v=validateExtraction(e,new Date('2026-10-01T00:00:00+05:30'));expect(v.validationErrors.some(x=>x.includes('Arithmetic mismatch'))).toBe(true);});
 it('joins real PDF page text without the previous latin-1 regex hack',()=>expect(extractPdfTextFromPages([{text:'Page one'},{text:'  '},{text:'Page two'}])).toBe('Page one\nPage two'));
});
