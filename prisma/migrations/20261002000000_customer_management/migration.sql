-- Customer Management schema. Generated as an explicit migration so the nullable invoice.customerId preserves legacy invoices.
ALTER TABLE "Invoice" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Invoice_orgId_customerId_idx" ON "Invoice"("orgId", "customerId");

CREATE TYPE "CustomerType" AS ENUM ('BUSINESS','INDIVIDUAL');
CREATE TYPE "GstTreatment" AS ENUM ('REGISTERED','UNREGISTERED','SEZ','EXPORT','COMPOSITION');
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE','OVERDUE','INACTIVE','BLOCKED');
CREATE TYPE "CustomerPaymentMethod" AS ENUM ('BANK_TRANSFER','UPI','CARD','CASH','CHEQUE','OTHER');
CREATE TYPE "CreditNoteStatus" AS ENUM ('OPEN','APPLIED','VOID');
CREATE TYPE "CustomerActivityKind" AS ENUM ('NOTE','REMINDER','EMAIL','CALL','STATUS');

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "type" "CustomerType" NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "gstin" TEXT,
  "pan" TEXT,
  "gstTreatment" "GstTreatment" NOT NULL DEFAULT 'UNREGISTERED',
  "tdsApplicable" BOOLEAN NOT NULL DEFAULT false,
  "tdsRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "creditLimitPaise" BIGINT NOT NULL DEFAULT 0,
  "openingBalancePaise" BIGINT NOT NULL DEFAULT 0,
  "preferredPaymentMethod" "CustomerPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "discountTerms" TEXT,
  "category" TEXT,
  "assignedTo" TEXT,
  "source" TEXT,
  "customFields" JSONB,
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_orgId_idx" ON "Customer"("orgId");
CREATE INDEX "Customer_orgId_displayName_idx" ON "Customer"("orgId","displayName");
CREATE INDEX "Customer_orgId_gstin_idx" ON "Customer"("orgId","gstin");
CREATE INDEX "Customer_orgId_phone_idx" ON "Customer"("orgId","phone");
CREATE INDEX "Customer_orgId_email_idx" ON "Customer"("orgId","email");
CREATE INDEX "Customer_orgId_archived_idx" ON "Customer"("orgId","archived");

CREATE TABLE "CustomerContact" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"name" TEXT NOT NULL,"role" TEXT,"email" TEXT,"phone" TEXT,"isPrimary" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerContact_orgId_customerId_idx" ON "CustomerContact"("orgId","customerId");
CREATE TABLE "CustomerAddress" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"kind" TEXT NOT NULL,"line1" TEXT NOT NULL,"line2" TEXT,"city" TEXT NOT NULL,"state" TEXT NOT NULL,"postalCode" TEXT NOT NULL,"country" TEXT NOT NULL DEFAULT 'India',"gstPlaceOfSupply" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerAddress_orgId_customerId_idx" ON "CustomerAddress"("orgId","customerId");
CREATE TABLE "CustomerTag" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"value" TEXT NOT NULL,CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CustomerTag_orgId_customerId_value_key" ON "CustomerTag"("orgId","customerId","value");
CREATE INDEX "CustomerTag_orgId_value_idx" ON "CustomerTag"("orgId","value");
CREATE TABLE "CustomerPayment" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"date" TIMESTAMP(3) NOT NULL,"amountPaise" BIGINT NOT NULL,"method" "CustomerPaymentMethod" NOT NULL,"reference" TEXT,"tdsPaise" BIGINT NOT NULL DEFAULT 0,"reversed" BOOLEAN NOT NULL DEFAULT false,"note" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" TEXT,CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerPayment_orgId_customerId_date_idx" ON "CustomerPayment"("orgId","customerId","date");
CREATE INDEX "CustomerPayment_orgId_reference_idx" ON "CustomerPayment"("orgId","reference");
CREATE TABLE "PaymentAllocation" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"paymentId" TEXT NOT NULL,"invoiceId" TEXT NOT NULL,"amountPaise" BIGINT NOT NULL,CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId","invoiceId");
CREATE INDEX "PaymentAllocation_orgId_invoiceId_idx" ON "PaymentAllocation"("orgId","invoiceId");
CREATE TABLE "CreditNote" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"date" TIMESTAMP(3) NOT NULL,"number" TEXT NOT NULL,"amountPaise" BIGINT NOT NULL,"reason" TEXT NOT NULL,"appliedInvoiceId" TEXT,"status" "CreditNoteStatus" NOT NULL DEFAULT 'OPEN',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CreditNote_orgId_number_key" ON "CreditNote"("orgId","number");
CREATE INDEX "CreditNote_orgId_customerId_date_idx" ON "CreditNote"("orgId","customerId","date");
CREATE TABLE "CustomerActivity" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"kind" "CustomerActivityKind" NOT NULL,"text" TEXT NOT NULL,"createdBy" TEXT,CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerActivity_orgId_customerId_date_idx" ON "CustomerActivity"("orgId","customerId","date");
CREATE TABLE "CustomerDocument" ("id" TEXT NOT NULL,"orgId" TEXT NOT NULL,"customerId" TEXT NOT NULL,"name" TEXT NOT NULL,"kind" TEXT NOT NULL,"storageKey" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" TEXT,CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerDocument_orgId_customerId_createdAt_idx" ON "CustomerDocument"("orgId","customerId","createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTag" ADD CONSTRAINT "CustomerTag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
