import { describe, expect, it } from 'vitest';
import { allocatePaymentOldestFirst, agingForCustomer, customerMetrics, detectCustomerDuplicates } from '@/lib/customers/engine';
import type { Customer, CustomerPayment } from '@/lib/customers/types';
import type { Invoice } from '@/lib/data/types';
const customer:Customer={id:'c1',displayName:'Acme',legalName:'Acme',type:'business',phone:'999',email:'a@a.test',gstTreatment:'registered',tdsApplicable:false,tdsRate:0,contacts:[],addresses:[],paymentTerms:30,currency:'INR',defaultTaxRate:18,creditLimitPaise:1000000n,openingBalancePaise:0n,preferredPaymentMethod:'UPI',discountTerms:'',tags:[],category:'Business',source:'Test',customFields:{},status:'Active',archived:false,createdAt:'2026-01-01',updatedAt:'2026-10-01'};
const inv=(id:string,date:string,dueDate:string,total:number):Invoice=>({id,number:id,customer:'Acme',customerId:'c1',date,dueDate,lines:[{id,description:'Work',quantity:'1',unitPrice:String(total)}],tax:0,discount:0,status:'Pending',notes:''});
describe('customer financial engine',()=>{
 it('allocates oldest-first and leaves excess as credit',()=>{const invoices=[inv('i1','2026-08-01','2026-08-31',1000),inv('i2','2026-09-01','2026-09-30',2000)];const r=allocatePaymentOldestFirst(customer,invoices,[],250000n);expect(r.allocations).toEqual([{invoiceId:'i1',amountPaise:100000n},{invoiceId:'i2',amountPaise:150000n}]);expect(r.unappliedPaise).toBe(0n)});
 it('calculates outstanding and advance credit without floats',()=>{const invoices=[inv('i1','2026-09-01','2026-09-15',1000)];const p:CustomerPayment={id:'p',customerId:'c1',date:'2026-09-10',amountPaise:150000n,method:'UPI',reference:'U',allocated:[{invoiceId:'i1',amountPaise:100000n}],tdsPaise:0n,reversed:false};const m=customerMetrics(customer,invoices,[p]);expect(m.outstandingPaise).toBe(0n);expect(m.advanceCreditPaise).toBe(50000n)});
 it('puts overdue balance into the correct aging bucket',()=>{const a=agingForCustomer(customer,[inv('i1','2026-06-01','2026-06-30',1000),inv('i2','2026-09-25','2026-10-01',500)],[],'2026-10-02');expect(a.d90PlusPaise).toBe(100000n);expect(a.d1_30Paise).toBe(50000n)});
 it('detects duplicate identity keys',()=>{expect(detectCustomerDuplicates([customer],{displayName:'Other',phone:'999',email:'x',gstin:''})).toHaveLength(1)});
});
