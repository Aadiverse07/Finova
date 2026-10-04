import type { Account, AccountType, Expense, Invoice, JournalEntry } from './types';
import { expensePostings, invoicePostings } from './posting';

/**
 * Demo data. This file is the ONLY place mock data lives. To go live, implement the same shape
 * in `source.ts` against /api/accounts, /api/journal, ... and stop importing this file.
 */
const acct = (code: string, name: string, type: AccountType, description: string): Account => ({
  id: code, code, name, type, description, isActive: true,
  normalBalance: type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT',
});

export const seedAccounts: Account[] = [
  acct('1001', 'HDFC Bank', 'ASSET', 'Primary current account'),
  acct('1002', 'Cash in Hand', 'ASSET', 'Petty cash'),
  acct('1100', 'Accounts Receivable', 'ASSET', 'Amounts owed by customers'),
  acct('2001', 'Accounts Payable', 'LIABILITY', 'Amounts owed to vendors'),
  acct('2100', 'GST Payable', 'LIABILITY', 'Output GST collected on invoices'),
  acct('3001', "Owner's Capital", 'EQUITY', 'Capital contributed by owners'),
  acct('4001', 'Sales Revenue', 'INCOME', 'Revenue from customer invoices'),
  acct('5001', 'Office Supplies', 'EXPENSE', 'Stationery and consumables'),
  acct('5100', 'Rent Expense', 'EXPENSE', 'Office rent'),
  acct('5200', 'Software & Subscriptions', 'EXPENSE', 'SaaS and licences'),
  acct('5300', 'Travel Expense', 'EXPENSE', 'Local and outstation travel'),
  acct('5400', 'Utilities', 'EXPENSE', 'Internet, power, water'),
  acct('5500', 'Marketing', 'EXPENSE', 'Advertising and promotion'),
];

export const seedInvoices: Invoice[] = [
  { id: 'inv-1', number: 'INV-2026-014', customer: 'Apex Industries', date: '2026-09-28', dueDate: '2026-10-12', lines: [{ id: '1', description: 'Annual software subscription', quantity: '1', unitPrice: '85000' }], tax: 15300, discount: 2500, status: 'Pending', notes: 'Payment via bank transfer.' },
  { id: 'inv-2', number: 'INV-2026-013', customer: 'BlueSky Retail', date: '2026-09-20', dueDate: '2026-09-30', lines: [{ id: '2', description: 'Consulting services', quantity: '10', unitPrice: '4500' }], tax: 8100, discount: 0, status: 'Pending', notes: 'Follow-up required.' },
  { id: 'inv-3', number: 'INV-2026-012', customer: 'Nova Technologies', date: '2026-09-15', dueDate: '2026-09-25', lines: [{ id: '3', description: 'Implementation support', quantity: '5', unitPrice: '12000' }], tax: 10800, discount: 3000, status: 'Paid', paidOn: '2026-09-24', notes: 'Paid by NEFT.' },
  { id: 'inv-4', number: 'INV-2026-015', customer: 'GreenLeaf Foods', date: '2026-10-01', dueDate: '2026-10-15', lines: [{ id: '4', description: 'Inventory audit', quantity: '1', unitPrice: '32000' }], tax: 5760, discount: 0, status: 'Draft', notes: 'Awaiting approval.' },
];

export const seedExpenses: Expense[] = [
  { id: 'EXP-2026-021', date: '2026-09-30', category: 'Office Supplies', vendor: 'Amazon Business', description: 'Printer cartridges and stationery', amount: 4850, paymentMethod: 'Company Card', status: 'Paid', notes: 'Monthly office replenishment.' },
  { id: 'EXP-2026-020', date: '2026-09-28', category: 'Software', vendor: 'Adobe', description: 'Creative Cloud annual plan', amount: 18600, paymentMethod: 'Bank Transfer', status: 'Paid', notes: 'Annual subscription.' },
  { id: 'EXP-2026-019', date: '2026-09-26', category: 'Travel', vendor: 'Uber', description: 'Client meeting travel', amount: 1240, paymentMethod: 'UPI', status: 'Paid', notes: 'Apex Industries meeting.' },
  { id: 'EXP-2026-018', date: '2026-09-25', category: 'Utilities', vendor: 'Airtel Business', description: 'Business internet bill', amount: 2499, paymentMethod: 'Auto Debit', status: 'Pending', notes: 'Awaiting bank settlement.' },
  { id: 'EXP-2026-017', date: '2026-09-10', category: 'Software', vendor: 'Zoho', description: 'Business software subscription', amount: 4500, paymentMethod: 'Bank Transfer', status: 'Paid', notes: 'Recurring monthly subscription.' },
  { id: 'EXP-2026-016', date: '2026-08-10', category: 'Software', vendor: 'Zoho', description: 'Business software subscription', amount: 4500, paymentMethod: 'Bank Transfer', status: 'Paid', notes: 'Recurring monthly subscription.' },
  { id: 'EXP-2026-015', date: '2026-07-10', category: 'Software', vendor: 'Zoho', description: 'Business software subscription', amount: 4500, paymentMethod: 'Bank Transfer', status: 'Paid', notes: 'Recurring monthly subscription.' },
  { id: 'EXP-2026-014', date: '2026-09-02', category: 'Utilities', vendor: 'Airtel Business', description: 'Business internet bill', amount: 2499, paymentMethod: 'Auto Debit', status: 'Paid', notes: 'Recurring monthly subscription.' },
  { id: 'EXP-2026-013', date: '2026-08-02', category: 'Utilities', vendor: 'Airtel Business', description: 'Business internet bill', amount: 2499, paymentMethod: 'Auto Debit', status: 'Paid', notes: 'Recurring monthly subscription.' },
  { id: 'EXP-2026-012', date: '2026-07-02', category: 'Utilities', vendor: 'Airtel Business', description: 'Business internet bill', amount: 2499, paymentMethod: 'Auto Debit', status: 'Paid', notes: 'Recurring monthly subscription.' },
];

const manual: JournalEntry[] = [
  { id: 'JE-1001', date: '2026-09-25', reference: 'OPEN-001', description: 'Opening capital balance', status: 'Posted', source: 'OPENING',
    lines: [{ id: 'l1', accountId: '1001', debit: 125000, credit: 0 }, { id: 'l2', accountId: '2001', debit: 0, credit: 25000 }, { id: 'l3', accountId: '3001', debit: 0, credit: 100000 }] },
  { id: 'JE-1002', date: '2026-09-27', reference: 'EXP-002', description: 'Office supplies purchase', status: 'Posted', source: 'MANUAL',
    lines: [{ id: 'l1', accountId: '5001', debit: 2850, credit: 0 }, { id: 'l2', accountId: '1002', debit: 0, credit: 2850 }] },
  { id: 'JE-1003', date: '2026-09-29', reference: 'REC-003', description: 'Customer receipt', status: 'Posted', source: 'MANUAL',
    lines: [{ id: 'l1', accountId: '1001', debit: 45000, credit: 0 }, { id: 'l2', accountId: '4001', debit: 0, credit: 45000 }] },
  { id: 'JE-1004', date: '2026-09-30', reference: 'ADJ-004', description: 'Office rent adjustment', status: 'Posted', source: 'MANUAL',
    lines: [{ id: 'l1', accountId: '5100', debit: 25000, credit: 0 }, { id: 'l2', accountId: '1001', debit: 0, credit: 25000 }] },
];

const derived = [...seedInvoices.flatMap(invoicePostings), ...seedExpenses.flatMap(expensePostings)];
export const seedEntries: JournalEntry[] = [...manual, ...derived.map((d, i) => ({ ...d, id: `JE-${1005 + i}` }))];
