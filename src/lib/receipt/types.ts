import { z } from 'zod';

export const confidenceSchema = z.number().min(0).max(1);
export const bboxSchema = z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().min(0), height: z.number().min(0) });
export const fieldSchema = <T extends z.ZodTypeAny>(value: T) => z.object({ value, confidence: confidenceSchema, bbox: bboxSchema.nullable().default(null), sourceText: z.string().optional() });
export const lineItemSchema = z.object({ description: z.string(), quantity: z.number().nonnegative().nullable(), ratePaise: z.string().regex(/^\d+$/).nullable(), amountPaise: z.string().regex(/^\d+$/), confidence: confidenceSchema, bbox: bboxSchema.nullable().default(null) });
export const taxLineSchema = z.object({ type: z.enum(['CGST','SGST','IGST','CESS','OTHER']), rate: z.number().nullable(), amountPaise: z.string().regex(/^\d+$/), confidence: confidenceSchema, bbox: bboxSchema.nullable().default(null) });
export const extractionSchema = z.object({
  vendor: fieldSchema(z.string()), date: fieldSchema(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), totalPaise: fieldSchema(z.string().regex(/^\d+$/)), currency: fieldSchema(z.string()), category: fieldSchema(z.string()),
  paymentMethod: fieldSchema(z.enum(['Card','UPI','Cash','Bank Transfer','Wallet','Other','Unknown'])), subtotalPaise: fieldSchema(z.string().regex(/^\d+$/).nullable()), taxLines: z.array(taxLineSchema), totalTaxPaise: z.string().regex(/^\d+$/), discountPaise: fieldSchema(z.string().regex(/^\d+$/).nullable()), tipPaise: fieldSchema(z.string().regex(/^\d+$/).nullable()), roundOffPaise: fieldSchema(z.string().regex(/^-?\d+$/).nullable()),
  gstin: fieldSchema(z.string().nullable()), invoiceNumber: fieldSchema(z.string().nullable()), cardLast4: fieldSchema(z.string().regex(/^\d{4}$/).nullable()), upiReference: fieldSchema(z.string().nullable()), vendorAddress: fieldSchema(z.string().nullable()), vendorPhone: fieldSchema(z.string().nullable()), lineItems: z.array(lineItemSchema),
  documentType: z.enum(['retail_receipt','restaurant_bill','fuel_slip','gst_invoice','utility_bill','travel_ticket','handwritten_bill','upi_screenshot','bank_statement','unknown']), warnings: z.array(z.string()), validationErrors: z.array(z.string()),
});
export type ReceiptExtraction = z.infer<typeof extractionSchema>;
export type ReceiptScanStatus = 'uploading' | 'reading' | 'extracting' | 'ready' | 'failed';
export type ReceiptScan = { id: string; status: ReceiptScanStatus; fileName: string; mimeType: string; sizeBytes: number; imageDataUrl?: string; imageWidth?: number; imageHeight?: number; imageHash: string; createdAt: string; updatedAt: string; extraction: ReceiptExtraction | null; ocrText: string; error?: string; duplicateExpenseId?: string; matchedTransactionId?: string; confirmedExpenseId?: string; editedFields: string[] };
export type ReceiptPreferences = { scanCount: number; monthKey: string; premium: boolean; vendorCategories: Record<string,string> };
export const extractionResponseSchema = z.object({ extraction: extractionSchema, ocrText: z.string(), provider: z.string(), warnings: z.array(z.string()).default([]) });
