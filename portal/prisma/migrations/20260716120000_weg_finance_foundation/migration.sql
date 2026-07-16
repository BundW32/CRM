-- WEG-Finanzfundament: Stammdaten-Erweiterung (MEA/Fläche/Personen), Kostenarten,
-- Konten (Giro/Rücklage getrennt), Buchungen (Integer-Cent) und CSV-Bankimport.

-- Neue Enums
CREATE TYPE "UnitType" AS ENUM ('WOHNUNG', 'TEILEIGENTUM', 'STELLPLATZ', 'SONSTIGES');
CREATE TYPE "DistributionKey" AS ENUM ('MEA', 'FLAECHE', 'EINHEITEN', 'PERSONEN', 'VERBRAUCH', 'FESTBETRAG', 'INDIVIDUELL');
CREATE TYPE "CostCategory" AS ENUM ('BETRIEBSKOSTEN', 'INSTANDHALTUNG', 'VERWALTUNG', 'RUECKLAGENZUFUEHRUNG', 'SONSTIGES');
CREATE TYPE "LaborShareType" AS ENUM ('KEINE', 'HAUSHALTSNAHE_DIENSTLEISTUNG', 'HANDWERKERLEISTUNG');
CREATE TYPE "LedgerAccountKind" AS ENUM ('GIRO', 'RUECKLAGE');
CREATE TYPE "BookingKind" AS ENUM ('EINNAHME', 'AUSGABE', 'UMBUCHUNG');

-- Property: MEA-Nenner + Wirtschaftsjahr-Beginn
ALTER TABLE "Property" ADD COLUMN "meaTotal" INTEGER;
ALTER TABLE "Property" ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;

-- Unit: Finanzstammdaten für die Kostenverteilung
ALTER TABLE "Unit" ADD COLUMN "unitType" "UnitType" NOT NULL DEFAULT 'WOHNUNG';
ALTER TABLE "Unit" ADD COLUMN "mea" INTEGER;
ALTER TABLE "Unit" ADD COLUMN "livingArea" DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN "personCount" INTEGER;
ALTER TABLE "Unit" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Kostenart
CREATE TABLE "CostType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL DEFAULT 'BETRIEBSKOSTEN',
    "distributionKey" "DistributionKey" NOT NULL DEFAULT 'MEA',
    "laborShareType" "LaborShareType" NOT NULL DEFAULT 'KEINE',
    "recoverableBetrKV" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostType_propertyId_idx" ON "CostType"("propertyId");
ALTER TABLE "CostType" ADD CONSTRAINT "CostType_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostType" ADD CONSTRAINT "CostType_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Konto (Giro | Rücklage)
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LedgerAccountKind" NOT NULL DEFAULT 'GIRO',
    "iban" TEXT,
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "openingBalanceDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerAccount_propertyId_idx" ON "LedgerAccount"("propertyId");
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Import-Vorgang (CSV)
CREATE TABLE "BankImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CSV',
    "rowsTotal" INTEGER NOT NULL,
    "rowsImported" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BankImportBatch_accountId_idx" ON "BankImportBatch"("accountId");
CREATE INDEX "BankImportBatch_propertyId_idx" ON "BankImportBatch"("propertyId");
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Buchung
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "costTypeId" TEXT,
    "kind" "BookingKind" NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "amountCents" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "counterparty" TEXT,
    "reference" TEXT,
    "importBatchId" TEXT,
    "dedupeHash" TEXT,
    "transferGroupId" TEXT,
    "transferOut" BOOLEAN,
    "belegStoredName" TEXT,
    "belegFileName" TEXT,
    "belegMimeType" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Booking_accountId_dedupeHash_key" ON "Booking"("accountId", "dedupeHash");
CREATE INDEX "Booking_propertyId_idx" ON "Booking"("propertyId");
CREATE INDEX "Booking_accountId_idx" ON "Booking"("accountId");
CREATE INDEX "Booking_costTypeId_idx" ON "Booking"("costTypeId");
CREATE INDEX "Booking_importBatchId_idx" ON "Booking"("importBatchId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_costTypeId_fkey"
  FOREIGN KEY ("costTypeId") REFERENCES "CostType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "BankImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
