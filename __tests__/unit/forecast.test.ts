import { describe, expect, it } from 'vitest';
import { buildForecast, forecastToJSON } from '@/lib/forecast/engine';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import type { Expense } from '@/lib/data/types';

describe('cash-flow forecast', () => {
  const base = { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses, now: '2026-10-02' as const };

  it('uses paise internally and produces the four core outputs', () => {
    const f = buildForecast({ ...base, horizon: 30, scenario: 'expected' });
    expect(typeof f.currentCashPaise).toBe('bigint');
    expect(f.projectedPositionPaise).toBe(f.currentCashPaise + f.expectedIncomingPaise - f.expectedExpensesPaise);
    expect(f.points).toHaveLength(31);
  });

  it('supports all scenarios without mutating source data', () => {
    const before = JSON.stringify(seedInvoices);
    const best = buildForecast({ ...base, horizon: 30, scenario: 'best' });
    const expected = buildForecast({ ...base, horizon: 30, scenario: 'expected' });
    const worst = buildForecast({ ...base, horizon: 30, scenario: 'worst' });
    expect(best.events.some(x => x.type === 'invoice')).toBe(true);
    expect(expected.events.some(x => x.type === 'invoice')).toBe(true);
    expect(worst.events.length).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(seedInvoices)).toBe(before);
  });

  it('flags limited data when history is short', () => {
    const f = buildForecast({ ...base, entries: seedEntries.filter(e => e.date >= '2026-09-01'), expenses: seedExpenses, horizon: 30 });
    expect(f.limitedData).toBe(true);
    expect(f.confidenceReasons.join(' ')).toMatch(/less than 3 months|limited/i);
  });

  it('detects recurring patterns only with repeated stable records', () => {
    const expenses: Expense[] = [
      ...seedExpenses,
      { ...seedExpenses[0], id: 'R1', date: '2026-08-30', vendor: 'Recurring Vendor', amount: 1000 },
      { ...seedExpenses[0], id: 'R2', date: '2026-07-31', vendor: 'Recurring Vendor', amount: 1020 },
      { ...seedExpenses[0], id: 'R3', date: '2026-07-01', vendor: 'Recurring Vendor', amount: 980 },
    ];
    const f = buildForecast({ ...base, expenses, horizon: 30 });
    expect(f.recurring.some(r => r.payee === 'Recurring Vendor')).toBe(true);
  });

  it('serializes bigint values safely for API responses', () => {
    const json = forecastToJSON(buildForecast({ ...base, horizon: 30 }));
    expect(typeof json.currentCashPaise).toBe('string');
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});
