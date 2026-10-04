# Receipt scanning persistence proposal

The current standalone Prisma schema has no receipt/document models. This proposal is intentionally separate from the working browser-mode implementation so the build does not claim a database migration that has not been applied.

```prisma
model ReceiptScan {
  id                 String   @id @default(cuid())
  orgId              String
  fileName           String
  mimeType            String
  sizeBytes           Int
  objectKey           String
  imageSha256         String
  status              String
  ocrText             String?
  extractionJson      Json
  provider            String
  providerVersion     String?
  overallConfidence   Decimal? @db.Decimal(5,4)
  duplicateExpenseId  String?
  matchedTransactionId String?
  confirmedExpenseId  String?
  createdBy           String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?
  @@index([orgId, createdAt])
  @@index([orgId, imageSha256])
  @@index([orgId, status])
}

model ReceiptCorrection {
  id          String   @id @default(cuid())
  orgId       String
  scanId      String
  fieldPath   String
  oldValue    Json?
  newValue    Json?
  createdBy   String
  createdAt   DateTime @default(now())
  @@index([orgId, scanId])
  @@index([orgId, fieldPath])
}

model ReceiptVendorCategory {
  id          String   @id @default(cuid())
  orgId       String
  vendorKey   String
  category    String
  confidence  Decimal  @db.Decimal(5,4)
  updatedAt   DateTime @updatedAt
  @@unique([orgId, vendorKey])
}
```

Production object storage should retain the immutable original under `objectKey`, use short-lived signed URLs, encrypt at rest, and delete both object and metadata on an approved deletion request. Full payment-card numbers must not be stored.
