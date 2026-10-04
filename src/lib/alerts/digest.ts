import type { Alert } from './types';
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function renderDigest(alerts:Alert[]){const top=alerts.slice(0,5);const subject=top.length?`Finova: ${top.length} item${top.length>1?'s':''} need your attention`:'Finova: no new alerts';const text=top.map(a=>`${a.title}\n${a.summary}\nWhy it matters: ${a.why.whyItMatters}\nNext: ${a.why.suggestedAction}`).join('\n\n');const html=`<div>${top.map(a=>`<article><h2>${esc(a.title)}</h2><p>${esc(a.summary)}</p><p><strong>Why it matters:</strong> ${esc(a.why.whyItMatters)}</p><p><strong>Next:</strong> ${esc(a.why.suggestedAction)}</p></article>`).join('')}</div>`;return {subject,text,html}}
export interface AlertChannel{deliver(userId:string,digest:ReturnType<typeof renderDigest>):Promise<void>}
export const inAppAlertChannel:AlertChannel={deliver:async()=>{}};
