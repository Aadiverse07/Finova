import type { Workspace } from '@/lib/assistant/engine';
import { norm, stem } from '@/lib/assistant/text';
import { aliases } from './lexicon';
export type EntityKind = 'category'|'vendor'|'customer'|'account';
export type Match = { value: string; kind: EntityKind; score: number; alternatives: string[] };
const distance = (a:string,b:string):number => {
  const d:number[] = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){ let prev=d[0] ?? 0; d[0]=i; for(let j=1;j<=b.length;j++){ const cur=d[j] ?? 0; const left=d[j-1] ?? 0; const up=d[j] ?? 0; d[j]=Math.min(up+1,left+1,prev+(a[i-1]===b[j-1]?0:1)); prev=cur; } }
  return d[b.length] ?? a.length;
};
export function resolveEntity(input:string,kind:EntityKind,ws:Workspace):Match|undefined{
 const alias=aliases[norm(input)];const target=alias&&kind==='category'?alias:input;
 const source=kind==='category'?[...new Set([...ws.expenses.map(e=>e.category),...ws.accounts.filter(a=>a.type==='EXPENSE').map(a=>a.name)])]:kind==='vendor'?[...new Set(ws.expenses.map(e=>e.vendor))]:kind==='customer'?[...new Set(ws.invoices.map(i=>i.customer))]:ws.accounts.map(a=>a.name);
 const n=norm(target);if(!n)return undefined;const exact=source.find(v=>norm(v)===n);if(exact)return {value:exact,kind,score:1,alternatives:source.filter(v=>norm(v)===n&&v!==exact)};
 const prefix=source.filter(v=>norm(v).startsWith(n)||n.startsWith(norm(v))).sort((a,b)=>norm(a).length-norm(b).length);if(prefix[0])return {value:prefix[0],kind,score:.88,alternatives:prefix.slice(1,3)};
 const toks=n.split(/\s+/).map(stem);const boundary=source.filter(v=>toks.some(t=>norm(v).split(/\s+/).map(stem).includes(t)));if(boundary[0])return {value:boundary[0],kind,score:.8,alternatives:boundary.slice(1,3)};
 const fuzzy=source.map(v=>({v,d:distance(n,norm(v))})).filter(x=>x.d<=Math.max(1,Math.min(2,Math.floor(n.length/5)))).sort((a,b)=>a.d-b.d);if(fuzzy[0])return {value:fuzzy[0].v,kind,score:fuzzy[0].d===1?.74:.67,alternatives:fuzzy.slice(1,3).map(x=>x.v)};
 return undefined;
}
