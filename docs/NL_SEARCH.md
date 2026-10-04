# Finova Natural-Language Search

Finova's natural-language search is a deterministic, read-only query layer for expenses, invoices, transactions and accounts. In mock mode it runs fully offline against the same Zustand workspace used by the pages. The Prisma endpoint maps database paise to the same rupee `Workspace` shape used by the assistant before executing the identical spec.

## Architecture

`question -> scope/write guards -> period + amount + status + entity parsing -> Zod QuerySpec -> read-only executor -> interpretation/results -> module deep link`

The existing assistant period parser and scope guard are shared. The repository did not contain the later `src/lib/search/*` Real Global Search upgrade, so NLQ lives under `src/lib/nlq/` and the existing global search remains its entry point.

## Adding vocabulary

Add an intent or synonym in `src/lib/nlq/lexicon.ts`. Entity names are resolved from the current workspace with exact, prefix, word-boundary and small edit-distance matching. Never add tenant data to source code.

## Security

The API is authenticated with `withOrgAuth`, rate limited, read-only, and always loads Prisma records using the session `orgId`. The parser creates a validated data object; it never generates SQL or executable code. Write-style questions are refused before workspace loading in the API route.

## Evaluation

The corpus contains 60 cases. `__tests__/unit/nlq-corpus.test.ts` checks corpus size, read-only/out-of-scope safety, and deterministic entity-intent accuracy for standalone actionable cases. Full field-level exact-spec precision/recall still requires the project dependencies to be installed and the Vitest suite to execute. No accuracy percentage is claimed when that environment is unavailable.

## Future roadmap

- Inline result charts and table/chart toggle
- CSV/PDF export and saved smart views
- Natural-language alerts
- Customer/vendor 360-degree timelines
- Analytical/anomaly/duplicate queries
- GST-aware analytical queries
- Prisma filter push-down and indexes
- Hindi/regional-language and Devanagari support
- Anonymised chip-edit learning loop
- Conversational clarification for ambiguous names
- Optional provider-specific LLM parser behind `NL_SEARCH_LLM`, disabled by default

## Corpus

`__tests__/fixtures/nlq-corpus.json` contains the 20 requested examples plus 40 additional Indian-context, date, amount, status, Hinglish, typo and voice-style examples. The unit suite exercises the core golden examples; full precision/recall should be run with installed dependencies before reporting a percentage.
