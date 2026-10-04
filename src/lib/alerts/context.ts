import type { Workspace } from '@/lib/assistant/engine';
import { accountBalance, accountTotals, invoiceStatus, invoiceTotal, profitAndLoss, trialBalance } from '@/lib/data/calc';
import { r2 } from '@/lib/data/format';
import type { AlertConfig } from './types';
import { likeForLikeCurrentMonth, rollingRange } from './periods';
export type AlertContext={
 ws:Workspace; now:string; config:AlertConfig; invoices:{i:Workspace['invoices'][number];status:'Paid'|'Pending'|'Draft'|'Overdue';total:number}[];
 expensePeriods:{cur:{from:string;to:string;label:string};prev:{from:string;to:string;label:string}};
 expenseCurrent:number;expensePrevious:number;expenseCount:number;
 cashAccounts:Workspace['accounts'];cashBalance:number;cashCurrent:{inflow:number;outflow:number;net:number};cashPrevious:{inflow:number;outflow:number;net:number};
 trial:ReturnType<typeof trialBalance>; pl:ReturnType<typeof profitAndLoss>;
};
const range=(date:string,p:{from:string;to:string})=>date>=p.from&&date<=p.to;
function cashTotals(ws:Workspace, p:{from:string;to:string}, ids:Set<string>){let inflow=0,outflow=0;for(const e of ws.entries)if(e.status==='Posted'&&range(e.date,p))for(const l of e.lines)if(ids.has(l.accountId)){inflow+=l.debit;outflow+=l.credit}return {inflow:r2(inflow),outflow:r2(outflow),net:r2(inflow-outflow)}}
export function buildContext(ws:Workspace,now:string,config:AlertConfig):AlertContext{
 const invoices=ws.invoices.map(i=>({i,status:invoiceStatus(i,now),total:invoiceTotal(i)}));
 const periods=likeForLikeCurrentMonth(now);
 const exp=(p:{from:string;to:string})=>r2(ws.expenses.filter(e=>range(e.date,p)).reduce((s,e)=>s+e.amount,0));
 const cashAccounts=ws.accounts.filter(a=>a.isActive&&a.type==='ASSET'&&(config.cashAccountIds.includes(a.id)||config.cashAccountIds.includes(a.code)||/^10/.test(a.code)||/\b(bank|cash)\b/i.test(a.name)));
 const ids=new Set<string>(cashAccounts.map(a=>a.id)); const cashBalance=r2(cashAccounts.reduce((s,a)=>s+accountBalance(a,ws.entries,{to:now}),0));
 const cm={from:periods.cur.from,to:periods.cur.to};const pm={from:periods.prev.from,to:periods.prev.to};
 const pl=profitAndLoss(ws.accounts,ws.entries,undefined,now);
 return {ws,now,config,invoices,expensePeriods:periods,expenseCurrent:exp(cm),expensePrevious:exp(pm),expenseCount:ws.expenses.filter(e=>range(e.date,cm)).length,cashAccounts,cashBalance,cashCurrent:cashTotals(ws,cm,ids),cashPrevious:cashTotals(ws,pm,ids),trial:trialBalance(ws.accounts,ws.entries,now),pl};
}
