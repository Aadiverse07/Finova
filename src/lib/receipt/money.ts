export function parseIndianAmountToPaise(input: string | number | null | undefined): bigint | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).replace(/[₹,\s]/g, '').replace(/INR/gi, '').trim();
  if (!raw || !/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const negative = raw.startsWith('-'); const clean = negative ? raw.slice(1) : raw; const [rupees, paise = ''] = clean.split('.');
  const value = BigInt(rupees ?? '0') * 100n + BigInt((paise + '00').slice(0, 2)); return negative ? -value : value;
}
export function paiseString(value: bigint | number): string { return (typeof value === 'bigint' ? value : BigInt(Math.round(value * 100))).toString(); }
export function paiseToNumber(value: string | bigint): number { return Number(typeof value === 'bigint' ? value : BigInt(value)) / 100; }
