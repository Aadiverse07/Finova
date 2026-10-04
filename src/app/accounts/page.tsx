'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Plus, Search, X } from 'lucide-react';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { useFinova } from '@/lib/data/store';
import { accountBalance } from '@/lib/data/calc';
import { money } from '@/lib/data/format';
import { useEscape } from '@/lib/use-escape';
import type { AccountType } from '@/lib/data/types';

const groups: { type: AccountType; label: string }[] = [
  { type: 'ASSET', label: 'Assets' }, { type: 'LIABILITY', label: 'Liabilities' }, { type: 'EQUITY', label: 'Equity' },
  { type: 'INCOME', label: 'Revenue' }, { type: 'EXPENSE', label: 'Expenses' },
];
const labelOf = (t: AccountType) => groups.find((g) => g.type === t)?.label ?? t;
const emptyForm = { code: '', name: '', type: 'ASSET' as AccountType, description: '' };

export default function AccountsPage() {
  const { accounts, entries, addAccount } = useFinova();
  const params = useSearchParams();
  const [type, setType] = useState<AccountType | ''>('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  useEffect(() => { setQuery(params.get('account') ?? params.get('q') ?? params.get('open') ?? ''); }, [params]);

  const rows = useMemo(() => accounts.map((a) => ({ ...a, balance: accountBalance(a, entries) })), [accounts, entries]);
  const totals = (t: AccountType) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.balance, 0);
  const filtered = rows.filter((r) => (!type || r.type === type) && (!query || `${r.code} ${r.name} ${r.description}`.toLowerCase().includes(query.toLowerCase())));

  function save() {
    const code = form.code.trim();
    if (!/^\d{3,6}$/.test(code)) { setError('Account code must be 3–6 digits.'); return; }
    if (!form.name.trim()) { setError('Enter an account name.'); return; }
    if (accounts.some((a) => a.code === code)) { setError('An account with this code already exists.'); return; }
    addAccount({ code, name: form.name.trim(), type: form.type, description: form.description.trim(), normalBalance: form.type === 'ASSET' || form.type === 'EXPENSE' ? 'DEBIT' : 'CREDIT' });
    setShowForm(false); setForm(emptyForm); setError('');
  }

  useEscape(() => setShowForm(false));

  return (
    <FinanceModuleShell active="accounts">
      <div className="page finance-page">
        <div className="hero-row">
          <div><p className="eyebrow"><BookOpen size={15}/> Accounting setup</p><h1>Chart of Accounts</h1><p className="hero-subtitle">Every account used for double-entry posting, with live balances from the journal.</p></div>
          <button className="primary-button" onClick={() => { setForm(emptyForm); setError(''); setShowForm(true); }}><Plus size={19}/> Add Account</button>
        </div>

        <div className="finance-summary five">
          {groups.map((g) => <button key={g.type} className={`panel summary-card selectable ${type === g.type ? 'selected' : ''}`} onClick={() => setType(type === g.type ? '' : g.type)}><span>{g.label}</span><strong>{money(totals(g.type))}</strong><small>{rows.filter((r) => r.type === g.type).length} accounts</small></button>)}
        </div>

        {(params.get('account') || params.get('open') || params.get('q')) && <div className="nlq-source-banner">Showing Accounts from your search — <button onClick={() => setQuery('')}>Clear filters</button></div>}
        <section className="panel finance-toolbar">
          <div className="journal-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, name, or description..."/></div>
          <div className="filter-group">{type && <button className="clear-filter" onClick={() => setType('')}>Show all types</button>}</div>
        </section>

        <section className="panel journal-table-panel">
          <div className="journal-panel-head"><div><h2>Accounts</h2><p>{filtered.length} accounts shown</p></div></div>
          <div className="journal-table-wrap"><table className="journal-table report-table">
            <thead><tr><th>Account Code</th><th>Account Name</th><th>Account Type</th><th>Normal Balance</th><th>Status</th><th className="amount">Balance</th></tr></thead>
            <tbody>
              {filtered.map((r) => <tr key={r.id}>
                <td><strong>{r.code}</strong></td><td>{r.name}<small className="cell-sub">{r.description}</small></td>
                <td><span className={`type-chip ${r.type.toLowerCase()}`}>{labelOf(r.type)}</span></td><td>{r.normalBalance === 'DEBIT' ? 'Debit' : 'Credit'}</td>
                <td><span className={`status-pill ${r.isActive ? 'paid' : 'draft'}`}>{r.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="amount">{money(r.balance)}</td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={6} className="empty-state"><BookOpen size={26}/><strong>No accounts found</strong><span>Try changing your search or type filter.</span></td></tr>}
            </tbody>
          </table></div>
        </section>
      </div>

      {showForm && <div className="journal-overlay">
        <section className="journal-modal finance-modal" role="dialog" aria-modal="true" aria-label="Add account">
          <div className="modal-head"><div><p className="eyebrow">Accounting setup</p><h2>Add Account</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X size={19}/></button></div>
          <div className="form-grid">
            <label>Account code<input inputMode="numeric" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 5600"/></label>
            <label>Account type<select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}>{groups.map((g) => <option key={g.type} value={g.type}>{g.label}</option>)}</select></label>
            <label className="full">Account name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Bank Charges"/></label>
            <label className="full">Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional"/></label>
          </div>
          {error && <div className="validation-error" role="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" onClick={save}>Save account</button></div>
        </section>
      </div>}
    </FinanceModuleShell>
  );
}
