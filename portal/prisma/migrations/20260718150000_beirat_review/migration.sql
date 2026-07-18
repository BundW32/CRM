-- Prüfvermerk des Verwaltungsbeirats (§ 29 III WEG) auf Wirtschaftsplan und
-- Jahresabrechnung (Notiz 5, Rechnungsprüfung). Additiv, nullable.
DO $$ BEGIN
  CREATE TYPE "BeiratReviewStatus" AS ENUM ('GEPRUEFT', 'ANMERKUNGEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "EconomicPlan" ADD COLUMN IF NOT EXISTS "beiratReviewStatus" "BeiratReviewStatus";
ALTER TABLE "EconomicPlan" ADD COLUMN IF NOT EXISTS "beiratReviewNote" TEXT;
ALTER TABLE "EconomicPlan" ADD COLUMN IF NOT EXISTS "beiratReviewById" TEXT;
ALTER TABLE "EconomicPlan" ADD COLUMN IF NOT EXISTS "beiratReviewedAt" TIMESTAMP(3);

ALTER TABLE "AnnualStatement" ADD COLUMN IF NOT EXISTS "beiratReviewStatus" "BeiratReviewStatus";
ALTER TABLE "AnnualStatement" ADD COLUMN IF NOT EXISTS "beiratReviewNote" TEXT;
ALTER TABLE "AnnualStatement" ADD COLUMN IF NOT EXISTS "beiratReviewById" TEXT;
ALTER TABLE "AnnualStatement" ADD COLUMN IF NOT EXISTS "beiratReviewedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "EconomicPlan" ADD CONSTRAINT "EconomicPlan_beiratReviewById_fkey"
    FOREIGN KEY ("beiratReviewById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AnnualStatement" ADD CONSTRAINT "AnnualStatement_beiratReviewById_fkey"
    FOREIGN KEY ("beiratReviewById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
