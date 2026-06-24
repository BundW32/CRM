-- Handover: zusätzliche Stammdaten
ALTER TABLE "Handover" ADD COLUMN     "moveDate" TIMESTAMP(3);
ALTER TABLE "Handover" ADD COLUMN     "livingArea" DOUBLE PRECISION;
ALTER TABLE "Handover" ADD COLUMN     "roomCount" DOUBLE PRECISION;
ALTER TABLE "Handover" ADD COLUMN     "personCount" INTEGER;
ALTER TABLE "Handover" ADD COLUMN     "tenantBirthDate" TIMESTAMP(3);
ALTER TABLE "Handover" ADD COLUMN     "tenant2Name" TEXT;
ALTER TABLE "Handover" ADD COLUMN     "tenant2BirthDate" TIMESTAMP(3);
ALTER TABLE "Handover" ADD COLUMN     "tenant2Signature" TEXT;
ALTER TABLE "Handover" ADD COLUMN     "managerCompany" TEXT;

-- HandoverRoom: strukturierte Prüfpunkte je Raum
ALTER TABLE "HandoverRoom" ADD COLUMN     "checks" JSONB;
