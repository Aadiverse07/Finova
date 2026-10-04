import { z } from 'zod';

export const accountType = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
export const balanceSide = z.enum(['DEBIT', 'CREDIT']);

export const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: accountType,
  normalBalance: balanceSide,
  isActive: z.boolean().default(true),
  isSystem: z.boolean().default(false),
});

/** Request body for POST /api/accounts. `isSystem` is server-controlled, never client-settable. */
export const accountCreateSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(120),
    type: accountType,
    normalBalance: balanceSide,
    isActive: z.boolean().default(true),
  })
  .strict();

export const accountPatchSchema = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).strict();

/** Query string for GET /api/accounts (pagination params are parsed separately). */
export const accountListQuerySchema = z.object({
  type: accountType.optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountListQuery = z.infer<typeof accountListQuerySchema>;
