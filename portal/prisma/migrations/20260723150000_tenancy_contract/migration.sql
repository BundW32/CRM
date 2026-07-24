-- Mietvertrags-Kerndaten je Mietverhaeltnis (Mietverwaltung): Kaltmiete,
-- Kaution und optional der Mietvertrag als Datei.
ALTER TABLE "Tenancy" ADD COLUMN "rentColdCents" INTEGER;
ALTER TABLE "Tenancy" ADD COLUMN "depositCents" INTEGER;
ALTER TABLE "Tenancy" ADD COLUMN "contractStoredName" TEXT;
ALTER TABLE "Tenancy" ADD COLUMN "contractFileName" TEXT;
ALTER TABLE "Tenancy" ADD COLUMN "contractMimeType" TEXT;
