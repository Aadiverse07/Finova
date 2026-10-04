import { createHash } from 'node:crypto';
export type Line={accountId:string;debit:number;credit:number;description?:string};
export type EntryInput={date:string;memo:string;source:'MANUAL'|'INVOICE'|'PAYMENT'|'EXPENSE'|'REVERSAL'|'OPENING';sourceRef?:string;lines:Line[]};
export type AccountLike={id:string;isActive:boolean};
export function validate(input:EntryInput, accounts:Map<string,AccountLike>, options:{lockedThrough?:string;today?:string}={}) {
 if(input.lines.length<2) throw Object.assign(new Error('At least two lines are required'),{code:'TOO_FEW_LINES'});
 let debit=0,credit=0;
 for(const line of input.lines){ if(!Number.isSafeInteger(line.debit)||!Number.isSafeInteger(line.credit)||line.debit<0||line.credit<0||((line.debit>0)===(line.credit>0))) throw Object.assign(new Error('Each line must have exactly one positive integer side'),{code:'INVALID_LINE'}); const a=accounts.get(line.accountId); if(!a) throw Object.assign(new Error('Unknown account'),{code:'UNKNOWN_ACCOUNT'}); if(!a.isActive) throw Object.assign(new Error('Inactive account'),{code:'INACTIVE_ACCOUNT'}); debit+=line.debit;credit+=line.credit; }
 if(debit!==credit) throw Object.assign(new Error('Journal entry is unbalanced'),{code:'UNBALANCED',details:{debitTotal:debit,creditTotal:credit,difference:debit-credit}});
 if(options.lockedThrough&&input.date<=options.lockedThrough) throw Object.assign(new Error('Accounting period is locked'),{code:'PERIOD_LOCKED'});
 if(options.today&&input.date>options.today) throw Object.assign(new Error('Future-dated entry'),{code:'FUTURE_DATE'});
 return {debitTotal:debit,creditTotal:credit};
}
export function canonicalEntry(entry: Omit<EntryInput,'lines'>&{entryNo:number;reversalOfId?:string|null;lines:Line[]}) { return JSON.stringify({entryNo:entry.entryNo,date:entry.date,memo:entry.memo,source:entry.source,sourceRef:entry.sourceRef??null,reversalOfId:entry.reversalOfId??null,lines:[...entry.lines].map(l=>({accountId:l.accountId,debit:l.debit,credit:l.credit,description:l.description??null})).sort((a,b)=>a.accountId.localeCompare(b.accountId)||a.debit-b.debit||a.credit-b.credit)}); }
export function hashEntry(prevHash:string,canonical:string){return createHash('sha256').update(prevHash+canonical).digest('hex');}
