import {describe,it,expect} from 'vitest';
import {fingerprint,isDuplicate,normaliseMerchant,parseDate,applyRules,suggestCategory} from '@/lib/bank/engine';

describe('bank ingestion engine',()=>{
 it('parses Indian dates',()=>expect(parseDate('28/09/2026')).toBe('2026-09-28'));
 it('normalises common UPI narration',()=>expect(normaliseMerchant('UPI/ABC OFFICE SUPPLIES/UTR:123456789012')).toContain('abc office supplies'));
 it('uses source id or fingerprint for duplicates',()=>{const x:any={id:'1',source:'STATEMENT_UPLOAD',accountId:'a',date:'2026-01-01',amountPaise:1000n,direction:'DEBIT',narration:'ABC',fingerprint:fingerprint({date:'2026-01-01',amountPaise:1000n,narration:'ABC'}),importedAt:''};expect(isDuplicate({...x,sourceTransactionId:'u1'},[{...x,sourceTransactionId:'u1'}])).toBe(true);expect(isDuplicate({...x,sourceTransactionId:'u2'},[x])).toBe(true)});
 it('applies rules before fallback',()=>{const r:any={id:'1',source:'STATEMENT_UPLOAD',accountId:'a',date:'2026-01-01',amountPaise:10000n,direction:'DEBIT',narration:'ABC OFFICE SUPPLIES',fingerprint:'x',importedAt:''};expect(applyRules(r,[{id:'r',name:'office',narrationContains:'ABC OFFICE',category:'Office Supplies',enabled:true,createdAt:''}])?.category).toBe('Office Supplies');expect(suggestCategory(r,[],new Map(),[],[]).category).toBe('Office Supplies');});
});
