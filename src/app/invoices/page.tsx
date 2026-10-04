'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, Download, Edit3, Eye, FileText, Plus, Receipt, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { FinanceModuleShell } from '@/components/finance-module-shell';
import { useFinova } from '@/lib/data/store';
import { invoiceStatus, invoiceSubtotal, invoiceTotal, nextInvoiceNumber } from '@/lib/data/calc';
import { addDays, fmtDate, money, todayISO, uid } from '@/lib/data/format';
import { useEscape } from '@/lib/use-escape';
import type { Invoice, InvoiceLine } from '@/lib/data/types';
import { useCustomers } from '@/lib/customers/store';
import { downloadInvoicePdf } from '@/lib/pdf/invoice-pdf';

const blankLine = (): InvoiceLine => ({ id: uid(), description: '', quantity: '1', unitPrice: '' });
const blankInvoice = (number: string): Invoice => ({ id: '', number, customer: '', date: todayISO(), dueDate: addDays(todayISO(), 14), lines: [blankLine()], tax: 0, discount: 0, status: 'Draft', notes: '' });

export default function InvoicesPage() {
  const { invoices, saveInvoice, markInvoicePaid, cancelInvoice } = useFinova();
  const customerRecords = useCustomers((s) => s.customers);
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [dueFrom, setDueFrom] = useState(''); const [dueTo, setDueTo] = useState(''); const [min, setMin] = useState(''); const [max, setMax] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<Invoice>(() => blankInvoice('INV-2026-001'));
  useEffect(() => { setQuery(params.get('q') ?? ''); setStatus(params.get('status') ?? ''); setCustomer(params.get('customer') ?? ''); setDate(''); setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); setDueFrom(params.get('dueFrom') ?? ''); setDueTo(params.get('dueTo') ?? ''); setMin(params.get('min') ?? ''); setMax(params.get('max') ?? ''); if (params.get('open')) setSelectedId(params.get('open')); }, [params]);

  useEffect(() => { if (params.get('add') !== '1') return; setEditing(false); setForm(blankInvoice(nextInvoiceNumber(invoices))); setShowForm(true); setError(''); setFeedback(''); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const today = todayISO();
  const selected = invoices.find((i) => i.id === selectedId) ?? null;
  const customers = useMemo(() => [...new Set(invoices.map((i) => i.customer))].sort(), [invoices]);
  const filtered = useMemo(() => invoices.filter((i) => {
    const hay = `${i.number} ${i.customer} ${i.lines.map((l) => l.description).join(' ')}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase()))
      && (!status || status.split(',').includes(invoiceStatus(i, today)))
      && (!customer || i.customer === customer)
      && (!date || i.date === date) && (!from || i.date >= from) && (!to || i.date <= to) && (!dueFrom || i.dueDate >= dueFrom) && (!dueTo || i.dueDate <= dueTo) && (!min || invoiceTotal(i) >= Number(min)) && (!max || invoiceTotal(i) <= Number(max));
  }), [invoices, query, status, customer, date, today, from, to, dueFrom, dueTo, min, max]);

  const sum = (s: string) => invoices.filter((i) => invoiceStatus(i, today) === s).reduce((t, i) => t + invoiceTotal(i), 0);
  const count = (s: string) => invoices.filter((i) => invoiceStatus(i, today) === s).length;

  const openCreate = () => { setEditing(false); setForm(blankInvoice(nextInvoiceNumber(invoices))); setShowForm(true); setError(''); setFeedback(''); };
  const openEdit = (i: Invoice) => { setEditing(true); setForm({ ...i, lines: i.lines.map((l) => ({ ...l })) }); setSelectedId(null); setShowForm(true); setError(''); setFeedback(''); };
  const patchLine = (id: string, patch: Partial<InvoiceLine>) => setForm((f) => ({ ...f, lines: f.lines.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  function save() {
    const sub = invoiceSubtotal(form);
    if (!form.number.trim() || !form.customer.trim() || !form.date || !form.dueDate || form.lines.some((l) => !l.description.trim() || !(Number(l.quantity) > 0) || !(Number(l.unitPrice) >= 0) || l.unitPrice === '')) {
      setError('Complete customer, dates, invoice number, and every line item.'); return;
    }
    if (form.dueDate < form.date) { setError('Due date cannot be before the invoice date.'); return; }
    if (invoices.some((i) => i.id !== form.id && i.number.toLowerCase() === form.number.trim().toLowerCase())) { setError('Invoice number already exists.'); return; }
    if (form.discount > sub) { setError('Discount cannot exceed the subtotal.'); return; }
    if (invoiceTotal(form) <= 0) { setError('Invoice total must be greater than zero.'); return; }
    saveInvoice({ ...form, number: form.number.trim(), customer: form.customer.trim(), customerId: customerRecords.find(c => c.displayName.toLowerCase() === form.customer.trim().toLowerCase() || c.legalName.toLowerCase() === form.customer.trim().toLowerCase())?.id, paidOn: form.status === 'Paid' ? form.paidOn ?? todayISO() : undefined });
    setShowForm(false); setError('');
    setFeedback(form.status === 'Draft' ? 'Invoice saved as draft. It is not posted to the ledger yet.' : 'Invoice saved and posted to the journal.');
  }
  const markPaid = (id: string) => { markInvoicePaid(id); setFeedback('Invoice marked as paid and receipt posted to the journal.'); };
  const remove = (id: string) => {
    if (!window.confirm('Delete this invoice and its journal postings?')) return;
    cancelInvoice(id); setSelectedId(null); setFeedback('Invoice deleted.');
  };

  useEscape(() => { setShowForm(false); setSelectedId(null); });

  return (
    <FinanceModuleShell active="invoices">
      <div className="page finance-page">
        <div className="hero-row">
          <div><p className="eyebrow"><Receipt size={15}/> Sales & receivables</p><h1>Invoices</h1><p className="hero-subtitle">Create, track, and review customer invoices in one workspace.</p></div>
          <button className="primary-button" onClick={openCreate}><Plus size={19}/> Create Invoice</button>
        </div>

        <div className="finance-summary">
          <div className="panel summary-card"><span>Total invoiced</span><strong>{money(invoices.reduce((t, i) => t + invoiceTotal(i), 0))}</strong><small>{invoices.length} invoices</small></div>
          <div className="panel summary-card paid"><span>Paid</span><strong>{money(sum('Paid'))}</strong><small>{count('Paid')} invoices</small></div>
          <div className="panel summary-card pending"><span>Pending</span><strong>{money(sum('Pending'))}</strong><small>{count('Pending')} invoices</small></div>
          <div className="panel summary-card overdue"><span>Overdue</span><strong>{money(sum('Overdue'))}</strong><small>{count('Overdue')} invoices</small></div>
        </div>

        {(params.get('from') || params.get('customer') || params.get('min') || params.get('q') || params.get('dueFrom')) && <div className="nlq-source-banner">Showing Invoices from your search{params.get('customer') ? ` · ${params.get('customer')}` : ''}{params.get('from') ? ` · ${params.get('from')}–${params.get('to') ?? ''}` : ''}{params.get('dueFrom') ? ` · due ${params.get('dueFrom')}–${params.get('dueTo') ?? ''}` : ''} — <button onClick={() => { setQuery(''); setStatus(''); setCustomer(''); setFrom(''); setTo(''); setDueFrom(''); setDueTo(''); setMin(''); setMax(''); }}>Clear filters</button></div>}
        <section className="panel finance-toolbar">
          <div className="journal-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice, customer, or item..."/></div>
          <div className="filter-group">
            <label><SlidersHorizontal size={15}/><select value={['Paid','Pending','Overdue','Draft'].includes(status) ? status : ''} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All status</option>{['Paid', 'Pending', 'Overdue', 'Draft'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><Receipt size={15}/><select value={customer} onChange={(e) => setCustomer(e.target.value)} aria-label="Filter by customer"><option value="">All customers</option>{customers.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><CalendarDays size={15}/><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by invoice date"/></label>
            {(query || status || customer || date || from || to || dueFrom || dueTo || min || max) && <button className="clear-filter" onClick={() => { setQuery(''); setStatus(''); setCustomer(''); setDate(''); setFrom(''); setTo(''); setDueFrom(''); setDueTo(''); setMin(''); setMax(''); }}>Clear</button>}
          </div>
        </section>
        {feedback && <div className="finance-feedback" role="status"><Check size={15}/>{feedback}</div>}

        <section className="panel journal-table-panel">
          <div className="journal-panel-head"><div><h2>Invoice Register</h2><p>{filtered.length} invoices shown · {money(filtered.reduce((s, i) => s + invoiceTotal(i), 0))} filtered value</p></div></div>
          <div className="journal-table-wrap">
            <table className="journal-table finance-table">
              <thead><tr><th>Invoice Number</th><th>Customer</th><th>Invoice Date</th><th>Due Date</th><th className="amount">Amount</th><th>Status</th><th className="actions">Actions</th></tr></thead>
              <tbody>
                {filtered.map((i) => { const st = invoiceStatus(i, today); return <tr className="journal-row" key={i.id} onClick={() => setSelectedId(i.id)}>
                  <td><strong>{i.number}</strong></td><td>{i.customer}</td><td>{fmtDate(i.date)}</td><td>{fmtDate(i.dueDate)}</td>
                  <td className="amount">{money(invoiceTotal(i))}</td>
                  <td><span className={`status-pill ${st.toLowerCase()}`}>{st}</span></td>
                  <td className="actions">
                    <button title="View" aria-label={`View ${i.number}`} onClick={(e) => { e.stopPropagation(); setSelectedId(i.id); }}><Eye size={15}/></button>
                    <button title="Download PDF" aria-label={`Download ${i.number} as PDF`} className="pdf-download-btn" onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(i); }}><Download size={15}/></button>
                    <button title="Edit" aria-label={`Edit ${i.number}`} onClick={(e) => { e.stopPropagation(); openEdit(i); }}><Edit3 size={15}/></button>
                    <button title="Mark paid" aria-label={`Mark ${i.number} paid`} disabled={i.status === 'Paid'} onClick={(e) => { e.stopPropagation(); markPaid(i.id); }}><Check size={15}/></button>
                  </td>
                </tr>; })}
                {!filtered.length && <tr><td colSpan={7} className="empty-state"><FileText size={26}/><strong>No invoices found</strong><span>Try changing your search or filters.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && <div className="journal-overlay">
        <section className="journal-modal finance-modal" role="dialog" aria-modal="true" aria-label={editing ? 'Edit invoice' : 'Create invoice'}>
          <div className="modal-head"><div><p className="eyebrow">Receivables</p><h2>{editing ? 'Edit Invoice' : 'Create Invoice'}</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X size={19}/></button></div>
          <div className="form-grid">
            <label>Customer<input list="customer-list" value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} placeholder="Select or type a customer"/><datalist id="customer-list">{customers.map((x) => <option key={x} value={x}/>)}</datalist></label>
            <label>Invoice number<input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}/></label>
            <label>Invoice date<input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/></label>
            <label>Due date<input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}/></label>
            <label>Status<select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Invoice['status'] }))}><option>Draft</option><option>Pending</option><option>Paid</option></select></label>
          </div>
          <div className="lines-head"><h3>Items</h3><button className="text-button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}><Plus size={15}/> Add item</button></div>
          <div className="invoice-lines">{form.lines.map((l, idx) => <div className="invoice-line" key={l.id}>
            <span className="line-number">{idx + 1}</span>
            <input placeholder="Item description" value={l.description} onChange={(e) => patchLine(l.id, { description: e.target.value })}/>
            <input type="number" min="1" step="1" placeholder="Qty" value={l.quantity} onChange={(e) => patchLine(l.id, { quantity: e.target.value })}/>
            <input type="number" min="0" step="0.01" placeholder="Unit price" value={l.unitPrice} onChange={(e) => patchLine(l.id, { unitPrice: e.target.value })}/>
            <button className="icon-delete" disabled={form.lines.length === 1} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))} aria-label={`Remove item ${idx + 1}`}><Trash2 size={15}/></button>
          </div>)}</div>
          <div className="form-grid finance-totals">
            <label>Tax (GST amount)<input type="number" min="0" step="0.01" value={form.tax || ''} onChange={(e) => setForm((f) => ({ ...f, tax: Math.max(0, Number(e.target.value) || 0) }))}/></label>
            <label>Discount<input type="number" min="0" step="0.01" value={form.discount || ''} onChange={(e) => setForm((f) => ({ ...f, discount: Math.max(0, Number(e.target.value) || 0) }))}/></label>
            <div className="invoice-summary"><span>Subtotal <strong>{money(invoiceSubtotal(form))}</strong></span><span>Tax <strong>{money(form.tax)}</strong></span><span>Discount <strong>− {money(form.discount)}</strong></span><span className="summary-total">Total <strong>{money(invoiceTotal(form))}</strong></span></div>
            <label className="full">Notes<input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional customer-facing note"/></label>
          </div>
          {error && <div className="validation-error" role="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" onClick={save}>{editing ? 'Save changes' : 'Create invoice'}</button></div>
        </section>
      </div>}

      {selected && <div className="journal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <section className="journal-detail finance-detail" role="dialog" aria-modal="true" aria-label="Invoice details">
          <div className="modal-head"><div><p className="eyebrow">Invoice details</p><h2>{selected.number}</h2></div><button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close"><X size={19}/></button></div>
          <div className="detail-meta">
            <div><span>Customer</span><strong>{selected.customer}</strong></div><div><span>Invoice date</span><strong>{fmtDate(selected.date)}</strong></div><div><span>Due date</span><strong>{fmtDate(selected.dueDate)}</strong></div>
            <div><span>Status</span><strong>{invoiceStatus(selected, today)}</strong></div><div><span>Accounting</span><strong>{selected.status === 'Draft' ? 'Draft / not posted' : 'Posted to journal'}</strong></div><div><span>Total</span><strong>{money(invoiceTotal(selected))}</strong></div>
          </div>
          <div className="detail-lines">{selected.lines.map((l) => <div className="detail-line" key={l.id}><span>{l.description} × {l.quantity}</span><strong>{money(Number(l.quantity) * Number(l.unitPrice))}</strong><strong>{money(Number(l.unitPrice))}</strong></div>)}</div>
          <div className="invoice-detail-summary"><span>Subtotal <strong>{money(invoiceSubtotal(selected))}</strong></span><span>Tax <strong>{money(selected.tax)}</strong></span><span>Discount <strong>− {money(selected.discount)}</strong></span><span>Total <strong>{money(invoiceTotal(selected))}</strong></span></div>
          {selected.notes && <div className="detail-description">{selected.notes}</div>}
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => downloadInvoicePdf(selected)}><Download size={14}/> Download PDF</button>
            <button className="secondary-button" onClick={() => openEdit(selected)}><Edit3 size={14}/> Edit</button>
            {selected.status !== 'Paid' && <button className="primary-button" onClick={() => markPaid(selected.id)}><Check size={14}/> Mark as Paid</button>}
            <button className="danger-button" onClick={() => remove(selected.id)}><Trash2 size={14}/> Delete</button>
          </div>
        </section>
      </div>}
    </FinanceModuleShell>
  );
}
