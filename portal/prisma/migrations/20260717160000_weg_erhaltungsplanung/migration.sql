-- WEG-Erhaltungsplanung: langfristige Maßnahmenliste je Objekt. Aus den
-- Maßnahmen wird der Rücklagenbedarf hergeleitet und dem Rücklagenstand
-- gegenübergestellt. Rein additiv (neue Tabelle).

CREATE TABLE "MaintenanceMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trade" TEXT,
    "targetYear" INTEGER NOT NULL,
    "estimatedCents" INTEGER NOT NULL,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceMeasure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceMeasure_propertyId_idx" ON "MaintenanceMeasure"("propertyId");
CREATE INDEX "MaintenanceMeasure_propertyId_done_idx" ON "MaintenanceMeasure"("propertyId", "done");
ALTER TABLE "MaintenanceMeasure" ADD CONSTRAINT "MaintenanceMeasure_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceMeasure" ADD CONSTRAINT "MaintenanceMeasure_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceMeasure" ADD CONSTRAINT "MaintenanceMeasure_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
