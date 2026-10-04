import corpus from '/home/claude/p/__tests__/fixtures/nlq-corpus.json';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { parseQuestion } from '@/lib/nlq/parser';
import { executeSpec } from '@/lib/nlq/executor';
const ws={accounts:seedAccounts,entries:seedEntries,invoices:seedInvoices,expenses:seedExpenses};
for(const c of corpus as any[]){const r=parseQuestion(c.question,ws,'2026-10-02');const s=r.spec;
 let g='';try{if(s)g=executeSpec(ws,s,'2026-10-02').map(x=>x.entity[0]+x.count).join(',')}catch(e:any){g='ERR '+e.message}
 console.log(c.question.slice(0,48).padEnd(48),'|',s?s.entities.join('+'):'REFUSE','|',s?JSON.stringify({...s.filters,dateRange:s.filters.dateRange&&s.filters.dateRange.from+'..'+s.filters.dateRange.to}):'','|',s?.confidence?.toFixed(2),'|u:',(r.unresolved||[]).join(','),'|',g,'| exp:',JSON.stringify(c.expectedEntity),c.expectedAction??'')}
