import { z } from 'zod';
export const accountType=z.enum(['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE']);
export const accountSchema=z.object({code:z.string().min(1),name:z.string().min(1),type:accountType,normalBalance:z.enum(['DEBIT','CREDIT']),isActive:z.boolean().default(true),isSystem:z.boolean().default(false)});
export const accountPatchSchema=z.object({name:z.string().min(1).optional(),isActive:z.boolean().optional()}).strict();
