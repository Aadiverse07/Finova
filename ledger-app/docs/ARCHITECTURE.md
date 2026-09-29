# Architecture

Route handlers are transport adapters; accounting rules belong in `src/lib/ledger`. Monetary values are integer paise at the application boundary and BigInt in PostgreSQL. Journal entries are intended to be append-only; corrections are represented by reversal entries. Repository implementations are selected by `DATA_SOURCE`.

The current scaffold establishes the app shell, data model, money helpers, validation primitives, and CI/test configuration. Full persistence, posting workflows, reports, OpenAPI registration, and database trigger migration remain implementation work.
