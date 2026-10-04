# Bank API contract

- `POST /api/bank/import` — multipart upload guard; production parser persistence belongs to the ingestion worker.
- `POST /api/bank/consent` — create AA consent request contract.
- `DELETE /api/bank/consent` — revoke consent contract.
- `POST /api/bank/sync` — enqueue account sync with retry metadata.
- `POST /api/bank/review` — persist review decision contract.

All production routes must remain org-scoped through `withOrgAuth`, rate-limited, audited and idempotent. AA callbacks must additionally verify provider signatures and consent/account binding.
