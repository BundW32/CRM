-- Wartungs-/Prüfaufgaben mit Fälligkeit
CREATE TYPE "MaintenanceInterval" AS ENUM ('MONATLICH', 'QUARTALSWEISE', 'HALBJAEHRLICH', 'JAEHRLICH', 'ZWEIJAEHRLICH', 'EINMALIG');

CREATE TABLE "MaintenanceTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "interval" "MaintenanceInterval" NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "lastDoneAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "propertyId" TEXT,
  "craftsmanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_craftsmanId_fkey"
  FOREIGN KEY ("craftsmanId") REFERENCES "Craftsman"("id") ON DELETE SET NULL ON UPDATE CASCADE;
