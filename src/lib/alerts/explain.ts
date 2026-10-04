import { money } from '@/lib/data/format';
export const facts=(x:Record<string,number|string>)=>x;
export function mandatory(what:string,matters:string,action:string,compared?:string){return {whatHappened:what,comparedWith:compared,whyItMatters:matters,suggestedAction:action}}
export function numberTokens(text:string){return [...text.matchAll(/₹\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%?\b/g)].map(x=>x[0].replace(/[₹,\s%]/g,''))}
export { money };
