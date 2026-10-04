# Finova Bank Integration & Auto-Import

## Implemented MVP

- CSV, XLS/XLSX and PDF statement upload.
- Column-tolerant normalisation for date, narration, debit, credit, amount, reference and balance.
- Integer paise amounts and IST-safe ISO dates.
- Immutable raw transaction layer in the data model plus editable bookkeeping transaction layer.
- Duplicate detection using source transaction IDs and date/amount/narration/balance fingerprints.
- Narration merchant normalisation and payment-mode inference.
- Suggestion order: user rules → learned vendor history → deterministic classifier fallback.
- Confidence on every suggestion; confirmations remain reviewable.
- Review inbox with confirm/change/ignore and bulk confirmation.
- Business/personal model flag, invoice-match suggestions, internal-transfer detection and export.
- Auto-rule builder.
- Sandbox AA consent adapter and consent/sync API contracts; no bank credentials are collected.
- Account model supports multiple banks/accounts, consent state and sync health.
- Prisma schema for raw/normalised transactions, consents, accounts and rules.

## Account Aggregator research (verified 2 Oct 2026)

The AA ecosystem is consent-based: an AA is a consent manager between Financial Information Providers (FIPs) and Financial Information Users (FIUs). Sahamati describes explicit user consent and says AAs do not store/process the user's financial data as their own store. The ecosystem uses ReBIT technical standards. See Sahamati's ecosystem and certification material before production onboarding.

Finova's architecture therefore treats AA as an adapter, not as a credential-scraping bank connector. Production launch must confirm FIU eligibility/licensing, ReBIT/Sahamati certification, contracts, security controls and the exact data-retention/legal basis with counsel.

### Partner options reviewed

- **Setu AA Gateway**: public developer documentation provides sandbox FIU APIs for consent, status, data sessions and revoke flows; its current product also describes multi-AA routing and 100+ FIPs. Commercial pricing was not found publicly in the reviewed material, so this implementation does not invent a per-scan cost.
- **Finvu / Perfios Anumati / OneMoney / CAMS AA / Protean SurakshAA and other AAs**: Sahamati maintains the current ecosystem/certification listings. A multi-AA TSP can reduce separate integrations, but production contracts and onboarding must be confirmed directly.

### Cost estimate

No trustworthy public per-transaction commercial tariff was found in the reviewed sources. The code therefore exposes provider configuration instead of hard-coding a fabricated price. Budget should include provider/TSP commercial fees, certification/onboarding, cloud processing, statement OCR/parsing and support/observability. Obtain written quotes before procurement.

## Consent sequence

```text
Finova (FIU) -> AA/TSP: consent request (purpose, FI types, frequency, data range)
User -> AA/bank: authenticate + approve/reject
AA -> Finova: consent status notification
Finova -> AA: data-session request
AA <- FIP: consented data
AA -> Finova: encrypted financial information
Finova: decrypt, validate, normalise, idempotently ingest
```

## Security checklist

- Never collect internet-banking passwords, PINs or OTPs.
- TLS 1.2+ in transit; AES-256/equivalent at rest; production keys in KMS.
- Encrypt/segregate provider credentials and tokens.
- Short-lived signed tokens and webhook signature verification.
- Org-scoped access, rate limiting and audit logs.
- Mask account numbers and redact card data.
- Explicit purpose, consent duration, revocation and deletion controls.
- Immutable raw source records; edits apply to the bookkeeping layer.
- Production threat model, dependency scanning, penetration test and incident response plan.
- Confirm current DPDP/RBI/ReBIT/Sahamati obligations with legal counsel before launch.

## Architecture

`StatementParserAdapter | AccountAggregatorAdapter | GatewayAdapter` → `IngestionQueue` → `RawTransactionStore` → `Normalizer` → `Categorizer` → `ReconciliationEngine` → `ReviewInbox` → `BookkeepingEntry`.

The current standalone build uses a browser-persisted Zustand implementation for the working MVP and a Prisma schema/API contract for server persistence. The production queue should use a durable queue (Redis/SQS/etc.) with retries and dead-letter handling rather than the local adapter.

## What is intentionally not faked

Live AA consent cannot be completed without a real FIU/TSP agreement and credentials. Payment initiation is not implemented. Notifications, SMS/WhatsApp, KMS, durable queue workers and production object storage require the corresponding infrastructure/provider configuration. The sandbox adapter is explicitly labelled as sandbox.
