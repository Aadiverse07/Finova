'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, CalendarDays, Check, Eye, FileText, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { isBalancedJournal, journalTotals } from '@/lib/ledger/journal-validation';
import { useFinova } from '@/lib/data/store';
import { fmtDate, money, todayISO, uid } from '@/lib/data/format';
import { useEscape } from '@/lib/use-escape';
import type { JournalEntry } from '@/lib/data/types';

type FormLine = { id: string; accountId: string; debit: string; credit: string };
const blankLine = (): FormLine => ({ id: uid(), accountId: '', debit: '', credit: '' });
const blankForm = () => ({ date: todayISO(), reference: '', description: '', lines: [blankLine(), blankLine()] });
const totalOf = (e: JournalEntry) => e.lines.reduce((s, l) => s + l.debit, 0);

export default function JournalPage() {
  const { accounts, entries, addEntry } = useFinova();
  const params = useSearchParams();
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [min, setMin] = useState(''); const [max, setMax] = useState('');
  const [form, setForm] = useState(blankForm);
  useEffect(() => { setQuery(params.get('q') ?? ''); setAccountFilter(params.get('account') ?? ''); setSourceFilter(params.get('source') ?? ''); setStatus(params.get('status')?.split(',')[0] ?? ''); setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); setMin(params.get('min') ?? ''); setMax(params.get('max') ?? ''); if (params.get('add') === '1') { setForm(blankForm()); setShowForm(true); } if (params.get('open')) { const e=entries.find(x=>x.id===params.get('open') || x.reference===params.get('open')); if(e) setSelected(e); } }, [params, entries]);
  const [error, setError] = useState('');

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true })),
    [entries],
  );
  const filtered = useMemo(() => sorted.filter((e) => {
    const names = new Map(accounts.map((a) => [a.id, a.name]));
    const haystack = `${e.id} ${e.reference} ${e.description} ${e.lines.map((l) => names.get(l.accountId) ?? l.accountId).join(' ')}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!date || e.date === date)
      && (!accountFilter || e.lines.some((l) => l.accountId === accountFilter))
      && (!sourceFilter || e.source === sourceFilter)
      && (!status || status.split(',').includes(e.status)) && (!from || e.date >= from) && (!to || e.date <= to) && (!min || e.lines.some(l => Math.max(l.debit,l.credit) >= Number(min))) && (!max || e.lines.some(l => Math.max(l.debit,l.credit) <= Number(max)));
  }), [sorted, query, date, accountFilter, sourceFilter, status, accounts, from, to, min, max]);

  const { debit: formDebit, credit: formCredit } = journalTotals(form.lines);
  const balanced = isBalancedJournal(form.lines);

  function updateLine(id: string, patch: Partial<FormLine>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }

  function saveEntry(entryStatus: 'Posted' | 'Draft') {
    if (!form.date || !form.description.trim()) { setError('Enter a date and a description.'); return; }
    if (form.lines.some((l) => !l.accountId)) { setError('Select an account on every line.'); return; }
    if (form.lines.some((l) => !(Number(l.debit) > 0) && !(Number(l.credit) > 0))) { setError('Every line needs a debit or a credit amount.'); return; }
    if (!balanced) { setError('Entry is not balanced. Total Debit must equal Total Credit.'); return; }
    const created = addEntry({
      date: form.date,
      reference: form.reference.trim() || `MAN-${entries.length + 1}`,
      description: form.description.trim(),
      status: entryStatus,
      source: 'MANUAL',
      lines: form.lines.map((l, i) => ({ id: `l${i + 1}`, accountId: l.accountId, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })),
    });
    setSelected(created); setShowForm(false); setError(''); setForm(blankForm());
  }

  useEscape(() => { setShowForm(false); setSelected(null); });

  return (
    <FinanceModuleShell active="journal">
      <div className="page journal-page">
        <div className="hero-row">
          <div><p className="eyebrow"><FileText size={15}/> Accounting workspace</p><h1>Transactions & Journal</h1><p className="hero-subtitle">Record, review, and manage balanced double-entry journal transactions.</p></div>
          <button className="primary-button" onClick={() => { setForm(blankForm()); setShowForm(true); setError(''); }}><Plus size={19}/> Add Journal Entry</button>
        </div>

        {(params.get('from') || params.get('account') || params.get('source') || params.get('min') || params.get('q')) && <div className="nlq-source-banner">Showing Transactions from your search{params.get('source') ? ` · ${params.get('source')}` : ''}{params.get('from') ? ` · ${params.get('from')}–${params.get('to') ?? ''}` : ''} — <button onClick={() => { setQuery(''); setAccountFilter(''); setSourceFilter(''); setStatus(''); setFrom(''); setTo(''); setMin(''); setMax(''); }}>Clear filters</button></div>}
        <section className="panel journal-toolbar">
          <div className="journal-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search description, reference, or account..."/></div>
          <div className="filter-group">
            <label><CalendarDays size={15}/><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date"/></label>
            <label><BookOpen size={15}/><select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="Filter by account"><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label><SlidersHorizontal size={15}/><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All status</option><option>Posted</option><option>Draft</option></select></label>
            {(query || date || accountFilter || sourceFilter || status || from || to || min || max) && <button className="clear-filter" onClick={() => { setQuery(''); setDate(''); setAccountFilter(''); setSourceFilter(''); setStatus(''); setFrom(''); setTo(''); setMin(''); setMax(''); }}>Clear</button>}
          </div>
        </section>

        <section className="panel journal-table-panel">
          <div className="journal-panel-head"><div><h2>Journal Entries</h2><p>{filtered.length} entries shown · Double-entry ledger</p></div><span className="balanced-chip"><Check size={14}/> Balanced</span></div>
          <div className="journal-table-wrap">
            <table className="journal-table">
              <thead><tr><th>Date</th><th>Reference / Entry ID</th><th>Description</th><th>Account</th><th className="amount">Debit</th><th className="amount">Credit</th><th className="amount">Amount</th><th>Status</th><th className="actions">Actions</th></tr></thead>
              <tbody>
                {filtered.map((e) => <tr key={e.id} onClick={() => setSelected(e)} className="journal-row">
                  <td>{fmtDate(e.date)}</td>
                  <td><strong>{e.reference}</strong><small>{e.id} · {e.source}</small></td>
                  <td>{e.description}</td>
                  <td><div className="account-stack">{e.lines.map((l) => <span key={l.id}>{nameOf(l.accountId)}</span>)}</div></td>
                  <td className="amount"><div className="account-stack">{e.lines.map((l) => <span key={l.id}>{l.debit ? money(l.debit) : '—'}</span>)}</div></td>
                  <td className="amount"><div className="account-stack">{e.lines.map((l) => <span key={l.id}>{l.credit ? money(l.credit) : '—'}</span>)}</div></td>
                  <td className="amount"><strong>{money(totalOf(e))}</strong></td>
                  <td><span className={`status-pill ${e.status.toLowerCase()}`}>{e.status}</span></td>
                  <td className="actions"><button aria-label={`View ${e.id}`} onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}><Eye size={16}/></button></td>
                </tr>)}
                {!filtered.length && <tr><td colSpan={9} className="empty-state"><FileText size={26}/><strong>No journal entries found</strong><span>Try changing your search or filters.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && <div className="journal-overlay" role="presentation">
        <section className="journal-modal" role="dialog" aria-modal="true" aria-labelledby="journal-form-title">
          <div className="modal-head"><div><p className="eyebrow">Manual posting</p><h2 id="journal-form-title">Add Journal Entry</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X size={19}/></button></div>
          <div className="form-grid">
            <label>Transaction date<input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/></label>
            <label>Reference<input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="e.g. ADJ-005"/></label>
            <label className="full">Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the transaction"/></label>
          </div>
          <div className="lines-head"><h3>Journal lines</h3><button className="text-button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}><Plus size={15}/> Add line</button></div>
          <div className="line-list">
            {form.lines.map((l, i) => <div className="entry-line" key={l.id}>
              <span className="line-number">{i + 1}</span>
              <select value={l.accountId} onChange={(e) => updateLine(l.id, { accountId: e.target.value })} aria-label={`Account line ${i + 1}`}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
              <input inputMode="decimal" type="number" min="0" step="0.01" value={l.debit} onChange={(e) => updateLine(l.id, { debit: e.target.value, credit: '' })} placeholder="Debit" aria-label={`Debit line ${i + 1}`}/>
              <input inputMode="decimal" type="number" min="0" step="0.01" value={l.credit} onChange={(e) => updateLine(l.id, { credit: e.target.value, debit: '' })} placeholder="Credit" aria-label={`Credit line ${i + 1}`}/>
              <button className="icon-delete" disabled={form.lines.length <= 2} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))} aria-label={`Remove line ${i + 1}`}><Trash2 size={15}/></button>
            </div>)}
          </div>
          <div className="entry-total"><span>Total Debit <strong>{money(formDebit)}</strong></span><span>Total Credit <strong>{money(formCredit)}</strong></span><span className={balanced ? 'balance-ok' : 'balance-error'}>{balanced ? <><Check size={14}/> Balanced</> : <>Debit must equal Credit</>}</span></div>
          {error && <div className="validation-error" role="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="secondary-button" disabled={!balanced} onClick={() => saveEntry('Draft')}>Save as draft</button><button className="primary-button" disabled={!balanced} onClick={() => saveEntry('Posted')}>Post entry</button></div>
        </section>
      </div>}

      {selected && <div className="journal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        <section className="journal-detail" role="dialog" aria-modal="true" aria-labelledby="journal-detail-title">
          <div className="modal-head"><div><p className="eyebrow">Journal details</p><h2 id="journal-detail-title">{selected.id}</h2></div><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={19}/></button></div>
          <div className="detail-meta"><div><span>Date</span><strong>{fmtDate(selected.date)}</strong></div><div><span>Reference</span><strong>{selected.reference}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div></div>
          <div className="detail-description">{selected.description}</div>
          <div className="detail-lines">{selected.lines.map((l) => <div className="detail-line" key={l.id}><span>{nameOf(l.accountId)}</span><strong>{l.debit ? money(l.debit) : '—'}</strong><strong>{l.credit ? money(l.credit) : '—'}</strong></div>)}</div>
          <div className="detail-total"><span>Total amount</span><strong>{money(totalOf(selected))}</strong></div>
        </section>
      </div>}
    </FinanceModuleShell>
  );
}
