# Receipt scanning API contract

### `POST /api/receipt/validate`
Authenticated. Body: `{ extraction: ReceiptExtraction }`. Returns the same strict extraction schema after server-side date/GSTIN/arithmetic validation.

### `POST /api/receipt/ingest`
Provider-neutral webhook contract. Requires `x-finova-ingest-secret` matching `FINOVA_RECEIPT_INGEST_SECRET`. Intended for an email/WhatsApp gateway after that gateway has authenticated the sender and produced a strict extraction payload. It deliberately does not claim to provision an email address or WhatsApp number.

### Future production queue
`POST /api/receipt/uploads` -> object storage signed URL -> `ReceiptScan(status=uploading)` -> queue -> preprocessing -> OCR -> layout-aware model -> validation -> `ready` -> review -> confirmation -> expense journal posting.

Recommended idempotency key: SHA-256 of normalized original bytes + orgId. Store a second content hash after preprocessing for duplicate-image detection.
