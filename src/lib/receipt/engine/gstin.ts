import { isValidGSTIN } from '../gstin';
import type { Line } from './types';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };
const VALID_STATE = (code: string) => { const n = Number(code); return (n >= 1 && n <= 38) || n === 97 || n === 99; };

function checksumChar(first14: string) {
  let factor = 2, total = 0;
  for (let i = first14.length - 1; i >= 0; i -= 1) {
    const code = CHARS.indexOf(first14[i] ?? '');
    if (code < 0) return null;
    const p = factor * code; total += Math.floor(p / 36) + (p % 36); factor = factor === 2 ? 1 : 2;
  }
  return CHARS[(36 - (total % 36)) % 36] ?? null;
}

/** Fix OCR look-alikes position by position (positions 0-1 digits, 2-6 letters, 7-10 digits, 11 letter, 13 'Z') and re-verify the checksum. */
export function repairGSTIN(candidate: string): { value: string; repaired: boolean } | null {
  const raw = candidate.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== 15) return null;
  if (isValidGSTIN(raw)) return { value: raw, repaired: false };
  const out = raw.split('');
  const fix = (i: number, kind: 'digit' | 'letter') => {
    const c = out[i] ?? '';
    if (kind === 'digit' && !/\d/.test(c)) out[i] = TO_DIGIT[c] ?? c;
    if (kind === 'letter' && /\d/.test(c)) out[i] = TO_LETTER[c] ?? c;
  };
  [0, 1, 7, 8, 9, 10].forEach((i) => fix(i, 'digit'));
  [2, 3, 4, 5, 6, 11].forEach((i) => fix(i, 'letter'));
  if (out[13] !== 'Z' && (out[13] === '2' || out[13] === '7')) out[13] = 'Z';
  const expected = checksumChar(out.slice(0, 14).join(''));
  if (expected && out[14] !== expected) {
    const alt = out[14] ?? '';
    if ((TO_DIGIT[alt] ?? alt) === expected || (TO_LETTER[alt] ?? alt) === expected) out[14] = expected;
  }
  const value = out.join('');
  return isValidGSTIN(value) && VALID_STATE(value.slice(0, 2)) ? { value, repaired: value !== raw } : null;
}

export type GstinHit = { value: string; repaired: boolean; lineIndex: number; role: Line['role']; raw: string };
const LOOSE = /(?<![A-Z0-9])[A-Z0-9]{2}[\s-]?[A-Z0-9]{5}[\s-]?[A-Z0-9]{4}[\s-]?[A-Z0-9][\s-]?[A-Z0-9][\s-]?[A-Z0-9][\s-]?[A-Z0-9](?![A-Z0-9])/g;

export function findAllGSTINs(lines: Line[]): { valid: GstinHit[]; invalidRaw: string[] } {
  const valid: GstinHit[] = []; const invalidRaw: string[] = [];
  for (const line of lines) {
    const upper = line.text.toUpperCase();
    const labelled = /GST\s*(?:IN|NO|N\.?O\.?|NUMBER)?|GSTIN|GST\s*REG/.test(upper);
    for (const m of upper.matchAll(LOOSE)) {
      const raw = m[0];
      const r = repairGSTIN(raw);
      if (r) { if (!valid.some((v) => v.value === r.value && v.lineIndex === line.index)) valid.push({ ...r, lineIndex: line.index, role: line.role, raw }); }
      else if (labelled && /\d/.test(raw) && /[A-Z]/.test(raw)) invalidRaw.push(raw.replace(/[\s-]/g, ''));
    }
  }
  return { valid, invalidRaw };
}
