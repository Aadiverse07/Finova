# Finova

Double-entry accounting application foundation, integrated with the QuikIT platform conventions. Next.js App Router, TypeScript strict, Prisma/PostgreSQL, mock-first configuration. Dev port **3011**.

## Getting started

1. `cp .env.example .env` (never commit it; the Prisma CLI reads `.env`, and Next.js reads it too. `.env.local` may override values for the app only)
2. `npm install`
3. `npm run dev` (http://localhost:3011)
4. For PostgreSQL: set `DATA_SOURCE="prisma"`, then `npm run db:up` and `npm run db:migrate`

Gate before every commit: `npm run lint && npm run typecheck && npm run test`.

`DATA_SOURCE` supports `mock` (in-memory, per-org) and `prisma`. See `docs/ARCHITECTURE.md`.

## QuikIT integration

Authentication is opt-in (`QUIKIT_AUTH_ENABLED`). In standalone `mock` mode, the app uses an explicit demo organisation context so local modules remain usable without QuikIT; production Prisma routes use the QuikIT identity seam when enabled. Status, what still needs the real QuikIT monorepo, and open decisions are in [`docs/integration/QUIKIT_INTEGRATION.md`](docs/integration/QUIKIT_INTEGRATION.md). The proposed shared-schema models are in [`docs/integration/SCHEMA_CHANGE_REQUEST.md`](docs/integration/SCHEMA_CHANGE_REQUEST.md).

## API conventions

- Envelope: `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`; creates return 201.
- Lists are paginated: `?page=1&limit=20` (max 100) -> `{ data, pagination: { page, limit, total, totalPages } }`.
- Every query is scoped by the caller's active `orgId`; clients can never supply it.
- `GET /api/health` is public and returns `{ ok, version, db }`. API reference: `/api/docs`.

## Finova AI assistant

A deterministic, **zero-LLM** assistant (`src/lib/assistant/engine.ts`) answers from the same data the pages render, so it can see every module (accounts, journal, invoices, expenses, reports) and never invents figures.

- **Natural-language financial search:** deterministic, read-only NLQ for expenses, invoices, payments, accounts, Indian ₹/lakh/crore amounts, FY periods, typo tolerance, deep links, and Finova AI hand-off.
- **Intents:** spending (category / vendor / period, with comparison to the previous period), unpaid / overdue / due-soon / paid / draft invoices, who owes you, payables, revenue, P&L, balance sheet, trial balance, cash & bank, GST, any account or ledger, journal search, `INV-` / `EXP-` / `JE-` lookups, business summary & insights, navigation and how-to.
- **Scope guard:** unrelated questions are refused locally, before any data work.
- **Follow-ups:** "and last month?", "show more".
- **Voice:** start / pause-resume / cancel / stop-and-ask, live transcript, survives browser silence time-outs; optional spoken answers.
- **Where it runs:** in the browser against `useFinova` (the single client data layer). `POST /api/assistant` runs the same engine against Postgres for the caller's org when `DATA_SOURCE=prisma`.
- Tests: `__tests__/unit/assistant.test.ts`.

## Smart Financial Alerts
Finova now derives number-backed, deterministic attention alerts from invoices, expenses, journal and account data. Alerts are read-only, work offline in mock mode, persist user lifecycle state locally, and expose a server `/api/alerts` evaluation endpoint. See `docs/ALERTS.md`.

## Bank Integration

Open `/bank` for statement upload, transaction review, account/consent UI and categorisation rules. See `docs/BANK_INTEGRATION.md` and `docs/BANK_API.md` for the architecture and production AA onboarding boundary.

## Gemini Two-Brain Assistant

The Financial Assistant now uses a two-stage architecture:

1. **Brain #1 — Finova deterministic logic:** existing rule-based assistant runs first. If it produces a supported answer, Gemini is not called.
2. **Brain #2 — Gemini fallback:** Gemini is called only when Brain #1 cannot confidently solve the question.

Gemini keys are configured server-side and are used **strictly one at a time**. The application never sends requests to multiple keys concurrently. For each unanswered request it tries `GEMINI_API_KEY_1`, then `GEMINI_API_KEY_2`, then `GEMINI_API_KEY_3`, then `GEMINI_API_KEY_4`. A key is abandoned for that request when it errors, times out, is unauthorized/rate-limited/quota-limited, or Gemini returns `canAnswer=false`.

### Gemini configuration

Copy `.env.example` to `.env.local` and fill these values:

```env
GEMINI_ENABLED=true
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key
GEMINI_API_KEY_3=your_third_key
GEMINI_API_KEY_4=your_fourth_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=10000
```

Keep the keys server-side. Do not prefix them with `NEXT_PUBLIC_` and do not commit `.env.local`.

## UX, voice and AI controls
- The full-app language preference is managed in Settings → Language. Finova AI also has an AI-language selector with Auto-detect; it persists as `finova-ai-language` and drives the assistant reply language, browser speech recognition locale and browser TTS voice.
- Ask Finova AI is mounted once in the shared shell and is available from the topbar with `Ctrl/⌘ + J`. Hands-free wake listening is opt-in in Settings and supports `Hi Finova`, `Hey Finova`, `Hai Finova` and Hindi wake phrases through the browser speech-recognition API.
- AI queries are limited to 8 per rolling 60 seconds per person. `REDIS_URL` enables the shared sliding-window backend; without Redis the in-memory limiter is used for development.
- Receipt OCR uses local Tesseract asset paths under `/public/tesseract` when the browser assets are installed. The repository also provides a server-side Tesseract CLI fallback and a PDF.js text/raster path.

### Environment controls
```env
FINOVA_AI_RATE_LIMIT_MAX=8
FINOVA_AI_RATE_LIMIT_WINDOW_MS=60000
NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_MAX=8
NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_WINDOW_MS=60000
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=
NEXT_PUBLIC_SUPPORT_EMAIL=support@finova.example
```

### Verification notes
- `assistant.aiLanguage` is not a translation key; the assistant now uses the existing `language.aiLanguage` key, which fixes the literal key shown in the selector.
- Client-side AI rate-limit configuration uses the `NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_*` variables so the displayed quota matches the configured value. Deterministic voice navigation/actions do not consume an AI quota because they never call an AI endpoint.
- Gemini activation uses the validated `GEMINI_ENABLED` environment flag. Four keys remain strictly sequential and are never called concurrently.
- The archive can be syntax/transpile-checked without installed dependencies; full Next.js build/lint/test execution still requires `npm install` in a networked environment.
