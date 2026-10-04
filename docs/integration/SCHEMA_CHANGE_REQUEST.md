# Alerts persistence schema proposal

Phase 9 keeps alert state client-side as required. For cross-device sync, a future migration can add `AlertState` and `AlertPreference` records keyed by organization and user. This document intentionally does not modify Prisma or add migrations.