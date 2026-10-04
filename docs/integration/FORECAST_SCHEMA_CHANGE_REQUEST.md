# Forecast Schema Change Request

No Prisma migration is required for the current implementation.

Future persistence should consider:

- ForecastRun: orgId, horizon, scenario, generatedAt, modelVersion, accuracy metrics
- ForecastAccuracy: forecastRunId, evaluationDate, predictedBalancePaise, actualBalancePaise, errorPaise
- RecurringPattern: orgId, vendor/category fingerprint, amount range, interval, user status
- ForecastPreference: orgId/userId, safetyBufferPaise, defaultHorizon, defaultScenario
- TaxDueDate: orgId, taxType, dueDate, estimatedAmountPaise, source
- InvoicePaymentHistory: invoiceId, expectedDate, actualDate, amountPaise

These are proposals only. Do not apply them until the product/data owner approves the migration.
