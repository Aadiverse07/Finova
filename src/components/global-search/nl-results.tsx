'use client';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { NlqGroup, QuerySpec } from '@/lib/nlq/types';
import { chipsForSpec, editChip, removeChip } from '@/lib/nlq/describe';
import { money } from '@/lib/data/format';

type Relaxation = { label: string; count: number; spec: QuerySpec };
function editPrompt(spec: QuerySpec, id: string) {
  const current = id === 'category' ? spec.filters.category?.join(',') : id === 'vendor' ? spec.filters.vendor?.join(',') : id === 'customer' ? spec.filters.customer?.join(',') : id === 'account' ? spec.filters.account?.join(',') : id === 'status' ? spec.filters.status?.join(',') : id === 'method' ? spec.filters.paymentMethod?.join(',') : id === 'source' ? spec.filters.source?.join(',') : id === 'text' ? spec.filters.text : id === 'date' ? `${spec.filters.dateRange?.from ?? ''},${spec.filters.dateRange?.to ?? ''}` : id === 'amount' ? `${spec.filters.amount?.min ?? ''},${spec.filters.amount?.max ?? ''}` : id === 'sort' ? `${spec.sort?.field ?? 'date'}:${spec.sort?.dir ?? 'desc'}` : id === 'limit' ? String(spec.limit ?? 5) : id === 'aggregate' ? spec.aggregate : undefined;
  return window.prompt(`Edit ${id}`, current ?? '') ?? undefined;
}
export function NlResults({ spec, groups, unresolved, alternatives, onSpec, onOpen, onAsk, relaxations = [] }: { spec: QuerySpec; groups: NlqGroup[]; unresolved: string[]; alternatives: string[]; onSpec: (s: QuerySpec) => void; onOpen: (s: QuerySpec, entity: string) => void; onAsk: () => void; relaxations?: Relaxation[] }) {
  const chips = chipsForSpec(spec);
  const total = groups.reduce((count, group) => count + group.count, 0);
  const uncertain = spec.confidence < 0.5;
  return <section className="nlq-panel" aria-live="polite">
    <div className="nlq-understood"><div className="nlq-title"><Sparkles size={15} /> Understood as</div><div className="nlq-chips" role="group" aria-label="Applied search filters">
      {chips.map((chip) => <span key={chip.id} className="nlq-chip"><button type="button" className="nlq-chip-label" aria-label={`Edit filter: ${chip.label}`} onClick={() => { const value = editPrompt(spec, chip.id); if (value !== undefined) { try { onSpec(editChip(spec, chip.id, value)); } catch { /* invalid edits are ignored safely */ } } }}>{chip.label}</button><button type="button" className="nlq-chip-remove" aria-label={`Remove filter: ${chip.label}`} onClick={() => onSpec(removeChip(spec, chip.id))}><X size={12} /></button></span>)}
    </div></div>
    {unresolved.length > 0 && <div className="nlq-warning" role="status">I didn&apos;t understand: {unresolved.map((x) => `“${x}”`).join(', ')} — ignored.</div>}
    {alternatives.length > 0 && <div className="nlq-warning" role="status">Possible alternatives: {alternatives.join(', ')}.</div>}
    {spec.confidence >= 0.5 && spec.confidence < 0.75 && <div className="nlq-warning" role="status"><strong>Is this what you meant?</strong> {alternatives[0] ? `Maybe: ${alternatives[0]}. ` : ''}Edit any chip above to adjust.</div>}
    {uncertain ? <div className="nlq-low"><strong>Is this what you meant?</strong><p>I’m not confident enough to guess from this question. Try adding a record type, date, amount, or status.</p></div> : groups.every((group) => group.count === 0) && relaxations.length > 0 ? <div className="nlq-relax"><strong>No matching records.</strong>{relaxations.map((relaxation) => <button type="button" key={relaxation.label} onClick={() => onSpec(relaxation.spec)}>{relaxation.label} · {relaxation.count} results</button>)}</div> : groups.map((group) => <div className="nlq-group" key={group.entity}>
      <div className="nlq-group-head"><strong>{group.entity.charAt(0).toUpperCase() + group.entity.slice(1)} · {group.count} results</strong>{group.total !== undefined && <span>Total {money(group.total)}</span>}</div>
      {group.records.map((record) => <button type="button" className="nlq-record" key={`${group.entity}-${record.id}`} onClick={() => onOpen(spec, group.entity)}><span><strong>{record.title}</strong><small>{record.subtitle}</small></span><span className="nlq-record-meta">{record.amount !== undefined ? money(record.amount) : ''} {record.status ?? ''}</span></button>)}
      {group.count > 5 && <button type="button" className="nlq-open-all" onClick={() => onOpen(spec, group.entity)}>Open all in {group.entity}s <ArrowRight size={14} /></button>}
    </div>)}
    {total > 0 && !uncertain && <div className="nlq-ctas"><button type="button" className="secondary-button" onClick={() => onOpen(spec, groups[0]?.entity ?? 'expense')}>Open all <ArrowRight size={14} /></button><button type="button" className="primary-button" onClick={onAsk}>Ask Finova AI to analyse this <Sparkles size={14} /></button></div>}
  </section>;
}
