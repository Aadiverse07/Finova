export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

/** Mirrors AccountRecord in lib/repo/types.ts (plus a description) so the real API can replace the mock source. */
export type Account = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  description: string;
};

export type JournalSource = 'MANUAL' | 'INVOICE' | 'PAYMENT' | 'EXPENSE' | 'OPENING';
export type JournalLine = { id: string; accountId: string; debit: number; credit: number };
export type JournalEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  reference: string;
  description: string;
  status: 'Posted' | 'Draft';
  source: JournalSource;
  sourceRef?: string;
  lines: JournalLine[];
};
export type JournalDraft = Omit<JournalEntry, 'id'>;

export type InvoiceLine = { id: string; description: string; quantity: string; unitPrice: string };
/** Stored status. "Overdue" is derived from dueDate (see invoiceStatus in calc.ts). */
export type StoredInvoiceStatus = 'Paid' | 'Pending' | 'Draft';
export type InvoiceStatus = StoredInvoiceStatus | 'Overdue';
export type Invoice = {
  id: string;
  number: string;
  customer: string;
  customerId?: string;
  date: string;
  dueDate: string;
  lines: InvoiceLine[];
  tax: number;
  discount: number;
  status: StoredInvoiceStatus;
  notes: string;
  paidOn?: string;
};

export type ExpenseStatus = 'Paid' | 'Pending';
export type Expense = {
  id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: ExpenseStatus;
  notes: string;
};
