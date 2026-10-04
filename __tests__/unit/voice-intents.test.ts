import { describe, expect, it } from 'vitest';
import { interpretVoice } from '@/lib/assistant/voice-intents';

const nav = (t: string) => { const r = interpretVoice(t); return r?.kind === 'navigate' ? r.path : r?.kind; };

describe('voice intent router', () => {
  it.each([
    ['open expense module', '/expenses'], ['please open the expenses page', '/expenses'], ['take me to invoices', '/invoices'],
    ['show unpaid invoices', '/invoices?status=Pending,Overdue'], ['open customer module', '/customers'], ['kharcha kholo', '/expenses'],
    ['open profit and loss', '/reports?tab=pnl'], ['open cash flow', '/forecast'], ['download my bank statement', '/bank?statement=1'],
    ['add expense', '/expenses?add=1'], ['create invoice', '/invoices?add=1'], ['open expences', '/expenses'],
  ])('%s -> %s', (text, path) => expect(nav(text)).toBe(path));
  it('creates data actions when details are spoken', () => {
    expect(interpretVoice('add expense of 500 for tea')).toMatchObject({ kind: 'action', action: { action: 'add_expense' } });
    expect(interpretVoice('create invoice for Apex 20000')).toMatchObject({ kind: 'action', action: { action: 'create_invoice_draft' } });
  });
  it('rejects requests unrelated to Finova and leaves analytical questions to the assistant', () => {
    expect(interpretVoice('tell me a joke')?.kind).toBe('offtopic');
    expect(interpretVoice('play some music')?.kind).toBe('offtopic');
    expect(interpretVoice('how much did I spend this month')).toBeNull();
  });
});

import { isExplicitCommand } from '@/lib/assistant/voice-intents';
describe('hands-free commands without the wake word', () => {
  it('acts on explicit commands only', () => {
    expect(isExplicitCommand('open expenses')).toBe(true);
    expect(isExplicitCommand('open expense module')).toBe(true);
    expect(isExplicitCommand('create invoice for Apex 20000')).toBe(true);
    expect(isExplicitCommand('the expenses were high last month')).toBe(false);
    expect(isExplicitCommand('open the window')).toBe(false);
  });
});

import { parseStatementRange } from '@/lib/assistant/voice-intents';
describe('statement and PDF voice commands', () => {
  it('parses statement ranges and caps them at 30 days', () => {
    expect(parseStatementRange('last 7 days', '2026-10-03')).toEqual({ from: '2026-09-26', to: '2026-10-03', clamped: false });
    expect(parseStatementRange('yesterday', '2026-10-03')).toMatchObject({ from: '2026-10-02', to: '2026-10-02' });
    expect(parseStatementRange('last 90 days', '2026-10-03')).toEqual({ from: '2026-09-03', to: '2026-10-03', clamped: true });
  });
  it('maps download phrases to actions', () => {
    expect(interpretVoice('download my statement for the last 15 days')).toMatchObject({ kind: 'action', action: { action: 'download_statement' } });
    expect(interpretVoice('download invoice INV-2026-003 as pdf')).toMatchObject({ kind: 'action', action: { action: 'download_invoice', params: { invoice: 'INV-2026-003' } } });
    expect(interpretVoice('download invoice for Apex Industries')).toMatchObject({ kind: 'action', action: { action: 'download_invoice', params: { customer: 'Apex Industries' } } });
    expect(interpretVoice('show my statement for last week')).toMatchObject({ kind: 'navigate' });
  });
});
