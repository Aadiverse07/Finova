'use client';
import { create } from 'zustand';
import type { Invoice, Expense } from '@/lib/data/types';
import { useFinova } from '@/lib/data/store';
import { uid, todayISO } from '@/lib/data/format';
import { seedActivities, seedCreditNotes, seedCustomers, seedPayments } from './seed';
import type { Customer, CustomerActivity, CustomerDocument, CustomerDraft, CustomerPayment, CreditNote } from './types';
import { allocatePaymentOldestFirst, detectCustomerDuplicates } from './engine';

type State = {
  customers: Customer[];
  payments: CustomerPayment[];
  creditNotes: CreditNote[];
  activities: CustomerActivity[];
  documents: CustomerDocument[];
  addCustomer: (draft: CustomerDraft) => { customer?: Customer; duplicates?: Customer[] };
  updateCustomer: (id:string, patch: Partial<Customer>) => void;
  archiveCustomer: (id:string) => void;
  mergeCustomers: (primaryId:string, duplicateId:string) => void;
  recordPayment: (customerId:string, amountPaise:bigint, method:CustomerPayment['method'], reference:string, manualAllocations?:CustomerPayment['allocated'], tdsPaise?:bigint, note?:string) => CustomerPayment | null;
  addActivity: (customerId:string, kind:CustomerActivity['kind'], text:string) => void;
  addCreditNote: (note:Omit<CreditNote,'id'>) => void;
  addDocument: (doc:Omit<CustomerDocument,'id'|'createdAt'>) => void;
};

export const useCustomers = create<State>((set,get)=>({
  customers: seedCustomers, payments: seedPayments, creditNotes: seedCreditNotes, activities: seedActivities, documents: [],
  addCustomer: (draft) => {
    const duplicates = detectCustomerDuplicates(get().customers, draft);
    if (duplicates.length) return { duplicates };
    const customer: Customer = {...draft,id:uid(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    set(s=>({customers:[customer,...s.customers],activities:[{id:uid(),customerId:customer.id,date:todayISO(),kind:'Status',text:'Customer created'},...s.activities]}));
    return {customer};
  },
  updateCustomer: (id,patch)=>set(s=>({customers:s.customers.map(c=>c.id===id?{...c,...patch,updatedAt:new Date().toISOString()}:c)})),
  archiveCustomer: id=>set(s=>({customers:s.customers.map(c=>c.id===id?{...c,archived:true,status:'Inactive',updatedAt:new Date().toISOString()}:c),activities:[{id:uid(),customerId:id,date:todayISO(),kind:'Status',text:'Customer archived'},...s.activities]})),
  mergeCustomers: (primaryId,duplicateId)=>set(s=>{
    const primary=s.customers.find(c=>c.id===primaryId), duplicate=s.customers.find(c=>c.id===duplicateId); if(!primary||!duplicate||primaryId===duplicateId) return s;
    const movedPayments=s.payments.map(p=>p.customerId===duplicateId?{...p,customerId:primaryId}:p);
    const movedCredits=s.creditNotes.map(n=>n.customerId===duplicateId?{...n,customerId:primaryId}:n);
    return {customers:s.customers.map(c=>c.id===duplicateId?{...c,archived:true,status:'Inactive',updatedAt:new Date().toISOString()}:c),payments:movedPayments,creditNotes:movedCredits,activities:[{id:uid(),customerId:primaryId,date:todayISO(),kind:'Status',text:`Merged duplicate customer ${duplicate.displayName}`},...s.activities]};
  }),
  recordPayment: (customerId,amountPaise,method,reference,manualAllocations,tdsPaise=0n,note) => {
    const customer=get().customers.find(c=>c.id===customerId); if(!customer || amountPaise<=0n) return null;
    const finance=useFinova.getState();
    const invs=finance.invoices;
    const allocation=manualAllocations ? {allocations:manualAllocations,unappliedPaise:amountPaise-manualAllocations.reduce((s,a)=>s+a.amountPaise,0n)} : allocatePaymentOldestFirst(customer,invs,get().payments,amountPaise);
    const payment:CustomerPayment={id:uid(),customerId,date:todayISO(),amountPaise,method,reference,allocated:allocation.allocations,tdsPaise,reversed:false,note};
    set(s=>({payments:[payment,...s.payments],activities:[{id:uid(),customerId,date:todayISO(),kind:'Note',text:`Payment received ${amountPaise.toString()} paise; ${allocation.allocations.length} invoice allocation(s)`},...s.activities]}));
    // Keep the legacy invoice UI synchronized for fully allocated payments.
    for (const a of allocation.allocations) {
      const inv=invs.find(i=>i.id===a.invoiceId); if(inv && a.amountPaise >= BigInt(Math.round((inv.lines.reduce((sum,l)=>sum+Number(l.quantity)*Number(l.unitPrice),0)+inv.tax-inv.discount)*100))) finance.markInvoicePaid(inv.id);
    }
    return payment;
  },
  addActivity:(customerId,kind,text)=>set(s=>({activities:[{id:uid(),customerId,date:todayISO(),kind,text},...s.activities]})),
  addCreditNote:note=>set(s=>({creditNotes:[{...note,id:uid()},...s.creditNotes]})),
  addDocument:doc=>set(s=>({documents:[{...doc,id:uid(),createdAt:new Date().toISOString()},...s.documents]})),
}));

export function customerInvoices(customer: Customer, invoices: Invoice[]) { return invoices.filter(i=>i.customerId===customer.id || i.customer.trim().toLowerCase()===customer.displayName.trim().toLowerCase() || i.customer.trim().toLowerCase()===customer.legalName.trim().toLowerCase()); }
export function customerExpenses(customer: Customer, expenses: Expense[]) { return expenses.filter(e=>e.vendor.trim().toLowerCase()===customer.displayName.trim().toLowerCase()); }
