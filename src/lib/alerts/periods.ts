const d=(s:string)=>new Date(`${s}T00:00:00Z`);
const iso=(x:Date)=>x.toISOString().slice(0,10);
export const addDays=(s:string,n:number)=>{const x=d(s);x.setUTCDate(x.getUTCDate()+n);return iso(x)};
export const diffDays=(a:string,b:string)=>Math.round((d(b).getTime()-d(a).getTime())/86400000);
export const daysInMonth=(y:number,m:number)=>new Date(Date.UTC(y,m+1,0)).getUTCDate();
export function monthRange(now:string,offset=0){const x=d(now);const y=x.getUTCFullYear(),m=x.getUTCMonth()+offset;const start=new Date(Date.UTC(y,m,1));const end=new Date(Date.UTC(y,m+1,0));return {from:iso(start),to:iso(end),label:start.toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'})}}
export function likeForLikeCurrentMonth(now:string){const x=d(now);const y=x.getUTCFullYear(),m=x.getUTCMonth(),day=x.getUTCDate();const cur={from:iso(new Date(Date.UTC(y,m,1))),to:iso(new Date(Date.UTC(y,m,day))),label:'month to date'};const pm=monthRange(now,-1);const prevEndDay=Math.min(day,daysInMonth(y,m-1));return {cur,prev:{from:pm.from,to:iso(new Date(Date.UTC(y,m-1,prevEndDay))),label:'the same elapsed days last month'}}}
export function rollingRange(now:string,days:number){return {from:addDays(now,-days+1),to:now,label:`the last ${days} days`}}
