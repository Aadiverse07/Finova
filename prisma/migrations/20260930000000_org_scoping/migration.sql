-- Org (tenant) scoping per QuikIT docs/04-db-patterns.md: every tenant-scoped table carries an
-- indexed "orgId" and uniqueness is per org.
--
-- ASSUMPTION: the tables are empty. The init migration shipped no data and no persistence layer
-- wrote to them, so the new NOT NULL columns have no default/backfill. If you have loaded data,
-- add a backfill step before applying.
--
-- The append-only journal triggers fire on row UPDATE/DELETE only, so adding columns is unaffected.

-- Account
ALTER TABLE "Account" ADD COLUMN "orgId" TEXT NOT NULL;
ALTER TABLE "Account" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Account" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Account" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Account" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Account" DROP CONSTRAINT "Account_code_key";
CREATE UNIQUE INDEX "Account_orgId_code_key" ON "Account"("orgId", "code");
CREATE INDEX "Account_orgId_idx" ON "Account"("orgId");
CREATE INDEX "Account_orgId_type_idx" ON "Account"("orgId", "type");

-- JournalEntry
ALTER TABLE "JournalEntry" ADD COLUMN "orgId" TEXT NOT NULL;
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_entryNo_key";
DROP INDEX "JournalEntry_date_idx";
DROP INDEX "JournalEntry_source_idx";
CREATE UNIQUE INDEX "JournalEntry_orgId_entryNo_key" ON "JournalEntry"("orgId", "entryNo");
CREATE INDEX "JournalEntry_orgId_idx" ON "JournalEntry"("orgId");
CREATE INDEX "JournalEntry_orgId_date_idx" ON "JournalEntry"("orgId", "date");
CREATE INDEX "JournalEntry_orgId_source_idx" ON "JournalEntry"("orgId", "source");

-- JournalLine
ALTER TABLE "JournalLine" ADD COLUMN "orgId" TEXT NOT NULL;
DROP INDEX "JournalLine_accountId_idx";
CREATE INDEX "JournalLine_orgId_idx" ON "JournalLine"("orgId");
CREATE INDEX "JournalLine_orgId_accountId_idx" ON "JournalLine"("orgId", "accountId");

-- Invoice
ALTER TABLE "Invoice" ADD COLUMN "orgId" TEXT NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Invoice" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_number_key";
CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");
CREATE INDEX "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");

-- InvoiceLine
ALTER TABLE "InvoiceLine" ADD COLUMN "orgId" TEXT NOT NULL;
CREATE INDEX "InvoiceLine_orgId_idx" ON "InvoiceLine"("orgId");

-- Expense
ALTER TABLE "Expense" ADD COLUMN "orgId" TEXT NOT NULL;
ALTER TABLE "Expense" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Expense" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Expense" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "updatedBy" TEXT;
CREATE INDEX "Expense_orgId_idx" ON "Expense"("orgId");
CREATE INDEX "Expense_orgId_date_idx" ON "Expense"("orgId", "date");

-- Counter: sequences are per org
ALTER TABLE "Counter" DROP CONSTRAINT "Counter_pkey";
ALTER TABLE "Counter" ADD COLUMN "orgId" TEXT NOT NULL;
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("orgId", "name");
