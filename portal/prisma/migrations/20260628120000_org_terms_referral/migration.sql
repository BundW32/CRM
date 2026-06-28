-- Phase 6: Rechts-Zustimmung + Akquise-Herkunft auf der Organisation
ALTER TABLE "Organization" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "Organization" ADD COLUMN "referralSource" TEXT;
