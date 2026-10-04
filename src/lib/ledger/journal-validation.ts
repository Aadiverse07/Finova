export type JournalAmountLine = { debit: number | string; credit: number | string };

const paise = (value: number | string) => Math.round(Number(value || 0) * 100);

/** Totals in rupees, computed in integer paise so 0.1 + 0.2 style float drift can never unbalance an entry. */
export function journalTotals(lines: JournalAmountLine[]) {
  return {
    debit: lines.reduce((sum, line) => sum + paise(line.debit), 0) / 100,
    credit: lines.reduce((sum, line) => sum + paise(line.credit), 0) / 100,
  };
}

export function isBalancedJournal(lines: JournalAmountLine[]) {
  const debit = lines.reduce((sum, line) => sum + paise(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + paise(line.credit), 0);
  return debit > 0 && debit === credit;
}
