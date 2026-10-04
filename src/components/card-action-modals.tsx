'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, FileText, Receipt, X } from 'lucide-react';

export type CardAction = 'send' | 'exchange' | 'cards';

/** Demo figures shared with the floating cards. */
const SUMMARY = [
  { label: 'Total Income', value: '₹ 2,48,500', href: '/journal', hint: 'View journal' },
  { label: 'Total Expenses', value: '₹ 1,36,200', href: '/expenses', hint: 'View expenses' },
  { label: 'Outstanding Invoice', value: '₹ 64,800', href: '/invoices', hint: 'View invoices' },
  { label: 'Net Balance', value: '₹ 1,12,300', href: '/reports', hint: 'View reports' },
];

/** Indicative DEMO rates (INR -> currency). Not live market data. */
const RATES: Record<string, number> = { USD: 0.012, EUR: 0.011, GBP: 0.0094, AED: 0.044 };

function Exchange() {
  const [amount, setAmount] = useState('10000');
  const [cur, setCur] = useState('USD');
  const result = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n >= 0 ? (n * RATES[cur]).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-';
  }, [amount, cur]);
  return (
    <>
      <p className="lp-modal-sub">Quick currency estimate for invoices and expenses.</p>
      <div className="lp-fx">
        <label>
          Amount (INR)
          <input type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Convert to
          <select value={cur} onChange={(e) => setCur(e.target.value)}>
            {Object.keys(RATES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="lp-fx-out" aria-live="polite">
        <span>You get</span>
        <strong>{result} {cur}</strong>
      </div>
      <small className="lp-modal-note">Indicative demo rates, not live market rates.</small>
    </>
  );
}

export function CardActionModal({ kind, onClose }: { kind: CardAction; onClose: () => void }) {
  const title = kind === 'send' ? 'Send' : kind === 'exchange' ? 'Exchange' : 'Your cards';
  return (
    <div className="lp-modal-wrap" onMouseDown={onClose}>
      <div className="lp-modal" role="dialog" aria-modal="true" aria-labelledby="lp-act-title" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="lp-modal-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <h2 id="lp-act-title">{title}</h2>

        {kind === 'send' && (
          <>
            <p className="lp-modal-sub">Choose what you would like to send or record.</p>
            <div className="lp-choice">
              <Link href="/invoices" className="lp-choice-item"><Receipt size={20} /><span><strong>Send an invoice</strong><small>Bill a customer and track payment</small></span><ArrowRight size={16} /></Link>
              <Link href="/journal" className="lp-choice-item"><FileText size={20} /><span><strong>Record a transaction</strong><small>Post a balanced journal entry</small></span><ArrowRight size={16} /></Link>
            </div>
          </>
        )}

        {kind === 'exchange' && <Exchange />}

        {kind === 'cards' && (
          <>
            <p className="lp-modal-sub">Your headline numbers (demo data). Select one to open it.</p>
            <div className="lp-choice">
              {SUMMARY.map((s) => (
                <Link key={s.label} href={s.href} className="lp-choice-item">
                  <span><strong>{s.label}</strong><small>{s.hint}</small></span>
                  <b>{s.value}</b>
                </Link>
              ))}
            </div>
          </>
        )}

        <button type="button" className="lp-ghost lp-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
