export const intent = {
  expense: ['spent', 'spend', 'spending', 'expense', 'expenses', 'paid for', 'bought', 'cost', 'costs', 'kharcha', 'bill', 'bills', 'pay', 'paid to', 'purchases'],
  invoice: ['invoice', 'invoices', 'billed', 'billing', 'sales', 'receivable', 'owe me', 'customers owe', 'due'],
  transaction: ['transaction', 'transactions', 'payment', 'payments', 'received', 'journal', 'entry', 'entries', 'posting', 'postings', 'bhugtan'],
  account: ['account', 'accounts', 'ledger', 'balance', 'balances'],
} as const;
export const status: Record<string, string[]> = {
  Paid: ['paid', 'settled', 'cleared'],
  Pending: ['pending', 'unpaid', 'outstanding', 'open', 'baaki'],
  Overdue: ['overdue', 'late', 'past due'],
  Draft: ['draft', 'unsent'],
};
export const aliases: Record<string, string> = {
  software: 'Software & Subscriptions', subscriptions: 'Software & Subscriptions',
  travel: 'Travel Expense', rent: 'Rent Expense', ads: 'Marketing', advertising: 'Marketing', marketing: 'Marketing', utilities: 'Utilities',
};
export const sortWords = { desc: ['largest', 'biggest', 'highest', 'top', 'most'], asc: ['smallest', 'lowest', 'oldest', 'first'], recent: ['latest', 'recent', 'newest'] } as const;
export const writeIntent = /\b(delete|remove|cancel|void|mark as paid|create|add|edit|approve|send|post)\b/i;
export const offTopic = /\b(cricket|football|weather|recipe|movie|lyrics|poem|horoscope|bitcoin|stock price|president|prime minister)\b/i;
export const hinglish = ['kharcha', 'bhugtan', 'baaki', 'pichhle mahine', 'is mahine', 'zyada', 'kam'];

const split = (list: readonly string[]) => list.flatMap((v) => v.split(' '));
/** Words that carry intent/period/sort meaning and must never be treated as entity names or reported as "unresolved". */
export const genericWords = new Set<string>([
  ...'show me everything i spent on during in the for of what did which are is my your give list all about this last month months week weeks quarter quarters year years from to and with only ones please ke ka ki ko se mahine mahina pichhle is zyada adhik kam lakh lakhs crore crores thousand k inr rs total many much days day since least most below above over under between more less than greater at by a an how do does was were who we our also next current financial fy ytd today yesterday ago till until upto around about amount money rupees past due owe owed late have has had get find top first latest recent newest oldest largest biggest highest smallest lowest q1 q2 q3 q4 jan january feb february mar march apr april may jun june jul july aug august sep sept september oct october nov november dec december'.split(' '),
  ...Object.values(intent).flatMap((v) => split(v)), ...Object.values(status).flatMap((v) => split(v)), ...split(Object.values(sortWords).flat()),
]);
genericWords.add('manual');
export const isGenericWord = (w: string) => genericWords.has(w) || genericWords.has(w.replace(/s$/, '')) || genericWords.has(`${w}s`);
