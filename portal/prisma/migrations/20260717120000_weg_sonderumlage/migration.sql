-- WEG-Sonderumlage: einmalige, beschlossene Umlage; erzeugt Sollstellungen
-- (DuePosting.source = SONDERUMLAGE), die in offene Posten und Mahnwesen laufen.

CREATE TABLE "Sonderumlage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "totalAmountCents" INTEGER NOT NULL,
    "distributionKey" "DistributionKey" NOT NULL DEFAULT 'MEA',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "resolutionNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sonderumlage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Sonderumlage_propertyId_idx" ON "Sonderumlage"("propertyId");
ALTER TABLE "Sonderumlage" ADD CONSTRAINT "Sonderumlage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sonderumlage" ADD CONSTRAINT "Sonderumlage_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sonderumlage" ADD CONSTRAINT "Sonderumlage_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verknüpfung der Sollstellungen mit der Sonderumlage
ALTER TABLE "DuePosting" ADD COLUMN "sonderumlageId" TEXT;
ALTER TABLE "DuePosting" ADD CONSTRAINT "DuePosting_sonderumlageId_fkey"
  FOREIGN KEY ("sonderumlageId") REFERENCES "Sonderumlage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DuePosting_sonderumlageId_idx" ON "DuePosting"("sonderumlageId");
