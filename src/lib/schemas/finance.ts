import { z } from 'zod';

export const invoiceLineSchema = z.object({
  description: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

export const invoiceSchema = z.object({
  number: z.string().min(1),
  customerName: z.string().min(1),
  issueDate: z.string(),
  dueDate: z.string(),
  lines: z.array(invoiceLineSchema).min(1),
  tax: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  date: z.string(),
  category: z.string().min(1),
  vendor: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  notes: z.string().optional(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
