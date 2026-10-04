export type CustomerStatus = 'Active' | 'Overdue' | 'Inactive' | 'Blocked';
export type CustomerType = 'business' | 'individual';
export type GstTreatment = 'registered' | 'unregistered' | 'SEZ' | 'export' | 'composition';
export type PaymentMethod = 'Bank Transfer' | 'UPI' | 'Card' | 'Cash' | 'Cheque' | 'Other';
export type InvoiceCustomerStatus = 'Draft' | 'Sent' | 'Viewed' | 'Partially paid' | 'Paid' | 'Overdue' | 'Void';

export type CustomerContact = { id: string; name: string; role: string; email: string; phone: string; isPrimary: boolean };
export type CustomerAddress = { id: string; kind: 'billing' | 'shipping'; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string; gstPlaceOfSupply: string };
export type CustomerTag = string;

export type Customer = {
  id: string;
  displayName: string;
  legalName: string;
  type: CustomerType;
  phone: string;
  email: string;
  gstin?: string;
  pan?: string;
  gstTreatment: GstTreatment;
  tdsApplicable: boolean;
  tdsRate: number;
  contacts: CustomerContact[];
  addresses: CustomerAddress[];
  paymentTerms: 0 | 15 | 30 | 45 | 60;
  currency: string;
  defaultTaxRate: number;
  creditLimitPaise: bigint;
  openingBalancePaise: bigint;
  preferredPaymentMethod: PaymentMethod;
  discountTerms: string;
  tags: CustomerTag[];
  category: string;
  assignedTo?: string;
  source: string;
  customFields: Record<string, string>;
  status: CustomerStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPayment = {
  id: string;
  customerId: string;
  date: string;
  amountPaise: bigint;
  method: PaymentMethod;
  reference: string;
  allocated: { invoiceId: string; amountPaise: bigint }[];
  tdsPaise: bigint;
  reversed: boolean;
  note?: string;
};

export type CreditNote = { id: string; customerId: string; date: string; number: string; amountPaise: bigint; reason: string; appliedInvoiceId?: string; status: 'Open' | 'Applied' | 'Void' };
export type CustomerNote = { id: string; customerId: string; date: string; kind: 'Note' | 'Reminder' | 'Email' | 'Call' | 'Status'; text: string };
export type CustomerDocument = { id: string; customerId: string; name: string; kind: 'Contract' | 'Purchase Order' | 'Attachment'; url?: string; createdAt: string };

export type CustomerActivity = CustomerNote & { kind: CustomerNote['kind'] };
export type CustomerPaymentScore = { label: 'Excellent' | 'Good' | 'Slow' | 'Risky'; averageDaysToPay: number; lateShare: number; trend: 'Improving' | 'Stable' | 'Worsening' };

export type CustomerMetrics = {
  totalInvoicedPaise: bigint;
  paidPaise: bigint;
  outstandingPaise: bigint;
  overduePaise: bigint;
  creditNotesPaise: bigint;
  advanceCreditPaise: bigint;
  tdsPaise: bigint;
  averageInvoicePaise: bigint;
  lifetimeRevenuePaise: bigint;
  estimatedProfitPaise?: bigint;
  paymentScore: CustomerPaymentScore;
};

export type AgingBucket = { currentPaise: bigint; d1_30Paise: bigint; d31_60Paise: bigint; d61_90Paise: bigint; d90PlusPaise: bigint };
export type CustomerLedgerRow = { id: string; date: string; type: 'Invoice' | 'Payment' | 'Credit note' | 'Adjustment'; reference: string; description: string; debitPaise: bigint; creditPaise: bigint; balancePaise: bigint };

export type CustomerDraft = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
