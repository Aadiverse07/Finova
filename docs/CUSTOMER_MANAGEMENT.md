# Finova Customer Management

## Scope
Customer Management upgrades invoice customer text into a first-class customer record while retaining compatibility with legacy invoices.

### Implemented in this standalone build
- Search, sorting and filters for customers.
- Summary strip for customer count, outstanding and overdue balances.
- Customer profile with financial summary, invoices, payments, ledger, notes/activity and documents.
- Integer-paise balance calculations.
- Partial payments, oldest-first allocation, unapplied customer credit and TDS capture.
- Duplicate detection by GSTIN/phone/email/name.
- Archive instead of deletion.
- Merge support in the client store and transactional Prisma API.
- Payment reliability score from average days-to-pay, late share and trend.
- Receivables aging buckets.
- Credit-limit field and profile warning surface.
- CSV export and import API contract.
- Statement print-to-PDF path.
- Premium insight preview.
- Customer-linked invoice IDs are optional so old invoices continue to work by customer name.

## Deliberate integration boundaries
This repository does not contain an email/SMS/WhatsApp provider, payment gateway, contacts connector, object-storage implementation, or customer portal identity system. The module therefore logs reminder/activity actions and exposes API/schema contracts instead of pretending those external systems are connected.

Likewise, old invoices in the seed/mock data do not contain customer IDs. They are matched by normalized customer/legal name until a migration backfill is run. New invoice saves resolve a matching first-class customer ID when available.

## Financial rules
- Balances are derived from invoices, allocations, credit notes and opening balance; they are not stored as mutable customer totals.
- Payments allocate oldest due invoices first unless explicit allocations are provided.
- Excess payment remains unapplied customer credit.
- TDS is tracked separately from cash received.
- Archived customers retain financial records.
- Database API transactions use `orgId` on every query.

## Premium boundary
Free: unlimited customer records, core profile, invoices, payments and ledger.
Premium: score, aging, automated reminder integrations, portal/payment links, credit limits, statements, lifetime-value analytics and concentration alerts. The current UI previews premium insights; provider-backed automation and portal payment reconciliation require the corresponding production integrations.

## Privacy / DPDP
Personal data should be encrypted at rest/in transit by the deployment infrastructure, access-controlled by organization role, and retained only for the required accounting/legal period. Deletion requests must distinguish erasable profile data from financial records that must be retained for statutory/accounting purposes.

## API
- `GET /api/customers`
- `POST /api/customers`
- `GET/PATCH /api/customers/:id`
- `POST /api/customers/:id/payments`
- `GET /api/customers/:id/ledger`
- `GET /api/customers/:id/statement`
- `POST /api/customers/:id/merge`
- `POST /api/customers/import`

## Roadmap
MVP is implemented in this module. V1 should add database backfill, true aggregate caching/invalidation, provider-backed reminders, statement generation, customer portal/payment gateway and role-level field audit logs. Advanced work includes concentration/churn analytics, FX transaction storage, project profitability, contacts import and reconciliation webhooks.
