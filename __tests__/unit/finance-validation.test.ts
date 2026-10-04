import { describe, expect, it } from 'vitest';
import { expenseSchema, invoiceSchema } from '@/lib/schemas/finance';

describe('finance schemas', () => {
  it('accepts a valid invoice', () => {
    expect(invoiceSchema.safeParse({ number:'INV-1', customerName:'Apex Industries', issueDate:'2026-10-02', dueDate:'2026-10-16', lines:[{description:'Service',qty:1,unitPrice:1000}], tax:180, discount:50 }).success).toBe(true);
  });
  it('rejects an invoice without line items', () => {
    expect(invoiceSchema.safeParse({ number:'INV-1', customerName:'Apex Industries', issueDate:'2026-10-02', dueDate:'2026-10-16', lines:[], tax:0, discount:0 }).success).toBe(false);
  });
  it('accepts a valid expense', () => {
    expect(expenseSchema.safeParse({ date:'2026-10-02', category:'Travel', vendor:'Uber', description:'Client meeting', amount:1200, paymentMethod:'UPI' }).success).toBe(true);
  });
  it('rejects zero or negative expenses', () => {
    expect(expenseSchema.safeParse({ date:'2026-10-02', category:'Travel', vendor:'Uber', description:'Client meeting', amount:0, paymentMethod:'UPI' }).success).toBe(false);
  });
});
