-- SEPA-Lastschrift (M-F): Mandate je Einheit + Gläubiger-ID am Objekt. Der
-- pain.008-Export erzeugt eine XML-Datei zum Selbst-Upload (Zero-Key). Additiv.

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "sepaCreditorId" TEXT;

DO $$ BEGIN
  CREATE TYPE "SepaSequence" AS ENUM ('FRST', 'RCUR', 'OOFF');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE "SepaMandate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "mandateRef" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "signedDate" TIMESTAMP(3) NOT NULL,
    "sequence" "SepaSequence" NOT NULL DEFAULT 'FRST',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SepaMandate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SepaMandate_propertyId_unitId_key" ON "SepaMandate"("propertyId", "unitId");
CREATE INDEX "SepaMandate_propertyId_idx" ON "SepaMandate"("propertyId");
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
