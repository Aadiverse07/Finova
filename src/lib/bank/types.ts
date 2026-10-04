export type BankAccountType = 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'OTHER';
export type BankSource = 'STATEMENT_UPLOAD' | 'ACCOUNT_AGGREGATOR' | 'SANDBOX_AA' | 'PAYMENT_GATEWAY';
export type BankConsentStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'REJECTED';
export type BankDirection = 'DEBIT' | 'CREDIT';
export type BankMode = 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'CARD' | 'CHEQUE' | 'ATM' | 'CASH_DEPOSIT' | 'BANK_TRANSFER' | 'OTHER';
export type ReconciliationStatus = 'UNREVIEWED' | 'CATEGORISED' | 'MATCHED' | 'IGNORED' | 'NEEDS_ATTENTION';

export type BankAccount = { id:string; bankName:string; accountType:BankAccountType; maskedAccountNumber:string; balancePaise:bigint; balanceDate:string; source:BankSource; businessUse:boolean; consentId?:string; lastSyncedAt?:string; syncStatus:'CONNECTED'|'SYNCING'|'ERROR'|'DISCONNECTED'; reconciledUpTo?:string };
export type BankConsent = { id:string; accountIds:string[]; provider:string; status:BankConsentStatus; purpose:string; fiTypes:string[]; startDate:string; endDate:string; createdAt:string; expiresAt:string; revokedAt?:string };
export type RawBankTransaction = { id:string; source:BankSource; sourceTransactionId?:string; accountId:string; date:string; amountPaise:bigint; direction:BankDirection; narration:string; reference?:string; mode:BankMode; runningBalancePaise?:bigint; rawPayload:string; fingerprint:string; importedAt:string };
export type BankTransaction = RawBankTransaction & { merchant:string; category?:string; confidence:number; suggestionReason:string; customerId?:string; expenseId?:string; invoiceIds:string[]; status:ReconciliationStatus; business:boolean; tags:string[]; autoApplied:boolean; matchedReceiptId?:string; matchReason?:string; reviewAt?:string };
export type BankRule = { id:string; name:string; narrationContains?:string; minAmountPaise?:bigint; maxAmountPaise?:bigint; direction?:BankDirection; category:string; tag?:string; enabled:boolean; createdAt:string };
export type BankState = { accounts:BankAccount[]; consents:BankConsent[]; raw:RawBankTransaction[]; transactions:BankTransaction[]; rules:BankRule[]; scanCredits:number; premium:boolean };
