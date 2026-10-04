'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, Eye, FileText, Plus, Search, SlidersHorizontal, Trash2, X, ScanLine } from 'lucide-react';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { useFinova } from '@/lib/data/store';
import { expenseCategoryAccount, paymentMethods } from '@/lib/data/posting';
import { fmtDate, money, todayISO } from '@/lib/data/format';
import { useEscape } from '@/lib/use-escape';
import type { Expense } from '@/lib/data/types';

const categories = Object.keys(expenseCategoryAccount);
type Form = Omit<Expense, 'id'>;
const blank = (): Form => ({ date: todayISO(), category: '', vendor: '', description: '', amount: 0, paymentMethod: 'Bank Transfer', status: 'Pending', notes: '' });

export default function ExpensesPage() {
  const { expenses, addExpense, deleteExpense } = useFinova();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>(blank);
  useEffect(() => { setQuery(params.get('q') ?? ''); setCategory(params.get('category') ?? ''); setVendor(params.get('vendor') ?? ''); setStatus(params.get('status') ?? ''); setMethod(params.get('method') ?? ''); setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); setMin(params.get('min') ?? ''); setMax(params.get('max') ?? ''); if (params.get('open')) setSelectedId(params.get('open')); if (params.get('add')) { setForm({ ...blank(), amount: Number(params.get('amount')) || 0, vendor: params.get('vendor') ?? '', category: params.get('category') ?? '' }); setShowForm(true); } }, [params]);

  const selected = expenses.find((e) => e.id === selectedId) ?? null;
  const vendors = useMemo(() => [...new Set(expenses.map((e) => e.vendor))].sort(), [expenses]);
  const filtered = useMemo(() => expenses.filter((e) => {
    const hay = `${e.id} ${e.category} ${e.vendor} ${e.description}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (!category || e.category === category) && (!vendor || e.vendor === vendor) && (!date || e.date === date) && (!status || status.split(',').includes(e.status)) && (!method || e.paymentMethod === method) && (!from || e.date >= from) && (!to || e.date <= to) && (!min || e.amount >= Number(min)) && (!max || e.amount <= Number(max));
  }), [expenses, query, category, vendor, date, status, method, from, to, min, max]);

  const totalOf = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);
  const paid = expenses.filter((e) => e.status === 'Paid');
  const pending = expenses.filter((e) => e.status === 'Pending');

  function save() {
    if (!form.date || !form.category || !form.vendor.trim() || !form.description.trim() || !(form.amount > 0)) {
      setError('Complete date, category, vendor, description, and a positive amount.'); return;
    }
    const created = addExpense({ ...form, vendor: form.vendor.trim(), description: form.description.trim() });
    setShowForm(false); setError(''); setSelectedId(created.id);
    setFeedback('Expense added and posted to the journal.');
  }
  const remove = (id: string) => {
    if (!window.confirm('Delete this expense and its journal posting?')) return;
    deleteExpense(id); setSelectedId(null); setFeedback('Expense deleted.');
  };

  useEscape(() => { setShowForm(false); setSelectedId(null); });

  return (
    <FinanceModuleShell active="expenses">
      <div className="page finance-page">
        <div className="hero-row">
          <div><p className="eyebrow"><FileText size={15}/> Payables & spending</p><h1>Expenses</h1><p className="hero-subtitle">Capture business spending, payment details, and accounting-ready expense records.</p></div>
          <a className="secondary-button" href="/receipt-scanner"><ScanLine size={18}/> Scan Receipt</a><button className="primary-button" onClick={() => { setForm(blank()); setShowForm(true); setError(''); setFeedback(''); }}><Plus size={19}/> Add Expense</button>
        </div>

        <div className="finance-summary three">
          <div className="panel summary-card"><span>Total expenses</span><strong>{money(totalOf(expenses))}</strong><small>{expenses.length} records</small></div>
          <div className="panel summary-card paid"><span>Paid</span><strong>{money(totalOf(paid))}</strong><small>{paid.length} records</small></div>
          <div className="panel summary-card pending"><span>Pending</span><strong>{money(totalOf(pending))}</strong><small>{pending.length} records</small></div>
        </div>

        {(params.get('from') || params.get('category') || params.get('min') || params.get('q')) && <div className="nlq-source-banner">Showing Expenses from your search{params.get('category') ? ` · ${params.get('category')}` : ''}{params.get('from') ? ` · ${params.get('from')}–${params.get('to') ?? ''}` : ''} — <button onClick={() => { setQuery(''); setCategory(''); setVendor(''); setStatus(''); setMethod(''); setFrom(''); setTo(''); setMin(''); setMax(''); }}>Clear filters</button></div>}
        <section className="panel finance-toolbar">
          <div className="journal-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expense, vendor, category..."/></div>
          <div className="filter-group">
            <label><SlidersHorizontal size={15}/><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><FileText size={15}/><select value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Filter by vendor"><option value="">All vendors</option>{vendors.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><CalendarDays size={15}/><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date"/></label>
            <label><Check size={15}/><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by payment status"><option value="">All payment status</option><option>Paid</option><option>Pending</option></select></label>
            {(query || category || vendor || date || status || method || from || to || min || max) && <button className="clear-filter" onClick={() => { setQuery(''); setCategory(''); setVendor(''); setDate(''); setStatus(''); setMethod(''); setFrom(''); setTo(''); setMin(''); setMax(''); }}>Clear</button>}
          </div>
        </section>
        {feedback && <div className="finance-feedback" role="status"><Check size={15}/>{feedback}</div>}

        <section className="panel journal-table-panel">
          <div className="journal-panel-head"><div><h2>Expense Register</h2><p>{filtered.length} expenses shown · {money(totalOf(filtered))} filtered spend</p></div></div>
          <div className="journal-table-wrap">
            <table className="journal-table finance-table">
              <thead><tr><th>Date</th><th>Expense ID</th><th>Category</th><th>Vendor</th><th>Description</th><th className="amount">Amount</th><th>Payment Status</th><th className="actions">Actions</th></tr></thead>
              <tbody>
                {filtered.map((e) => <tr className="journal-row" key={e.id} onClick={() => setSelectedId(e.id)}>
                  <td>{fmtDate(e.date)}</td><td><strong>{e.id}</strong></td><td>{e.category}</td><td>{e.vendor}</td><td>{e.description}</td>
                  <td className="amount">{money(e.amount)}</td>
                  <td><span className={`status-pill ${e.status.toLowerCase()}`}>{e.status}</span></td>
                  <td className="actions"><button title="View" aria-label={`View ${e.id}`} onClick={(ev) => { ev.stopPropagation(); setSelectedId(e.id); }}><Eye size={15}/></button><button title="Delete" aria-label={`Delete ${e.id}`} onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}><Trash2 size={15}/></button></td>
                </tr>)}
                {!filtered.length && <tr><td colSpan={8} className="empty-state"><FileText size={26}/><strong>No expenses found</strong><span>Try changing your search or filters.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && <div className="journal-overlay">
        <section className="journal-modal finance-modal" role="dialog" aria-modal="true" aria-label="Add expense">
          <div className="modal-head"><div><p className="eyebrow">Expense capture</p><h2>Add Expense</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X size={19}/></button></div>
          <div className="form-grid">
            <label>Expense date<input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/></label>
            <label>Category<select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}><option value="">Select category</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Vendor<input list="vendor-list" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Select or type a vendor"/><datalist id="vendor-list">{vendors.map((x) => <option key={x} value={x}/>)}</datalist></label>
            <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}/></label>
            <label className="full">Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What was purchased?"/></label>
            <label>Payment method<select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>{paymentMethods.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Payment status<select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Expense['status'] }))}><option>Pending</option><option>Paid</option></select></label>
            <label className="full">Notes<input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional internal note"/></label>
          </div>
          {error && <div className="validation-error" role="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" onClick={save}>Save expense</button></div>
        </section>
      </div>}

      {selected && <div className="journal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <section className="journal-detail finance-detail" role="dialog" aria-modal="true" aria-label="Expense details">
          <div className="modal-head"><div><p className="eyebrow">Expense details</p><h2>{selected.id}</h2></div><button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close"><X size={19}/></button></div>
          <div className="detail-meta"><div><span>Date</span><strong>{fmtDate(selected.date)}</strong></div><div><span>Category</span><strong>{selected.category}</strong></div><div><span>Vendor</span><strong>{selected.vendor}</strong></div><div><span>Amount</span><strong>{money(selected.amount)}</strong></div><div><span>Payment</span><strong>{selected.paymentMethod}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div></div>
          <div className="detail-description"><strong>{selected.description}</strong>{selected.notes && <><br/><span>{selected.notes}</span></>}</div>
          <div className="invoice-detail-summary"><span>Accounting source <strong>EXPENSE</strong></span><span>Journal status <strong>Posted</strong></span></div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedId(null)}>Close</button><button className="danger-button" onClick={() => remove(selected.id)}><Trash2 size={14}/> Delete</button></div>
        </section>
      </div>}
    </FinanceModuleShell>
  );
}
