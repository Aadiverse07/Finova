export function toPaise(input: number|string): number {
  let n: number;
  if (typeof input === 'string') {
    const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
    if (!m) throw new Error('INVALID_MONEY');
    n = Number(m[2] + (m[3] ?? '').padEnd(2, '0')) * (m[1] ? -1 : 1);
  } else {
    if (!Number.isFinite(input)) throw new Error('INVALID_MONEY');
    n = Math.round(Number((input * 100).toPrecision(15)));
  }
  if (!Number.isSafeInteger(n)) throw new Error('MONEY_OUT_OF_RANGE');
  return n;
}
export function fromPaise(paise: number): number { if (!Number.isSafeInteger(paise)) throw new Error('INVALID_PAISE'); return paise/100; }
export function formatINR(paise: number): string { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(fromPaise(paise)); }
export function roundHalfUp(numerator: number, denominator: number): number { if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||denominator<=0) throw new Error('INVALID_RATIO'); return Math.floor((numerator*2+denominator)/(2*denominator)); }
