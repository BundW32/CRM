-- Verwaltungsart (WEG vs. Mietverwaltung) + Allgemeinzähler je Objekt
CREATE TYPE "ManagementType" AS ENUM ('MIETVERWALTUNG', 'WEG');
ALTER TABLE "Property" ADD COLUMN "managementType" "ManagementType" NOT NULL DEFAULT 'MIETVERWALTUNG';

-- Zähler kann nun einem Objekt (Allgemein) statt einer Einheit zugeordnet sein
ALTER TABLE "Meter" ALTER COLUMN "unitId" DROP NOT NULL;
ALTER TABLE "Meter" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
