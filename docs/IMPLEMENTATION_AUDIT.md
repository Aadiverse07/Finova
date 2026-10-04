# Finova UX Overhaul Implementation Audit

Baseline: uploaded Finova repository. No Git metadata was present in the archive, so this deliverable groups changes by task rather than claiming commits that were not created.

| Task | Implementation | Tests / verification | Known limitation |
|---|---|---|---|
| 1. AI language selector | Home-header picker removed; AI-only selector with Auto-detect, persisted `finova-ai-language`, language passed to both assistant APIs, speech recognition/TTS locale follows selection. | Source scan; assistant language path reviewed. | Sidebar now points to Settings → Language rather than being a second picker.
| 2. Company / Support links | Company routes, Support centre, readable Status page, env-driven support email, sticky-anchor focus handling, Link-based internal navigation. | Playwright link-check added; raw/dead hash and placeholder-email scan is clean. | Full browser click test requires installed Playwright/browser binaries.
| 3. Account control | Reusable AccountMenu in shared shell, session hook, real initials/name/role, sign out/switch account, dynamic greeting/settings identity. | Auth safety unit + auth e2e added; hard-coded identity grep is clean. | Standalone demo identity remains client-local until QuikIT auth is enabled.
| 4. Login / registration | Chooser, sign-in, registration, Zod validation, password strength, salted PBKDF2 digest, duplicate/no-account transitions, auth attempt limiter, focus trap/autocomplete. | Schema/auth tests + e2e added. | Password reset and external provider buttons are intentionally a seam/stub, not a fabricated integration.
| 5. Receipt scanning | Next navigation, type/size/free-limit validation, local Tesseract paths, lazy Hindi OCR, timeout/cancel, PDF.js extraction + scanned-PDF raster OCR, manual fallback. | Receipt extraction unit + upload/review e2e fixture added. | This sandbox could not download the Tesseract worker/core binaries. Traineddata is bundled; `scripts/fetch-tesseract-assets.mjs` materializes worker/core from an installed `tesseract.js` package on a networked build machine.
| 6. AI launcher | Floating bottom-right launcher removed; topbar/home launcher, Ctrl/⌘+J, search hint, responsive icon-only behavior, listening indicator. | Source scan and component wiring reviewed. | Final pixel-level visual comparison requires a running browser.
| 7. Cash forecast | Mock mode computes from live Zustand workspace, Prisma mode remains server-backed, envelope error parsing fixed, populated demo curve, KPIs/chart/scenarios/runway/drivers. | Forecast unit/e2e added; parser/source audit clean. | Browser/render tests not executable here without dependencies.
| 8. Dark theme | Customer/bank surfaces use semantic root/dark tokens; OS media-query dependency and white fallback surfaces removed in audited selectors; controls/scrollbars/focus styles updated. | Dark-theme + axe Playwright tests added; source scan clean. | Pixel screenshot assertions need Playwright runtime.
| 9. Copy / typography | Copy guide, i18n fallback logging, 17px root baseline, large text control, Indic font support and updated key copy. | Source scan + copy guide. | The repository still contains legacy hard-coded strings in some older module pages; complete catalogue extraction is not honestly claimed.
| 10. Voice wake / task tools | Singleton wake service, explicit opt-in, browser fuzzy wake matching, active command handoff, typed Zod action registry, read/write confirmation, audit endpoint, undo snapshot for local mutations, spoken replies and browser fallbacks. | Voice/service source review; voice action/limiter tests added where deterministic. | No actual Porcupine/openWakeWord WASM engine was bundled; follow-up turns are not a fully automatic continuous multi-turn voice session; browser speech engines may process recognition externally.
| 11. AI rate limiting | Shared 8/60s rolling-window constant, client UX limiter, both assistant APIs, 429 headers, Redis sliding-window adapter with memory fallback, structured logs/audit events. | Boundary/reset/isolation unit tests added. | Anonymous mock-mode identity header is a development seam; production authenticated QuikIT requests key by the authenticated user.

## Validation

- TypeScript/TSX parser/transpile scan: **215 files, 0 syntax diagnostics**.
- `npm run lint`: **not runnable in this sandbox** because dependencies are absent (`next: not found`).
- `npm run typecheck`: **not runnable to completion** because the repository dependencies and Node/Vitest/Next type packages are absent. The command surfaced dependency-resolution errors; one concrete forecast-engine strictness issue was independently fixed.
- `npm run test`: **not runnable in this sandbox** because `vitest` is not installed.
- `npm install --no-audit --no-fund`: timed out in this sandbox; external DNS/download access was unavailable for the missing packages/Tesseract browser binaries.

## Review notes

- `.env.local` and `tsconfig.tsbuildinfo` are excluded from the final archive.
- Gemini keys remain server-side; no `NEXT_PUBLIC_GEMINI_*` variables were introduced.
- No raw SQL or arbitrary code execution is exposed to the assistant action registry.
