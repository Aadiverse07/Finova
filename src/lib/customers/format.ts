export const customerMoney = (paise: bigint | number) => {
  const n = typeof paise === 'bigint' ? Number(paise) / 100 : paise;
  return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const serializeCustomer = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_k,v)=> typeof v === 'bigint' ? v.toString() : v));
