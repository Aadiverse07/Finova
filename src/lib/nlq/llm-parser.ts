import type { Workspace } from '@/lib/assistant/engine';
import type { QuerySpec } from './types';
export interface NlParser { parse(question:string,vocabulary:{categories:string[];accounts:string[];customers?:string[];vendors?:string[]},now:string):Promise<QuerySpec>; }
/** Optional provider contract. No provider is selected or called by default. */
export class DisabledLlmParser implements NlParser { async parse():Promise<QuerySpec>{throw new Error('NL_SEARCH_LLM is disabled; use the deterministic parser.');} }
export function vocabularyForLlm(ws:Workspace){return {categories:[...new Set(ws.expenses.map(e=>e.category))],accounts:ws.accounts.map(a=>a.name),customers:[...new Set(ws.invoices.map(i=>i.customer))],vendors:[...new Set(ws.expenses.map(e=>e.vendor))]};}
