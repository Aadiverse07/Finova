/** Rupees (float) -> integer paise. Rounds half away from zero and absorbs binary float noise (1.005 -> 101). */
export function toPaise(value: number): number {
  if (!Number.isFinite(value)) throw new Error('INVALID_MONEY');
  const magnitude = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  const n = value < 0 ? -magnitude : magnitude;
  if (!Number.isSafeInteger(n)) throw new Error('MONEY_OUT_OF_RANGE');
  return n === 0 ? 0 : n; // normalise -0
}
export function fromPaise(paise: number): number {
  if (!Number.isSafeInteger(paise)) throw new Error('INVALID_PAISE');
  return paise / 100;
}
export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(fromPaise(paise));
}
export function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('INVALID_RATIO');
  }
  if (!Number.isSafeInteger(numerator * 2 + denominator)) throw new Error('MONEY_OUT_OF_RANGE');
  return Math.floor((numerator * 2 + denominator) / (2 * denominator));
}
