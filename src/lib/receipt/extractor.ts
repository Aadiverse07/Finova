import { suggestCategory } from './category';
import { analyzeDocument } from './engine';
import { fmt } from './engine/money';
import { extractionSchema, type ReceiptExtraction } from './types';

type Layout = Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }>;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, '');
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function field<T>(value: T, confidence: number, sourceText?: string) {
  return { value, confidence: clamp(confidence), bbox: null, ...(sourceText ? { sourceText } : {}) };
}

/**
 * Public entry point (signature unchanged). All decisions are made by the engine in ./engine;
 * this function only maps the engine's analysis onto the strict ReceiptExtraction schema.
 */
export function extractReceiptFromText(ocrText: string, history: Record<string, string> = {}, layoutLines: Layout = []): ReceiptExtraction {
  const a = analyzeDocument(ocrText, history);
  const bboxFor = (needle: string) => { const n = squash(needle); return n.length < 3 ? null : (layoutLines.find((l) => squash(l.text).includes(n))?.bbox ?? null); };
  const withBox = <T extends { bbox: unknown }>(f: T, needle: string): T => ({ ...f, bbox: bboxFor(needle) });
  const { amounts: m } = a;
  const warnings: string[] = [];

  const vendorUnknown = a.vendor.value === 'Unknown vendor';
  if (vendorUnknown) warnings.push('Vendor name could not be confidently identified.');
  else if (a.vendor.confidence < 0.6) warnings.push(`Vendor looks like "${a.vendor.value}" but this is a best guess; please confirm.`);
  if (m.totalPaise === 0n) warnings.push('Total amount could not be confidently identified.');

  if (a.invalidGstinRaw.length && !a.supplierGstin) warnings.push(`A GSTIN was printed (${a.invalidGstinRaw[0]}) but failed checksum validation; compare it with the original.`);
  else if (!a.supplierGstin && a.taxMentioned) warnings.push('No supplier GSTIN was found on this document, so input tax credit (ITC) cannot be claimed until one is added.');
  if (a.buyerGstin && !a.supplierGstin) warnings.push('Only the buyer’s GSTIN was found; the supplier’s GSTIN is missing.');
  if (!a.date) warnings.push('No date was found on the document; today’s date was used. Please set the correct date.');

  const dateValue = a.date?.iso ?? new Date().toISOString().slice(0, 10);
  const cat = suggestCategory(a.vendor.value, [...a.items.map((i) => i.description), a.vendor.value], history);

  const vendorNote = [a.vendor.reason, a.vendor.customer ? `billed to ${a.vendor.customer}` : '', a.vendor.runnerUp ? `runner-up: ${a.vendor.runnerUp}` : ''].filter(Boolean).join(' · ');
  const totalNote = m.notes.join(' ');
  const gstinConf = a.supplierGstin ? (a.supplierGstin.repaired ? 0.9 : 0.97) : a.taxMentioned ? 0.2 : 0.35;

  return extractionSchema.parse({
    vendor: withBox(field(a.vendor.value, a.vendor.confidence, vendorNote), a.vendor.value),
    date: withBox(field(dateValue, a.date ? a.date.confidence : 0.2, a.date ? `Chosen from ${a.date.reason}${a.date.ambiguous ? ' (day-first order assumed)' : ''}` : 'not found'), dateValue),
    totalPaise: withBox(field(m.totalPaise.toString(), m.confidence.total, totalNote), m.totalLine !== null ? (a.lines[m.totalLine]?.text ?? '') : fmt(m.totalPaise)),
    currency: field(a.currency, 0.96),
    category: field(cat.value, cat.confidence, cat.reason),
    paymentMethod: withBox(field(a.payment.value, a.payment.confidence, a.payment.reason), a.payment.value),
    subtotalPaise: field(m.subtotalPaise === null ? null : m.subtotalPaise.toString(), m.subtotalPaise === null ? 0.2 : m.confidence.subtotal),
    taxLines: m.taxLines.map((t) => ({ type: t.type, rate: t.rate, amountPaise: t.amountPaise.toString(), confidence: m.confidence.tax, bbox: null })),
    totalTaxPaise: m.taxPaise.toString(),
    discountPaise: field(m.discountPaise === null ? null : (m.discountPaise < 0n ? -m.discountPaise : m.discountPaise).toString(), m.confidence.discount),
    tipPaise: field(m.tipPaise === null ? null : (m.tipPaise < 0n ? -m.tipPaise : m.tipPaise).toString(), m.confidence.tip),
    roundOffPaise: field(m.roundOffPaise === null ? null : m.roundOffPaise.toString(), m.confidence.roundOff),
    gstin: field(a.supplierGstin?.value ?? null, gstinConf, a.supplierGstin?.repaired ? `OCR-repaired from ${a.supplierGstin.raw}` : undefined),
    invoiceNumber: field(a.invoice?.value ?? null, a.invoice?.confidence ?? 0.2),
    cardLast4: field(a.cardLast4, a.cardLast4 ? 0.85 : 0.3),
    upiReference: field(a.upiRef, a.upiRef ? 0.85 : 0.3),
    vendorAddress: field(a.address, a.address ? 0.6 : 0.15),
    vendorPhone: field(a.phone, a.phone ? 0.78 : 0.2),
    lineItems: a.items.map((i) => ({ description: i.description, quantity: i.quantity, ratePaise: i.ratePaise === null ? null : i.ratePaise.toString(), amountPaise: i.amountPaise.toString(), confidence: i.confidence, bbox: null })),
    documentType: a.docType,
    warnings,
    validationErrors: [],
  });
}
