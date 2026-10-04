import type { Invoice } from '@/lib/data/types';
import { invoiceTotal, invoiceStatus } from '@/lib/data/calc';
import type { AgingBucket, Customer, CustomerActivity, CustomerLedgerRow, CustomerMetrics, CustomerPayment, CustomerPaymentScore, CreditNote } from './types';

const DAY = 86_400_000;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const paise = (n: number) => BigInt(Math.round(n * 100));
const max0 = (n: bigint) => n > 0n ? n : 0n;
const daysBetween = (a: string, b: string) => Math.max(0, Math.floor((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY));

export function invoiceCustomerMatches(invoice: Invoice, customer: Customer) {
  return invoice.customerId === customer.id || norm(invoice.customer) === norm(customer.displayName) || norm(invoice.customer) === norm(customer.legalName);
}

export function invoicePaidPaise(invoice: Invoice, payments: CustomerPayment[]) {
  return payments.filter((p) => !p.reversed).reduce((s, p) => s + p.allocated.filter(a => a.invoiceId === invoice.id).reduce((x, a) => x + a.amountPaise, 0n), 0n);
}

export function allocatePaymentOldestFirst(customer: Customer, invoices: Invoice[], existing: CustomerPayment[], amountPaise: bigint) {
  let remaining = amountPaise;
  const allocations: { invoiceId: string; amountPaise: bigint }[] = [];
  const rows = invoices.filter(i => invoiceCustomerMatches(i, customer) && i.status !== 'Draft').sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.date.localeCompare(b.date));
  for (const inv of rows) {
    if (remaining <= 0n) break;
    const total = paise(invoiceTotal(inv));
    const paid = invoicePaidPaise(inv, existing);
    const balance = max0(total - paid);
    const take = balance < remaining ? balance : remaining;
    if (take > 0n) { allocations.push({ invoiceId: inv.id, amountPaise: take }); remaining -= take; }
  }
  return { allocations, unappliedPaise: remaining };
}

export function customerMetrics(customer: Customer, invoices: Invoice[], payments: CustomerPayment[], notes: CreditNote[] = [], expenses: { customerId?: string; amountPaise: bigint }[] = [], today = new Date().toISOString().slice(0,10)): CustomerMetrics {
  const cis = invoices.filter(i => invoiceCustomerMatches(i, customer));
  const totalInvoicedPaise = cis.reduce((s, i) => s + paise(invoiceTotal(i)), 0n) + customer.openingBalancePaise;
  const paidPaise = payments.filter(p => !p.reversed && p.customerId === customer.id).reduce((s,p) => s + p.amountPaise, 0n);
  const creditNotesPaise = notes.filter(n => n.status !== 'Void' && n.customerId === customer.id).reduce((s,n) => s + n.amountPaise, 0n);
  const allocatedPaise = payments.filter(p => !p.reversed && p.customerId === customer.id).reduce((s,p) => s + p.allocated.reduce((x,a) => x + a.amountPaise, 0n), 0n);
  const tdsPaise = payments.filter(p => !p.reversed && p.customerId === customer.id).reduce((s,p) => s + p.tdsPaise, 0n);
  const settledPaise = allocatedPaise + tdsPaise;
  const advanceCreditPaise = max0(paidPaise - allocatedPaise);
  const outstandingPaise = max0(totalInvoicedPaise - settledPaise - creditNotesPaise);
  const overduePaise = cis.filter(i => invoiceStatus(i, today) === 'Overdue').reduce((s,i) => s + max0(paise(invoiceTotal(i)) - invoicePaidPaise(i, payments)), 0n);
  const paidInvoices = cis.filter(i => invoiceStatus(i, today) === 'Paid' || invoicePaidPaise(i,payments) >= paise(invoiceTotal(i)));
  const paymentDays = paidInvoices.map(i => { const p = payments.filter(x => !x.reversed).flatMap(x => x.allocated.filter(a=>a.invoiceId===i.id).map(a=>x.date)).sort()[0]; return p ? daysBetween(i.date,p) : 0; }).filter(Boolean);
  const avg = paymentDays.length ? Math.round(paymentDays.reduce((a,b)=>a+b,0)/paymentDays.length) : 0;
  const late = paidInvoices.length ? paidInvoices.filter(i => { const p = payments.filter(x => !x.reversed).flatMap(x=>x.allocated.filter(a=>a.invoiceId===i.id).map(a=>x.date)).sort()[0]; return p ? p > i.dueDate : false; }).length / paidInvoices.length : 0;
  const paymentScore = score(avg, late, paymentDays);
  const estimatedProfitPaise = expenses.filter(e => e.customerId === customer.id).reduce((s,e)=>s + e.amountPaise,0n) ? totalInvoicedPaise - expenses.filter(e => e.customerId === customer.id).reduce((s,e)=>s+e.amountPaise,0n) : undefined;
  return { totalInvoicedPaise, paidPaise, outstandingPaise, overduePaise, creditNotesPaise, advanceCreditPaise, tdsPaise, averageInvoicePaise: cis.length ? totalInvoicedPaise / BigInt(cis.length) : 0n, lifetimeRevenuePaise: totalInvoicedPaise, estimatedProfitPaise, paymentScore };
}

function score(avg: number, lateShare: number, history: number[]): CustomerPaymentScore {
  const half = Math.max(1, Math.floor(history.length / 2));
  const recent = history.slice(-half).reduce((a,b)=>a+b,0) / half;
  const old = history.slice(0, Math.max(1, history.length-half)).reduce((a,b)=>a+b,0) / Math.max(1, history.length-half);
  const trend = recent < old - 3 ? 'Improving' : recent > old + 3 ? 'Worsening' : 'Stable';
  const label = avg <= 7 && lateShare < .15 ? 'Excellent' : avg <= 21 && lateShare < .35 ? 'Good' : avg <= 45 && lateShare < .65 ? 'Slow' : 'Risky';
  return { label, averageDaysToPay: avg, lateShare, trend };
}

export function agingForCustomer(customer: Customer, invoices: Invoice[], payments: CustomerPayment[], today = new Date().toISOString().slice(0,10)): AgingBucket {
  const out = { currentPaise:0n,d1_30Paise:0n,d31_60Paise:0n,d61_90Paise:0n,d90PlusPaise:0n };
  for (const i of invoices.filter(x => invoiceCustomerMatches(x,customer))) {
    const balance = max0(paise(invoiceTotal(i)) - invoicePaidPaise(i,payments)); if (balance <= 0n || i.status === 'Draft' || i.status === 'Void') continue;
    const days = daysBetween(i.dueDate,today); if (i.dueDate >= today) out.currentPaise += balance; else if(days<=30) out.d1_30Paise += balance; else if(days<=60) out.d31_60Paise += balance; else if(days<=90) out.d61_90Paise += balance; else out.d90PlusPaise += balance;
  }
  return out;
}

export function ledgerForCustomer(customer: Customer, invoices: Invoice[], payments: CustomerPayment[], creditNotes: CreditNote[], today = new Date().toISOString().slice(0,10)): CustomerLedgerRow[] {
  const events: Omit<CustomerLedgerRow,'balancePaise'>[] = [];
  for (const i of invoices.filter(x=>invoiceCustomerMatches(x,customer))) events.push({id:`inv:${i.id}`,date:i.date,type:'Invoice',reference:i.number,description:`Invoice ${i.number}`,debitPaise:paise(invoiceTotal(i)),creditPaise:0n});
  for (const p of payments.filter(x=>!x.reversed && x.customerId===customer.id)) events.push({id:`pay:${p.id}`,date:p.date,type:'Payment',reference:p.reference || p.id,description:`${p.method} payment`,debitPaise:0n,creditPaise:p.amountPaise});
  for (const n of creditNotes.filter(x=>x.customerId===customer.id && x.status!=='Void')) events.push({id:`cn:${n.id}`,date:n.date,type:'Credit note',reference:n.number,description:n.reason,debitPaise:0n,creditPaise:n.amountPaise});
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)); let running=customer.openingBalancePaise;
  return events.map(e=>{running += e.debitPaise-e.creditPaise; return {...e,balancePaise:running};});
}

export function detectCustomerDuplicates(customers: Customer[], candidate: Pick<Customer,'displayName'|'phone'|'email'|'gstin'>) {
  return customers.filter(c => (candidate.gstin && c.gstin && norm(candidate.gstin)===norm(c.gstin)) || (candidate.phone && c.phone && norm(candidate.phone)===norm(c.phone)) || (candidate.email && c.email && norm(candidate.email)===norm(c.email)) || norm(c.displayName)===norm(candidate.displayName));
}

export function customerStatus(customer: Customer, metrics: CustomerMetrics, today = new Date().toISOString().slice(0,10)): Customer['status'] {
  if (customer.status === 'Blocked') return 'Blocked';
  if (metrics.overduePaise > 0n) return 'Overdue';
  const last = new Date(customer.updatedAt).getTime();
  return Date.now() - last > 180 * DAY ? 'Inactive' : 'Active';
}

