import { describe, expect, it } from 'vitest';
import { isBalancedJournal, journalTotals } from '@/lib/ledger/journal-validation';

describe('journal double-entry validation', () => {
  it('calculates equal debit and credit totals', () => {
    expect(journalTotals([{ debit: 25000, credit: 0 }, { debit: 0, credit: 25000 }]))
      .toEqual({ debit: 25000, credit: 25000 });
  });

  it('accepts a balanced non-zero journal', () => {
    expect(isBalancedJournal([{ debit: '45000', credit: '' }, { debit: '', credit: '45000' }])).toBe(true);
  });

  it('rejects an unbalanced journal', () => {
    expect(isBalancedJournal([{ debit: 5000, credit: 0 }, { debit: 0, credit: 4000 }])).toBe(false);
  });

  it('rejects a zero-value journal', () => {
    expect(isBalancedJournal([{ debit: 0, credit: 0 }, { debit: 0, credit: 0 }])).toBe(false);
  });
});
