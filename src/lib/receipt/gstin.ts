const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function checksum(input: string) { let factor = 2, total = 0; for (let i = input.length - 1; i >= 0; i -= 1) { const code = chars.indexOf(input[i] ?? ''); if (code < 0) return -1; const product = factor * code; total += Math.floor(product / 36) + product % 36; factor = factor === 2 ? 1 : 2; } return (36 - (total % 36)) % 36; }
export function isValidGSTIN(value: string) { const gst = value.trim().toUpperCase(); return GSTIN_RE.test(gst) && chars[checksum(gst.slice(0, -1))] === gst.slice(-1); }
export function findGSTIN(text: string) { const candidates = text.toUpperCase().match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g) ?? []; return candidates.find(isValidGSTIN) ?? null; }
