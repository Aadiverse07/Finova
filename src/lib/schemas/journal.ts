import { z } from 'zod';

const paise = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const journalLineSchema = z
  .object({
    accountId: z.string().min(1),
    debit: paise.default(0),
    credit: paise.default(0),
    description: z.string().max(500).optional(),
  })
  .strict();

/** Request body for POST /api/journal. Amounts are integer paise. */
export const journalEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    memo: z.string().trim().min(1).max(500),
    source: z.enum(['MANUAL', 'INVOICE', 'PAYMENT', 'EXPENSE', 'REVERSAL', 'OPENING']).default('MANUAL'),
    sourceRef: z.string().max(100).optional(),
    lines: z.array(journalLineSchema).min(2).max(200),
  })
  .strict();

export type JournalEntryBody = z.infer<typeof journalEntrySchema>;
