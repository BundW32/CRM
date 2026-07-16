-- WEG-Finanzen Stufe 3: tagesgenaue Eigentümerschaft je Einheit und
-- Jahresabrechnung (§ 28 Abs. 2 WEG) mit manueller Einheiten-Verteilung
-- (Heizkosten) und harter Endbestands-Plausibilitätsprüfung.

CREATE TYPE "StatementStatus" AS ENUM ('ENTWURF', 'FERTIG');

-- Eigentümerschaft je Einheit (Eigentümerwechsel, Miteigentum)
CREATE TABLE "UnitOwnership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitOwnership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UnitOwnership_unitId_idx" ON "UnitOwnership"("unitId");
CREATE INDEX "UnitOwnership_userId_idx" ON "UnitOwnership"("userId");
ALTER TABLE "UnitOwnership" ADD CONSTRAINT "UnitOwnership_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitOwnership" ADD CONSTRAINT "UnitOwnership_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitOwnership" ADD CONSTRAINT "UnitOwnership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jahresabrechnung
CREATE TABLE "AnnualStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'ENTWURF',
    "finalizedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnualStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnnualStatement_propertyId_year_key" ON "AnnualStatement"("propertyId", "year");
CREATE INDEX "AnnualStatement_propertyId_idx" ON "AnnualStatement"("propertyId");
ALTER TABLE "AnnualStatement" ADD CONSTRAINT "AnnualStatement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnualStatement" ADD CONSTRAINT "AnnualStatement_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnualStatement" ADD CONSTRAINT "AnnualStatement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manuelle Verteilung je Einheit (VERBRAUCH/INDIVIDUELL/FESTBETRAG)
CREATE TABLE "StatementUnitAmount" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "costTypeId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "StatementUnitAmount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatementUnitAmount_statementId_costTypeId_unitId_key"
  ON "StatementUnitAmount"("statementId", "costTypeId", "unitId");
CREATE INDEX "StatementUnitAmount_unitId_idx" ON "StatementUnitAmount"("unitId");
CREATE INDEX "StatementUnitAmount_costTypeId_idx" ON "StatementUnitAmount"("costTypeId");
ALTER TABLE "StatementUnitAmount" ADD CONSTRAINT "StatementUnitAmount_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "AnnualStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatementUnitAmount" ADD CONSTRAINT "StatementUnitAmount_costTypeId_fkey"
  FOREIGN KEY ("costTypeId") REFERENCES "CostType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatementUnitAmount" ADD CONSTRAINT "StatementUnitAmount_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Endbestands-Prüfung je Konto (laut Kontoauszug)
CREATE TABLE "StatementAccountCheck" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportedEndCents" INTEGER NOT NULL,
    CONSTRAINT "StatementAccountCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatementAccountCheck_statementId_accountId_key"
  ON "StatementAccountCheck"("statementId", "accountId");
CREATE INDEX "StatementAccountCheck_accountId_idx" ON "StatementAccountCheck"("accountId");
ALTER TABLE "StatementAccountCheck" ADD CONSTRAINT "StatementAccountCheck_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "AnnualStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatementAccountCheck" ADD CONSTRAINT "StatementAccountCheck_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
