# Finova Cash-Flow Forecasting

## MVP / implemented

- 30/60/90/180/365-day horizons
- Current cash from active ASSET accounts whose code starts with `10` or whose name contains bank/cash
- Outstanding invoice receipts weighted by observed customer payment behaviour
- Best / Expected / Worst invoice scenarios
- Recurring expense detection using vendor/category, amount stability and interval consistency
- User confirmation/rejection of recurring candidates
- Transparent weighted moving-average expense baseline
- Seasonality adjustment when at least 12 monthly observations are available
- Historical cash-in baseline when sufficient history exists
- Daily projected balance, best/worst confidence band, zero line and safety-buffer line
- Weekly cash-in/cash-out chart
- Forecast event drill-down
- Safety-buffer warning and runway estimate
- What-if income/expense simulation without writing to the ledger
- Reminder-message suggestion for forecast-impacting invoices; this build copies the message rather than sending it because the data model has no customer email and no delivery provider
- CSV export and print/PDF browser workflow
- IST date handling
- BigInt paise arithmetic inside the forecast engine
- Free/premium gating through `FINOVA_PREMIUM=true`

## Architecture

`GET /api/forecast` -> org auth -> rate limit -> workspace loader -> pure forecast engine -> BigInt-safe JSON.

Mock mode uses the existing seed workspace. Database mode uses the existing `loadWorkspace(orgId)` adapter, so tenant scoping remains at the API boundary.

## Important data limitations

The current Finova data model does not contain:

- partial invoice paid amount/history
- disputed/written-off invoice state
- customer email addresses
- recurring-payment records separate from historical expenses
- tax due-date records for GST/TDS/advance tax
- subscription/tier records
- bank-holiday settlement calendars
- multi-entity identifiers
- forecast-history persistence

The implementation therefore does not invent those values. The forecast exposes the available information and documents the missing inputs instead of fabricating them.

## Tax/compliance

GST Payable exists in the accounting model, but a tax due date is not stored. The forecast does not fabricate a filing/payment date. A future compliance module should add authoritative due-date data and then create dated forecast events for GST/TDS/advance tax.

## Premium gating

The API returns `premium: true` only when `FINOVA_PREMIUM=true`. Free mode exposes the 30-day forecast and summary-card preview. Premium mode unlocks the longer horizons, scenarios, simulator, events and exports.

## Disclaimer

Forecasts are estimates based on recorded Finova data and assumptions. They are not financial advice.
