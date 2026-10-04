import type { Account, Expense, Invoice, JournalEntry } from '@/lib/data/types';
import { accountBalance, invoiceStatus, invoiceTotal } from '@/lib/data/calc';

export type ForecastHorizon = 30 | 60 | 90 | 180 | 365;
export type ForecastScenario = 'best' | 'expected' | 'worst';
export type Confidence = 'Low' | 'Medium' | 'High';

export type ForecastInput = {
  accounts: Account[];
  entries: JournalEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  now?: string;
  horizon?: ForecastHorizon;
  safetyBufferPaise?: bigint;
  recurringOverrides?: Record<string, 'accepted' | 'rejected'>;
  scenario?: ForecastScenario;
};

export type ForecastEvent = {
  id: string;
  date: string;
  type: 'invoice' | 'expense' | 'recurring' | 'tax';
  label: string;
  amountPaise: bigint;
  direction: 'in' | 'out';
  confidence: number;
  sourceId?: string;
  customer?: string;
};

export type ForecastPoint = {
  date: string;
  balancePaise: bigint;
  bestPaise: bigint;
  worstPaise: bigint;
  inflowPaise: bigint;
  outflowPaise: bigint;
};

export type RecurringCandidate = {
  id: string;
  payee: string;
  amountPaise: bigint;
  intervalDays: number;
  occurrences: number;
  nextDate: string;
  category?: string;
  status: 'suggested' | 'accepted' | 'rejected';
};

export type Forecast = {
  generatedAt: string;
  horizon: ForecastHorizon;
  scenario: ForecastScenario;
  currentCashPaise: bigint;
  cashAccounts: { id:string; name:string; balancePaise:bigint }[];
  expectedIncomingPaise: bigint;
  expectedExpensesPaise: bigint;
  gstLiabilityPaise: bigint;
  projectedPositionPaise: bigint;
  confidence: Confidence;
  confidenceReasons: string[];
  limitedData: boolean;
  points: ForecastPoint[];
  events: ForecastEvent[];
  recurring: RecurringCandidate[];
  weeklyCashIn: { label: string; amountPaise: bigint }[];
  weeklyCashOut: { label: string; amountPaise: bigint }[];
  firstBelowZero?: string;
  firstBelowBuffer?: string;
  monthlyBurnPaise: bigint;
  runwayMonths: number | null;
  insights: string[];
};

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(`${s}T00:00:00+05:30`).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
const paise = (r: number) => BigInt(Math.round(r * 100));
const rupees = (p: bigint) => Number(p) / 100;
const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);
const median = (xs: number[]) => { const s=[...xs].sort((a,b)=>a-b); return s.length ? (s[Math.floor(s.length/2)] ?? 0) : 0; };
const dateInRange = (d: string, from: string, to: string) => d >= from && d <= to;

function currentCash(accounts: Account[], entries: JournalEntry[]): bigint {
  const cash = accounts.filter(a => a.isActive && a.type === 'ASSET' && (/^10/.test(a.code) || /\b(bank|cash)\b/i.test(a.name)));
  return sum(cash.map(a => paise(accountBalance(a, entries))));
}

function invoiceProbability(inv: Invoice, invoices: Invoice[], now: string): { probability: number; shiftedDate: string } {
  const customer = inv.customer.trim().toLowerCase();
  const paid = invoices.filter(x => x.customer.trim().toLowerCase() === customer && x.status === 'Paid' && x.paidOn);
  if (!paid.length) return { probability: 0.8, shiftedDate: inv.dueDate };
  const delays = paid.map(x => Math.max(0, daysBetween(x.dueDate, x.paidOn!)));
  const avgLate = Math.round(delays.reduce((a,b)=>a+b,0)/delays.length);
  const lateRate = delays.filter(x=>x>0).length / delays.length;
  const probability = Math.max(0.45, Math.min(0.98, 0.95 - lateRate * 0.35));
  return { probability, shiftedDate: addDays(inv.dueDate, avgLate) };
}

function detectRecurring(expenses: Expense[], now: string, overrides: Record<string,'accepted'|'rejected'> = {}): RecurringCandidate[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const key = `${e.vendor.trim().toLowerCase()}|${e.category.trim().toLowerCase()}`;
    const xs = groups.get(key) ?? []; xs.push(e); groups.set(key, xs);
  }
  const out: RecurringCandidate[] = [];
  for (const [key, xs] of groups) {
    xs.sort((a,b)=>a.date.localeCompare(b.date));
    if (xs.length < 3) continue;
    const gaps = xs.slice(1).map((x,i)=>daysBetween(xs[i]!.date,x.date));
    const interval = Math.round(median(gaps));
    if (interval < 7 || interval > 95) continue;
    const avg = xs.reduce((s,x)=>s+x.amount,0)/xs.length;
    const stable = xs.every(x=>Math.abs(x.amount-avg)/Math.max(avg,1) <= 0.2);
    if (!stable) continue;
    const id = `rec:${key}`;
    const nextDate = addDays(xs[xs.length-1]!.date, interval);
    out.push({ id, payee: xs[0]!.vendor, amountPaise: paise(avg), intervalDays: interval, occurrences: xs.length, nextDate, category: xs[0]!.category, status: overrides[id] ?? 'suggested' });
  }
  return out;
}

function historyMonthly(entries: JournalEntry[], accounts: Account[], now: string) {
  const cashIds = new Set(accounts.filter(a=>a.isActive && a.type==='ASSET' && (/^10/.test(a.code)||/\b(bank|cash)\b/i.test(a.name))).map(a=>a.id));
  const months = new Map<string,{inflow:bigint;outflow:bigint}>();
  for (let i=1;i<=12;i++) {
    const end=addDays(now,-i*30), start=addDays(end,-29), key=end.slice(0,7);
    let inflow=0n,outflow=0n;
    for(const e of entries) if(e.status==='Posted' && dateInRange(e.date,start,end)) for(const l of e.lines) if(cashIds.has(l.accountId)){ inflow+=paise(l.debit); outflow+=paise(l.credit); }
    months.set(key,{inflow,outflow});
  }
  return [...months.values()];
}

export function buildForecast(input: ForecastInput): Forecast {
  const now = input.now ?? new Date().toISOString().slice(0,10);
  const horizon = input.horizon ?? 30;
  const scenario = input.scenario ?? 'expected';
  const safety = input.safetyBufferPaise ?? 0n;
  const cashAccounts=input.accounts.filter(a=>a.isActive&&a.type==='ASSET'&&(/^10/.test(a.code)||/\b(bank|cash)\b/i.test(a.name))).map(a=>({id:a.id,name:a.name,balancePaise:paise(accountBalance(a,input.entries))}));
  const cash = sum(cashAccounts.map(a=>a.balancePaise));
  const recurring = detectRecurring(input.expenses,now,input.recurringOverrides);
  const limitedData = new Set(input.entries.map(e=>e.date.slice(0,7))).size < 3;
  const paidInvoices = input.invoices.filter(i=>i.status==='Paid' && i.paidOn);
  const openInvoices = input.invoices.filter(i=>invoiceStatus(i,now)==='Pending' || invoiceStatus(i,now)==='Overdue');
  const events: ForecastEvent[]=[];
  const gstLiability = input.invoices.filter(i=>i.status !== 'Paid').reduce((s,i)=>s + paise(Math.max(0, i.tax)), 0n);
  if (gstLiability > 0n) {
    const today = new Date(`${now}T00:00:00+05:30`);
    const due = new Date(today.getFullYear(), today.getMonth() + 1, 20);
    const dueDate = iso(due);
    if (dueDate > now && dueDate <= addDays(now, horizon)) events.push({ id:'tax:gst', date:dueDate, type:'tax', label:'Estimated GST liability on unpaid invoices', amountPaise:gstLiability, direction:'out', confidence:0.6 });
  }
  for(const inv of openInvoices){
    const total=paise(invoiceTotal(inv));
    const p=invoiceProbability(inv,input.invoices,now);
    const overdue=invoiceStatus(inv,now)==='Overdue';
    const probability=scenario==='best'?1:scenario==='worst'?(p.probability>=0.85?p.probability:0):p.probability;
    const modeledDate=scenario==='best'?inv.dueDate:(scenario==='expected'?p.shiftedDate:addDays(p.shiftedDate,7));
    const date = modeledDate <= now ? addDays(now,1) : modeledDate;
    if(probability>0 && dateInRange(date,addDays(now,1),addDays(now,horizon))) events.push({id:`inv:${inv.id}`,date,type:'invoice',label:`${overdue?'Overdue: ':''}${inv.number} — ${inv.customer}`,amountPaise:total*BigInt(Math.round(probability*100))/100n,direction:'in',confidence:probability,sourceId:inv.id,customer:inv.customer});
  }
  for(const r of recurring.filter(x=>x.status!=='rejected')){
    let d=r.nextDate;
    while(d<=addDays(now,horizon)){
      if(d>now) events.push({id:`${r.id}:${d}`,date:d,type:'recurring',label:`${r.payee} — ${r.category ?? 'Recurring'}`,amountPaise:r.amountPaise,direction:'out',confidence:r.status==='accepted'?0.98:0.8});
      d=addDays(d,r.intervalDays);
    }
  }
  const history=historyMonthly(input.entries,input.accounts,now);
  const avgOut=history.length?sum(history.map(x=>x.outflow))/BigInt(history.length):0n;
  if(!limitedData){
    // Transparent weighted moving average: recent months receive larger weights (12..1).
    const recurringVendors=new Set(recurring.map(r=>r.payee.trim().toLowerCase()));
    const monthly = new Map<string,bigint>();
    for(const e of input.expenses) { if(e.date>=addDays(now,-365) && !recurringVendors.has(e.vendor.trim().toLowerCase())) { const k=e.date.slice(0,7); monthly.set(k,(monthly.get(k)??0n)+paise(e.amount)); } }
    const months=[...monthly.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
    let weighted=0n, weights=0n;
    months.forEach(([_,amount],i)=>{const w=BigInt(i+1); weighted+=amount*w; weights+=w;});
    let monthlyBaseline=weights?weighted/weights:0n;
    // With 12+ months, apply a transparent seasonality multiplier for the current calendar month.
    if(months.length>=12){
      const currentMonth=now.slice(5,7);
      const sameMonth=months.filter(([k])=>k.slice(5,7)===currentMonth).map(([,v])=>v);
      const overall=months.reduce((a,[,v])=>a+v,0n)/BigInt(months.length);
      if(sameMonth.length && overall>0n) monthlyBaseline=(monthlyBaseline*sameMonth[sameMonth.length-1]!)/overall;
    }
    const dailyBaseline=monthlyBaseline/30n;
    if(dailyBaseline>0n){
      for(let i=1;i<=horizon;i++) events.push({id:`baseline-expense:${i}`,date:addDays(now,i),type:'expense',label:'Historical spending baseline',amountPaise:dailyBaseline,direction:'out',confidence:0.65});
    }
    // Historical cash receipts provide a non-invoice income baseline. Invoice receipts are modeled separately.
    const cashIds=new Set(input.accounts.filter(a=>a.isActive&&a.type==='ASSET'&&(/^10/.test(a.code)||/\b(bank|cash)\b/i.test(a.name))).map(a=>a.id));
    const cutoff=addDays(now,-180); let historicalIn=0n; let historicalDays=0;
    for(const e of input.entries) if(e.status==='Posted'&&e.date>=cutoff&&e.date<now){ for(const l of e.lines) if(cashIds.has(l.accountId)) historicalIn+=paise(l.debit); historicalDays=Math.max(historicalDays,daysBetween(cutoff,e.date)); }
    const dailyIn=historicalDays>30?historicalIn/BigInt(Math.max(historicalDays,1)):0n;
    if(dailyIn>0n) for(let i=1;i<=horizon;i++) events.push({id:`baseline-income:${i}`,date:addDays(now,i),type:'expense',label:'Historical cash-in baseline',amountPaise:dailyIn,direction:'in',confidence:0.55});
  }
  const points: ForecastPoint[]=[];
  let balance=cash;
  for(let i=0;i<=horizon;i++){
    const date=addDays(now,i);
    const dayEvents=events.filter(e=>e.date===date);
    const inflow=sum(dayEvents.filter(e=>e.direction==='in').map(e=>e.amountPaise));
    const outflow=sum(dayEvents.filter(e=>e.direction==='out').map(e=>e.amountPaise));
    balance += inflow-outflow;
    const band=sum(dayEvents.filter(e=>e.direction==='in').map(e=>e.amountPaise));
    points.push({date,balancePaise:balance,bestPaise:balance+band,worstPaise:balance-band,inflowPaise:inflow,outflowPaise:outflow});
  }
  const incoming=sum(events.filter(e=>e.direction==='in').map(e=>e.amountPaise));
  const outgoing=sum(events.filter(e=>e.direction==='out').map(e=>e.amountPaise));
  const projected=cash+incoming-outgoing;
  const reasons:string[]=[];
  if(limitedData) reasons.push('Less than 3 months of history is available; the forecast relies mainly on invoices and recurring items.');
  else reasons.push('Historical cash movement is available for baseline estimation.');
  if(paidInvoices.length>=3) reasons.push('Past invoice payment behaviour is available for probability weighting.');
  else reasons.push('There is limited customer payment history.');
  const confidence:Confidence=(!limitedData||paidInvoices.length>=5)?'High':(paidInvoices.length>=2?'Medium':'Low');
  const firstBelowZero=points.find(p=>p.balancePaise<0n)?.date;
  const firstBelowBuffer=points.find(p=>p.balancePaise<safety)?.date;
  const weeklyIn:{label:string;amountPaise:bigint}[]=[]; const weeklyOut:{label:string;amountPaise:bigint}[]=[];
  for(let w=0;w<Math.ceil(horizon/7);w++){const from=addDays(now,w*7+1),to=addDays(from,6); weeklyIn.push({label:from,amountPaise:sum(events.filter(e=>e.direction==='in'&&dateInRange(e.date,from,to)).map(e=>e.amountPaise))}); weeklyOut.push({label:from,amountPaise:sum(events.filter(e=>e.direction==='out'&&dateInRange(e.date,from,to)).map(e=>e.amountPaise))});}
  const monthlyBurn=avgOut;
  const runway=monthlyBurn>0n?Number((cash*100n)/monthlyBurn)/100:null;
  const insights:string[]=[];
  if(firstBelowBuffer) insights.push(`Projected balance may fall below the configured safety buffer around ${firstBelowBuffer}.`);
  if(openInvoices.length) insights.push(`${openInvoices.length} outstanding invoice${openInvoices.length>1?'s':''} are included using recorded due dates and available payment history.`);
  if(recurring.length) insights.push(`${recurring.filter(x=>x.status!=='rejected').length} recurring pattern${recurring.length>1?'s':''} are included; confirm suggested patterns before relying on them.`);
  return {generatedAt:now,horizon,scenario,currentCashPaise:cash,cashAccounts,expectedIncomingPaise:incoming,expectedExpensesPaise:outgoing,gstLiabilityPaise:gstLiability,projectedPositionPaise:projected,confidence,confidenceReasons:reasons,limitedData,points,events,recurring,weeklyCashIn:weeklyIn,weeklyCashOut:weeklyOut,firstBelowZero,firstBelowBuffer,monthlyBurnPaise:monthlyBurn,runwayMonths:runway,insights};
}

export function forecastToJSON(f: Forecast) {
  const replacer=(_:string,v:unknown)=>typeof v==='bigint'?v.toString():v;
  return JSON.parse(JSON.stringify(f,replacer));
}
