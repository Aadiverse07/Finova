import type { AccountCreateInput, AccountListQuery } from '@/lib/schemas/account';

export type AccountRecord = {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
};

/** Thrown when (orgId, code) already exists. Mapped to 409 by the route. */
export class DuplicateAccountCodeError extends Error {
  constructor(public readonly code: string) {
    super(`Account code ${code} already exists`);
    this.name = 'DuplicateAccountCodeError';
  }
}

/**
 * Every method takes `orgId` as its FIRST argument and must scope every query by it.
 * This is the only tenant boundary (there is no Postgres RLS).
 */
export interface AccountRepository {
  list(
    orgId: string,
    filter: AccountListQuery,
    page: { skip: number; take: number },
  ): Promise<{ items: AccountRecord[]; total: number }>;
  create(orgId: string, userId: string, input: AccountCreateInput): Promise<AccountRecord>;
}
