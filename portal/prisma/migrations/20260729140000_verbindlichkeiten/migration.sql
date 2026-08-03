-- Verbindlichkeiten der Gemeinschaft (§ 28 Abs. 4 WEG)
CREATE TYPE "VerbindlichkeitKind" AS ENUM ('RECHNUNG', 'DARLEHEN', 'SONSTIGE');

CREATE TABLE "Verbindlichkeit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "VerbindlichkeitKind" NOT NULL DEFAULT 'RECHNUNG',
    "creditor" TEXT,
    "amountCents" INTEGER NOT NULL,
    "incurredOn" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verbindlichkeit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Verbindlichkeit_propertyId_idx" ON "Verbindlichkeit"("propertyId");
CREATE INDEX "Verbindlichkeit_propertyId_settledAt_idx" ON "Verbindlichkeit"("propertyId", "settledAt");

ALTER TABLE "Verbindlichkeit" ADD CONSTRAINT "Verbindlichkeit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Verbindlichkeit" ADD CONSTRAINT "Verbindlichkeit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Verbindlichkeit" ADD CONSTRAINT "Verbindlichkeit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
