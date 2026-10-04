export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const money = (n: number) =>
  `${n < 0 ? '-' : ''}₹ ${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

/** Local calendar date as YYYY-MM-DD. */
export const todayISO = () => new Date().toLocaleDateString('en-CA');

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

/** Id generator that also works on non-secure origins (crypto.randomUUID is undefined on http://<LAN-ip>). */
let uidCounter = 0;
export const uid = () => `${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
