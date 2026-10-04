# Smart Financial Alerts

Alerts are derived, deterministic, read-only insights. The browser and server use the same pure engine and injected date. User lifecycle state is persisted in `localStorage` under `finova:alerts:v1:{orgId}:{userId}`.

## Rules
overdue invoices, expense increase, category spike, expected receipts, cash-flow trend, low cash runway, due soon, stale drafts, customer concentration, duplicate expenses, ledger integrity, GST liability, and positive milestones.

## Explanation standard
Every alert contains what happened, an optional comparison, why it matters, a suggested action, evidence facts, record links and a calculation method. Templates are deterministic and do not use an LLM.

## Cash assumption
Active ASSET accounts whose code starts with `10` or whose name contains bank/cash are cash accounts, plus configured `cashAccountIds`.

## Cash-flow comparison
The cash-flow rule compares the two most recent complete calendar months. It treats debits to cash accounts as inflow and credits as outflow.

## Server limits
The Prisma loader uses up to 5,000 invoices and expenses; journal entries remain uncapped. The API logs only aggregate counts and timing.

## Roadmap
Email/WhatsApp/SMS/push delivery, scheduled evaluation and cross-device state, human-approved payment reminder drafts, cash-flow forecasting, payment behaviour insights, budgets/statistical anomaly detection, GST calendar, bank reconciliation, natural-language alert rules, optional verified LLM paraphrasing, and learning-based threshold suggestions are future work.