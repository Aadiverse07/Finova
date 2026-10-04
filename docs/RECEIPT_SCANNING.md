# Finova Receipt / Document Scanning

## Implemented in this build
- Camera/gallery/file capture with multi-file queue for Premium.
- Browser-side image resize/contrast preprocessing and SHA-256 hashing.
- English + Hindi Tesseract.js OCR adapter.
- Strict Zod extraction schema with per-field confidence and optional bounding-box contract.
- Deterministic extraction fallback for vendor/date/amount/category/payment/GSTIN/tax/invoice/card-last-4/UPI reference.
- GSTIN checksum, date-age/future, amount and subtotal/tax/discount/round-off/tip arithmetic validation.
- Review screen with confidence states, inline editing, quick category/payment chips and manual fallback.
- Duplicate scan/expense detection and journal transaction matching.
- Business/personal toggle, ITC-candidate capture, anomaly warnings and optional Premium line-item split.
- Free 10 scans/month gate; Premium unlock flag is `NEXT_PUBLIC_FINOVA_PREMIUM=true`.
- Local offline scan queue/storage and searchable archive with CSV export.
- Provider-neutral `/api/receipt/ingest` contract for email/WhatsApp gateway integration.
- Authenticated `/api/receipt/validate` endpoint for server-side revalidation.

## Important non-hallucination boundary
The repository does not contain a configured cloud OCR/vision provider, object-storage credentials, bank/UPI import connector, email inbox provider, WhatsApp Business account, FX-rate provider, or persisted receipt DB model. This build therefore does **not** pretend those external systems are live. The interfaces/contracts are present where practical; production activation requires the relevant provider credentials and server-side storage integration.

The browser archive is useful for standalone/demo operation but is **not** a substitute for production encrypted object storage. Originals are not uploaded to a third-party service by this build. Full-card numbers are not intentionally extracted/stored; only a printed last four may be retained.

PDF handling uses a lightweight selectable-text fallback; a production multi-page PDF viewer/OCR worker should replace it with a dedicated PDF parser. Multiple image files can be batch processed in Premium. Multi-page PDF merging is not claimed as complete here.

## Architecture
`Capture -> preprocess -> OCR adapter -> structured extraction -> validation -> review -> duplicate/match checks -> expense posting -> archive`

A future cloud vision/LLM adapter should receive OCR text plus layout tokens/image and return the same `ReceiptExtraction` JSON; it must pass Zod validation before UI use.

## Extraction engine (decision-making layer)
`src/lib/receipt/engine/` replaces the old "first line / last number" heuristics. Each field is a *decision*, not a regex hit:

| Stage | What it does |
|---|---|
| `text.ts` | Normalises OCR/PDF text, collapses letter-spaced headings (`I N V O I C E`), repairs O/0 and I/1 inside numbers, re-segments flat one-line text on document labels, and tags each line as **issuer**, **recipient** (bill-to / ship-to) or neutral. |
| `vendor.ts` | Scores candidate names (position, issuer label, business suffix, known merchant, address penalty, tagline stripping, history match). Titles, labels, addresses and the *billed-to* party are never the vendor. If nothing scores well it says `Unknown vendor` instead of guessing. |
| `dates.ts` | Prefers *invoice/bill/issue date*; *due date*, validity and expiry dates are demoted. Day-first order is assumed (and flagged) for ambiguous `dd/mm` dates. |
| `amounts.ts` | Classifies lines as total / subtotal / tax / discount / tip / round-off, then **reconciles** `subtotal + tax - discount + tip + round-off = total` across alternative candidates. Handles CGST/SGST split vs aggregate GST, tax-inclusive totals and negative round-off. A real mismatch is kept and flagged, never silently "fixed". |
| `gstin.ts` | Finds every GSTIN, repairs OCR look-alikes position-by-position, verifies the checksum, and attributes the supplier GSTIN (not the buyer's). |
| `fields.ts` | Payment method (explicit "paid by" beats keyword hits; unpaid invoices stay `Unknown`), invoice number (must contain a digit; UPI/transaction ids are not invoice numbers), UPI ref, card last-4, phone, address, document type. |

PDF text now keeps its layout: `pdfItemsToText()` groups pdf.js fragments by baseline, so labels and values stay on the same line.

Every field carries a calibrated confidence and a `sourceText` note explaining the decision (visible in the review UI), e.g. why a vendor won or that the arithmetic reconciled. Confidence is highest when independent signals agree (e.g. the total reconciles with subtotal + tax).

**Honest limits:** this is deterministic and rule-based. It does not use a cloud vision/LLM model, so very unusual layouts, handwriting and poor photos can still need manual review. Round-off may now be negative (`roundOffPaise` accepts a leading `-`). Category suggestions are limited to the six categories the posting layer supports.

## Premium
- Free: 10 scans/month, core fields, manual review.
- Premium: unlimited scans, extended fields, batch image scanning, duplicate/matching intelligence, line-item split, archive export and ITC-oriented capture.

## Cost
There is no honest per-scan cloud cost to quote because no cloud processor is configured. Tesseract.js runs in the browser and has no per-call API charge; the real cost is device CPU/battery. A cloud OCR/vision provider should be benchmarked separately on a representative Indian receipt set before pricing.

## Accuracy evaluation
Create a 200+ receipt benchmark stratified across retail, restaurant, fuel, GST invoices, utilities, travel, handwritten, UPI screenshots and Hindi/mixed-language receipts. Measure exact/normalized field accuracy for amount/date/vendor/category/payment/GSTIN and separately measure arithmetic validation precision. Do not report the target metrics as achieved until the benchmark is actually run.

## Roadmap
### MVP
Capture, OCR, core six fields, validation, review, manual fallback, expense posting.
### v1
Cloud layout-aware extraction adapter, persistent encrypted object storage, server-side scan jobs/queue, multi-page PDFs, bank/UPI connector, provider-backed email/WhatsApp ingestion, signed URLs, retention/deletion controls.
### Advanced
Personalized vendor/category model, FX provider, warranty reminders, anomaly scoring, reimbursement intelligence, immutable audit history, accuracy tracking and active-learning loop.
