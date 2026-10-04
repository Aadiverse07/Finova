'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, BookOpen, CalendarDays, Check, CircleAlert, FileText, Scale, TrendingUp } from 'lucide-react';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { useFinova } from '@/lib/data/store';
import { balanceSheet, ledgerFor, profitAndLoss, trialBalance } from '@/lib/data/calc';
import { fmtDate, money, todayISO } from '@/lib/data/format';

type Tab = 'ledger' | 'trial' | 'pnl' | 'balance';
const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'trial', label: 'Trial Balance', icon: Scale },
  { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'balance', label: 'Balance Sheet', icon: BarChart3 },
];

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
function presets(today: string) {
  const y = Number(today.slice(0, 4));
  const fyYear = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  const prev = new Date(`${monthStart(today)}T00:00:00`);
  prev.setDate(0);
  const prevIso = prev.toLocaleDateString('en-CA');
  return [
    { label: 'This month', from: monthStart(today), to: today },
    { label: 'Last month', from: monthStart(prevIso), to: prevIso },
    { label: 'Financial year', from: `${fyYear}-04-01`, to: today },
    { label: 'All time', from: '', to: '' },
  ];
}

const Summary = ({ items }: { items: { label: string; value: string; tone?: string }[] }) => (
  <div className="finance-summary">
    {items.map((i) => <div key={i.label} className={`panel summary-card ${i.tone ?? ''}`}><span>{i.label}</span><strong>{i.value}</strong></div>)}
  </div>
);

export default function ReportsPage() {
  const { accounts, entries } = useFinova();
  const params = useSearchParams();
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('ledger');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [accountId, setAccountId] = useState('1001');
  useEffect(() => { if (params.get('tab')) setTab(params.get('tab') as Tab); if (params.get('account')) setAccountId(params.get('account')!); else if (params.get('open')) setAccountId(params.get('open')!); setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); }, [params]);
  const dateError = from && to && from > to ? 'The "from" date cannot be after the "to" date.' : '';
  const f = dateError ? '' : from;
  const t = dateError ? '' : to;
  const periodLabel = `${f ? fmtDate(f) : 'Beginning'} – ${t ? fmtDate(t) : 'Today'}`;
  const asOfLabel = t ? fmtDate(t) : fmtDate(today);

  const ledger = useMemo(() => {
    const a = accounts.find((x) => x.id === accountId) ?? accounts[0];
    return a ? { account: a, ...ledgerFor(a, entries, f || undefined, t || undefined) } : null;
  }, [accounts, entries, accountId, f, t]);
  const tb = useMemo(() => trialBalance(accounts, entries, t || undefined), [accounts, entries, t]);
  const pl = useMemo(() => profitAndLoss(accounts, entries, f || undefined, t || undefined), [accounts, entries, f, t]);
  const bs = useMemo(() => balanceSheet(accounts, entries, t || undefined), [accounts, entries, t]);

  return (
    <FinanceModuleShell active="reports">
      <div className="page finance-page">
        <div className="hero-row">
          <div><p className="eyebrow"><FileText size={15}/> Financial statements</p><h1>Reports</h1><p className="hero-subtitle">Ledger, trial balance, profit & loss and balance sheet, computed from posted journal entries.</p></div>
        </div>

        {(params.get('from') || params.get('to') || params.get('account') || params.get('tab') || params.get('open')) && <div className="nlq-source-banner">Showing Reports from your search — <button onClick={() => { setFrom(''); setTo(''); setAccountId(accounts[0]?.id ?? ''); }}>Clear filters</button></div>}
        <section className="panel finance-toolbar report-toolbar">
          <div className="report-tabs" role="tablist" aria-label="Report type">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15}/>{label}</button>)}
          </div>
          <div className="filter-group">
            <label><CalendarDays size={15}/><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date"/></label>
            <label><CalendarDays size={15}/><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date"/></label>
            {tab === 'ledger' && <label><BookOpen size={15}/><select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Ledger account">{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>}
          </div>
        </section>
        <div className="preset-row">{presets(today).map((p) => <button key={p.label} className="preset-chip" onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>)}</div>
        {dateError && <div className="validation-error" role="alert">{dateError}</div>}

        {tab === 'ledger' && ledger && <>
          <Summary items={[
            { label: 'Opening balance', value: money(ledger.opening) }, { label: 'Total debit', value: money(ledger.debit) },
            { label: 'Total credit', value: money(ledger.credit) }, { label: 'Closing balance', value: money(ledger.closing), tone: 'paid' },
          ]}/>
          <section className="panel journal-table-panel">
            <div className="journal-panel-head"><div><h2>{ledger.account.code} · {ledger.account.name}</h2><p>General ledger · {periodLabel} · balance shown as {ledger.account.normalBalance === 'DEBIT' ? 'debit-positive' : 'credit-positive'}</p></div></div>
            <div className="journal-table-wrap"><table className="journal-table report-table">
              <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="amount">Debit</th><th className="amount">Credit</th><th className="amount">Balance</th></tr></thead>
              <tbody>
                <tr className="report-subtotal"><td colSpan={5}>Opening balance</td><td className="amount">{money(ledger.opening)}</td></tr>
                {ledger.rows.map((r) => <tr key={r.key}><td>{fmtDate(r.date)}</td><td>{r.reference}</td><td>{r.description}</td><td className="amount">{r.debit ? money(r.debit) : '—'}</td><td className="amount">{r.credit ? money(r.credit) : '—'}</td><td className="amount">{money(r.balance)}</td></tr>)}
                {!ledger.rows.length && <tr><td colSpan={6} className="empty-state"><FileText size={26}/><strong>No postings in this period</strong><span>Adjust the date range or pick another account.</span></td></tr>}
                <tr className="report-total"><td colSpan={3}>Closing balance</td><td className="amount">{money(ledger.debit)}</td><td className="amount">{money(ledger.credit)}</td><td className="amount">{money(ledger.closing)}</td></tr>
              </tbody>
            </table></div>
          </section>
        </>}

        {tab === 'trial' && <>
          <Summary items={[
            { label: 'Total debit', value: money(tb.debit) }, { label: 'Total credit', value: money(tb.credit) },
            { label: 'Difference', value: money(tb.difference), tone: tb.balanced ? 'paid' : 'overdue' },
          ]}/>
          <section className="panel journal-table-panel">
            <div className="journal-panel-head"><div><h2>Trial Balance</h2><p>As of {asOfLabel} · {tb.rows.length} accounts with activity</p></div><span className={tb.balanced ? 'balanced-chip' : 'balanced-chip bad'}>{tb.balanced ? <><Check size={14}/> Balanced</> : <><CircleAlert size={14}/> Out of balance</>}</span></div>
            <div className="journal-table-wrap"><table className="journal-table report-table">
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="amount">Debit</th><th className="amount">Credit</th></tr></thead>
              <tbody>
                {tb.rows.map((r) => <tr key={r.account.id}><td>{r.account.code}</td><td>{r.account.name}</td><td>{r.account.type}</td><td className="amount">{r.debit ? money(r.debit) : '—'}</td><td className="amount">{r.credit ? money(r.credit) : '—'}</td></tr>)}
                {!tb.rows.length && <tr><td colSpan={5} className="empty-state"><FileText size={26}/><strong>No postings found</strong><span>Adjust the date range.</span></td></tr>}
                <tr className="report-total"><td colSpan={3}>Total</td><td className="amount">{money(tb.debit)}</td><td className="amount">{money(tb.credit)}</td></tr>
              </tbody>
            </table></div>
          </section>
        </>}

        {tab === 'pnl' && <>
          <Summary items={[
            { label: 'Total revenue', value: money(pl.totalIncome), tone: 'paid' }, { label: 'Total expenses', value: money(pl.totalExpenses), tone: 'pending' },
            { label: pl.netProfit >= 0 ? 'Net profit' : 'Net loss', value: money(pl.netProfit), tone: pl.netProfit >= 0 ? 'paid' : 'overdue' }, { label: 'Net margin', value: `${pl.margin.toFixed(1)}%` },
          ]}/>
          <section className="panel journal-table-panel">
            <div className="journal-panel-head"><div><h2>Profit & Loss</h2><p>{periodLabel}</p></div></div>
            <div className="journal-table-wrap"><table className="journal-table report-table narrow">
              <thead><tr><th>Account</th><th className="amount">Amount</th></tr></thead>
              <tbody>
                <tr className="report-section"><td colSpan={2}>Revenue</td></tr>
                {pl.income.map((r) => <tr key={r.account.id}><td>{r.account.code} · {r.account.name}</td><td className="amount">{money(r.amount)}</td></tr>)}
                {!pl.income.length && <tr><td colSpan={2} className="report-empty">No revenue in this period</td></tr>}
                <tr className="report-subtotal"><td>Total revenue</td><td className="amount">{money(pl.totalIncome)}</td></tr>
                <tr className="report-section"><td colSpan={2}>Expenses</td></tr>
                {pl.expenses.map((r) => <tr key={r.account.id}><td>{r.account.code} · {r.account.name}</td><td className="amount">{money(r.amount)}</td></tr>)}
                {!pl.expenses.length && <tr><td colSpan={2} className="report-empty">No expenses in this period</td></tr>}
                <tr className="report-subtotal"><td>Total expenses</td><td className="amount">{money(pl.totalExpenses)}</td></tr>
                <tr className="report-total"><td>{pl.netProfit >= 0 ? 'Net profit' : 'Net loss'}</td><td className="amount">{money(pl.netProfit)}</td></tr>
              </tbody>
            </table></div>
          </section>
        </>}

        {tab === 'balance' && <>
          <Summary items={[
            { label: 'Total assets', value: money(bs.totalAssets) }, { label: 'Total liabilities', value: money(bs.totalLiabilities) },
            { label: 'Total equity', value: money(bs.totalEquity) }, { label: 'Assets − (Liabilities + Equity)', value: money(bs.totalAssets - bs.totalLiabilities - bs.totalEquity), tone: bs.balanced ? 'paid' : 'overdue' },
          ]}/>
          <section className="panel journal-table-panel">
            <div className="journal-panel-head"><div><h2>Balance Sheet</h2><p>As of {asOfLabel}</p></div><span className={bs.balanced ? 'balanced-chip' : 'balanced-chip bad'}>{bs.balanced ? <><Check size={14}/> Balanced</> : <><CircleAlert size={14}/> Out of balance</>}</span></div>
            <div className="journal-table-wrap"><table className="journal-table report-table narrow">
              <thead><tr><th>Account</th><th className="amount">Amount</th></tr></thead>
              <tbody>
                <tr className="report-section"><td colSpan={2}>Assets</td></tr>
                {bs.assets.map((r) => <tr key={r.account.id}><td>{r.account.code} · {r.account.name}</td><td className="amount">{money(r.amount)}</td></tr>)}
                <tr className="report-subtotal"><td>Total assets</td><td className="amount">{money(bs.totalAssets)}</td></tr>
                <tr className="report-section"><td colSpan={2}>Liabilities</td></tr>
                {bs.liabilities.map((r) => <tr key={r.account.id}><td>{r.account.code} · {r.account.name}</td><td className="amount">{money(r.amount)}</td></tr>)}
                <tr className="report-subtotal"><td>Total liabilities</td><td className="amount">{money(bs.totalLiabilities)}</td></tr>
                <tr className="report-section"><td colSpan={2}>Equity</td></tr>
                {bs.equity.map((r) => <tr key={r.account.id}><td>{r.account.code} · {r.account.name}</td><td className="amount">{money(r.amount)}</td></tr>)}
                <tr><td>Current period earnings</td><td className="amount">{money(bs.currentEarnings)}</td></tr>
                <tr className="report-subtotal"><td>Total equity</td><td className="amount">{money(bs.totalEquity)}</td></tr>
                <tr className="report-total"><td>Liabilities + Equity</td><td className="amount">{money(bs.totalLiabilities + bs.totalEquity)}</td></tr>
              </tbody>
            </table></div>
          </section>
        </>}
      </div>
    </FinanceModuleShell>
  );
}
