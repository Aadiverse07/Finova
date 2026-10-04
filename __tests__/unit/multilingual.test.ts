import { describe, expect, it } from 'vitest';
import { answerMultilingual, customerNameFromQuestion, periodFor } from '@/lib/multilingual/assistant';
import type { Workspace } from '@/lib/assistant/engine';
const ws: Workspace = {
  accounts: [], entries: [],
  expenses: [
    { id: 'e1', date: new Date().toLocaleDateString('en-CA'), category: 'Office Supplies', vendor: 'ABC', description: '', amount: 1200, paymentMethod: 'Bank', status: 'Paid', notes: '' },
    { id: 'e2', date: new Date().toLocaleDateString('en-CA'), category: 'Travel', vendor: 'XYZ', description: '', amount: 800, paymentMethod: 'Bank', status: 'Paid', notes: '' },
  ],
  invoices: [{ id:'i1', number:'INV-1', customer:'Rahul Enterprises', date:new Date().toLocaleDateString('en-CA'), dueDate:new Date().toLocaleDateString('en-CA'), lines:[{id:'l1',description:'Service',quantity:'1',unitPrice:'5000'}], tax:0, discount:0, status:'Pending', notes:'' }],
};
describe('multilingual assistant', () => {
  it('answers Hindi expense question from workspace data', () => { const r=answerMultilingual('इस महीने का कुल खर्च कितना है?', ws); expect(r.language).toBe('hi'); expect(r.answer).toContain('2,000'); });
  it('answers Hinglish outstanding question', () => { const r=answerMultilingual('Mera total baaki kitna hai?', ws); expect(r.language).toBe('hinglish'); expect(r.answer).toContain('5,000'); });
  it('extracts Hindi possessive customer names', () => { expect(customerNameFromQuestion('राहुल का कितना बकाया है?')).toBe('राहुल'); expect(customerNameFromQuestion('Rahul Enterprises ka kitna outstanding hai?')).toBe('Rahul Enterprises'); });
  it('handles week, year, FY and named-month periods', () => { const now=new Date(2026,9,2); expect(periodFor('last week',now).label).toContain('Sep'); expect(periodFor('this year',now).label).toBe('2026'); expect(periodFor('FY',now).label).toBe('FY 26–27'); expect(periodFor('September',now).from.getMonth()).toBe(8); });
  it('never invents a figure for unsupported question', () => { const r=answerMultilingual('Mausam kaisa hai?', ws); expect(r.answer).toContain('total kharcha'); });
});

import { commandFromWake, matchesWakePhrase } from '@/lib/voice/wake-word';
describe('wake word', () => {
  it('detects the wake phrase and extracts the spoken command', () => {
    expect(matchesWakePhrase('Hi Finova')).toBe(true);
    expect(matchesWakePhrase('open dashboard')).toBe(false);
    expect(commandFromWake('Hi Finova, open dashboard')).toBe('open dashboard');
    expect(commandFromWake('hello there hey finova show my expenses this month')).toBe('show my expenses this month');
    expect(commandFromWake('Hi Finova')).toBe('');
    expect(matchesWakePhrase('Finova open invoices')).toBe(true);
    expect(commandFromWake('Finova open invoices')).toBe('open invoices');
    expect(matchesWakePhrase('Innova mere liye ek invoice create karo')).toBe(true);
    expect(commandFromWake('Innova mere liye ek invoice create karo')).toBe('mere liye ek invoice create karo');
    expect(matchesWakePhrase('what is the weather today')).toBe(false);
  });
});

import { routeVoiceCommand, matchCustomerName } from '@/lib/assistant/tools';
describe('voice invoice creation', () => {
  it('parses English, Hinglish and Hindi invoice commands', () => {
    expect(routeVoiceCommand('create invoice for Apex Industries 20000')).toEqual({ action: 'create_invoice_draft', params: { customer: 'Apex Industries', amount: '20000' } });
    expect(routeVoiceCommand('Apex Industries ke liye 20 hazaar ka invoice banao')).toEqual({ action: 'create_invoice_draft', params: { customer: 'Apex Industries', amount: '20000' } });
    expect(routeVoiceCommand('create an invoice for Nova Technologies of 1.5 lakh')).toEqual({ action: 'create_invoice_draft', params: { customer: 'Nova Technologies', amount: '150000' } });
    expect(routeVoiceCommand('mere liye ek invoice create karo')).toEqual({ action: 'create_invoice_draft', params: {} });
  });
  it('does not treat questions or complaints as create commands', () => {
    expect(routeVoiceCommand('invoice nahi bana sakte')).toBeNull();
    expect(routeVoiceCommand('mera invoice kitna bana')).toBeNull();
    expect(routeVoiceCommand('show unpaid invoices')?.action).toBe('query_outstanding');
  });
  it('matches spoken names to existing customers', () => {
    expect(matchCustomerName('apex', ['Apex Industries', 'Nova Technologies'])).toBe('Apex Industries');
    expect(matchCustomerName('Zed Corp', ['Apex Industries'])).toBe('Zed Corp');
  });
});
