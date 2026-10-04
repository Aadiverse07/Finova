import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v: string) => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'invalid ISO date');

export const entityKindSchema = z.enum(['expense', 'invoice', 'transaction', 'account', 'customer']);
export const statusSchema = z.enum(['Paid', 'Pending', 'Draft', 'Overdue']);
export const sourceSchema = z.enum(['MANUAL', 'INVOICE', 'PAYMENT', 'EXPENSE', 'OPENING']);
export const querySpecSchema = z.object({
  entities: z.array(entityKindSchema).min(1).max(5),
  filters: z.object({
    text: z.string().max(120).optional(), category: z.array(z.string().max(80)).max(20).optional(), vendor: z.array(z.string().max(80)).max(20).optional(),
    customer: z.array(z.string().max(120)).max(20).optional(), account: z.array(z.string().max(120)).max(20).optional(),
    status: z.array(statusSchema).max(4).optional(), paymentMethod: z.array(z.string().max(80)).max(20).optional(), source: z.array(sourceSchema).max(5).optional(),
    amount: z.object({ min: z.number().finite().nonnegative().max(1e9).optional(), max: z.number().finite().nonnegative().max(1e9).optional() }).strict().refine((v: { min?: number; max?: number }) => v.min === undefined || v.max === undefined || v.min <= v.max, 'amount range must be ordered').optional(),
    dateRange: z.object({ from: isoDate, to: isoDate, label: z.string().max(120), field: z.enum(['date', 'dueDate', 'paidOn']).optional() }).strict().refine((v: { from: string; to: string }) => v.from <= v.to, 'date range must be ordered').optional(),
  }).strict(),
  sort: z.object({ field: z.enum(['date', 'amount', 'dueDate']), dir: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().min(1).max(100).optional(), aggregate: z.enum(['sum', 'count', 'avg', 'max', 'min']).optional(),
  confidence: z.number().min(0).max(1), unresolved: z.array(z.string().max(80)).max(20), interpretation: z.string().max(300), source: z.enum(['rules', 'llm']),
}).strict();
export type QuerySpec = z.infer<typeof querySpecSchema>;
export type EntityKind = z.infer<typeof entityKindSchema>;
export type InterpretationChip = { id: string; label: string; kind: 'entity' | 'filter' | 'period' | 'amount' | 'status'; value?: string };
export type NlqRecord = { entity: EntityKind; id: string; title: string; subtitle: string; date?: string; dueDate?: string; amount?: number; status?: string; href: string; reason?: string };
export type NlqGroup = { entity: EntityKind; count: number; total?: number; records: NlqRecord[] };
export type NlqResponse = { spec: QuerySpec; chips: InterpretationChip[]; groups: NlqGroup[]; unresolved: string[]; alternatives: string[]; message: string; zeroSuggestions?: { label: string; count: number; spec: QuerySpec }[] };
