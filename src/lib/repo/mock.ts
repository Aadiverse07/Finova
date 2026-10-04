import type { AccountRepository, AccountRecord } from './types';
import { DuplicateAccountCodeError } from './types';

/** In-memory repository for DATA_SOURCE=mock. Data is partitioned per org, mirroring the real scoping rule. */
const store = new Map<string, AccountRecord[]>();
let seq = 0;

export function __resetMockStore(): void {
  store.clear();
  seq = 0;
}

export const mockAccountRepository: AccountRepository = {
  async list(orgId, filter, page) {
    const rows = (store.get(orgId) ?? [])
      .filter((a) => (filter.type ? a.type === filter.type : true))
      .filter((a) => (filter.isActive === undefined ? true : a.isActive === filter.isActive))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { items: rows.slice(page.skip, page.skip + page.take), total: rows.length };
  },

  async create(orgId, _userId, input) {
    const rows = store.get(orgId) ?? [];
    if (rows.some((a) => a.code === input.code)) throw new DuplicateAccountCodeError(input.code);
    seq += 1;
    const record: AccountRecord = {
      id: `mock_acc_${seq}`,
      code: input.code,
      name: input.name,
      type: input.type,
      normalBalance: input.normalBalance,
      isActive: input.isActive,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    store.set(orgId, [...rows, record]);
    return record;
  },
};
