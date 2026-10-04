import { describe, expect, it } from 'vitest';
import corpus from '../fixtures/nlq-corpus.json';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { parseQuestion } from '@/lib/nlq/parser';
import type { Workspace } from '@/lib/assistant/engine';

type CorpusCase = { question: string; expectedEntity: string | string[]; expectedAction?: 'write-refusal' | 'out-of-scope' };
const NOW = '2026-10-02';
const workspace: Workspace = { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses };
const actionable = (item: CorpusCase) => !item.expectedAction && !/^(what about october|only the paid ones)\??$/i.test(item.question);

describe('NLQ golden corpus', () => {
  it('contains at least the required 60 cases', () => expect(corpus.length).toBeGreaterThanOrEqual(60));

  it('keeps write and out-of-scope cases side-effect free at parse level', () => {
    const write = corpus.find((item) => item.question === 'delete all marketing expenses') as CorpusCase;
    const offTopic = corpus.find((item) => item.question === 'who won the cricket match') as CorpusCase;
    expect(parseQuestion(write.question, workspace, NOW).spec).toBeUndefined();
    expect(parseQuestion(offTopic.question, workspace, NOW).spec).toBeUndefined();
  });

  it('matches expected entity intent for every standalone actionable corpus case', () => {
    const cases = (corpus as CorpusCase[]).filter(actionable);
    let matched = 0;
    for (const item of cases) {
      const result = parseQuestion(item.question, workspace, NOW);
      expect(result.spec, item.question).toBeTruthy();
      const expected = Array.isArray(item.expectedEntity) ? item.expectedEntity : [item.expectedEntity];
      const actual = result.spec?.entities ?? [];
      if (expected.every((entity) => actual.includes(entity as never))) matched += 1;
      else throw new Error(`${item.question}: expected ${expected.join(', ')} but got ${actual.join(', ')}`);
    }
    expect(matched / cases.length).toBeGreaterThanOrEqual(0.9);
  });
});
