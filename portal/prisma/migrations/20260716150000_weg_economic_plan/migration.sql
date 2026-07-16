-- WEG-Finanzen Stufe 2: Wirtschaftsplan (§ 28 Abs. 1 WEG), Hausgeld-Sollstellungen
-- und Zahlungszuordnung (Booking.unitId) für offene Posten.

CREATE TYPE "PlanStatus" AS ENUM ('ENTWURF', 'BESCHLOSSEN');

-- Zahlungszuordnung: Hausgeld-Eingang einer Einheit zuordnen
ALTER TABLE "Booking" ADD COLUMN "unitId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Booking_unitId_idx" ON "Booking"("unitId");

-- Wirtschaftsplan
CREATE TABLE "EconomicPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ENTWURF',
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EconomicPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EconomicPlan_propertyId_year_key" ON "EconomicPlan"("propertyId", "year");
CREATE INDEX "EconomicPlan_propertyId_idx" ON "EconomicPlan"("propertyId");
ALTER TABLE "EconomicPlan" ADD CONSTRAINT "EconomicPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomicPlan" ADD CONSTRAINT "EconomicPlan_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomicPlan" ADD CONSTRAINT "EconomicPlan_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Planposition je Kostenart
CREATE TABLE "EconomicPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "costTypeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "previousActualCents" INTEGER,
    CONSTRAINT "EconomicPlanItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EconomicPlanItem_planId_costTypeId_key" ON "EconomicPlanItem"("planId", "costTypeId");
CREATE INDEX "EconomicPlanItem_costTypeId_idx" ON "EconomicPlanItem"("costTypeId");
ALTER TABLE "EconomicPlanItem" ADD CONSTRAINT "EconomicPlanItem_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "EconomicPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EconomicPlanItem" ADD CONSTRAINT "EconomicPlanItem_costTypeId_fkey"
  FOREIGN KEY ("costTypeId") REFERENCES "CostType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sollstellung (monatliches Hausgeld je Einheit)
CREATE TABLE "DuePosting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "planId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WIRTSCHAFTSPLAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DuePosting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DuePosting_planId_unitId_periodYear_periodMonth_key"
  ON "DuePosting"("planId", "unitId", "periodYear", "periodMonth");
CREATE INDEX "DuePosting_propertyId_idx" ON "DuePosting"("propertyId");
CREATE INDEX "DuePosting_unitId_idx" ON "DuePosting"("unitId");
ALTER TABLE "DuePosting" ADD CONSTRAINT "DuePosting_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuePosting" ADD CONSTRAINT "DuePosting_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuePosting" ADD CONSTRAINT "DuePosting_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuePosting" ADD CONSTRAINT "DuePosting_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "EconomicPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
