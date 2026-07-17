-- WEG-Mahnwesen: Hausgeld-Zahlungserinnerung/Mahnungen je Einheit
-- (Stufen 1–3 wie lib/dunning.ts, Rückstand/Empfänger als Snapshot).

CREATE TABLE "HausgeldMahnung" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "arrearsCents" INTEGER NOT NULL,
    "paymentDeadline" TIMESTAMP(3) NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HausgeldMahnung_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HausgeldMahnung_unitId_idx" ON "HausgeldMahnung"("unitId");
CREATE INDEX "HausgeldMahnung_propertyId_idx" ON "HausgeldMahnung"("propertyId");
ALTER TABLE "HausgeldMahnung" ADD CONSTRAINT "HausgeldMahnung_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HausgeldMahnung" ADD CONSTRAINT "HausgeldMahnung_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HausgeldMahnung" ADD CONSTRAINT "HausgeldMahnung_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HausgeldMahnung" ADD CONSTRAINT "HausgeldMahnung_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
