import type { Alert, AlertCategory, Severity } from '../types';
import type { AlertContext } from '../context';
export const r2=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const pct=(a:number,b:number)=>b?Math.round(a/b*100):0;
export const range=(d:string,p:{from:string;to:string})=>d>=p.from&&d<=p.to;
export const sum=(xs:number[])=>r2(xs.reduce((a,b)=>a+b,0));
export function make(c:AlertContext,ruleId:string,category:AlertCategory,severity:Severity,title:string,summary:string,why:Alert['why'],facts:Record<string,number|string>,records:Alert['evidence']['records'],method:string,action:{label:string;href:string},impact?:Alert['impact'],period?:Alert['period']):Alert{
 const id=`${ruleId}:${Object.entries(facts).filter(([k])=>/id|count|total|bucket|category|customer/.test(k)).map(([k,v])=>`${k}=${v}`).join('|')||title}`;
 const nums=[title,summary,why.whatHappened,why.comparedWith||'',why.whyItMatters,why.suggestedAction].join(' ');
 if(!why.whatHappened||!why.whyItMatters||!why.suggestedAction||!Object.keys(facts).length||!nums) throw new Error(`Invalid alert ${ruleId}`);
 return {id,ruleId,category,severity,title,summary,why,evidence:{facts,records:records.slice(0,3),method},action,impact,period,firstSeenAt:c.now,lastEvaluatedAt:c.now,materiality:Math.min(1,Math.max(0,(impact?.amount??0)/100000))};
}
