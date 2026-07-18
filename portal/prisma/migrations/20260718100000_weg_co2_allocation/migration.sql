-- CO2-Kostenaufteilung (M-I, CO2KostAufG): je Objekt und Jahr der CO2-Kostenanteil
-- und die Gesamtemissionen; daraus wird der Vermieter-/Mieteranteil hergeleitet.
-- Rein additiv (neue Tabelle).
CREATE TABLE "Co2Allocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalCo2Cents" INTEGER NOT NULL,
    "emissionsKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Co2Allocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Co2Allocation_propertyId_year_key" ON "Co2Allocation"("propertyId", "year");
CREATE INDEX "Co2Allocation_propertyId_idx" ON "Co2Allocation"("propertyId");
ALTER TABLE "Co2Allocation" ADD CONSTRAINT "Co2Allocation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Co2Allocation" ADD CONSTRAINT "Co2Allocation_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Co2Allocation" ADD CONSTRAINT "Co2Allocation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
