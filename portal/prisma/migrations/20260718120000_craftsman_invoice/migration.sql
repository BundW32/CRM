-- Handwerker-Netzwerk (M-L): digitale Rechnung je Vorgang. Der Handwerker reicht
-- über den Magic-Link Betrag + Datei ein; der Verwalter prüft/akzeptiert. Additiv.
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('EINGEREICHT', 'AKZEPTIERT', 'ABGELEHNT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE "CraftsmanInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "craftsmanId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "note" TEXT,
    "storedName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'EINGEREICHT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CraftsmanInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CraftsmanInvoice_ticketId_key" ON "CraftsmanInvoice"("ticketId");
CREATE INDEX "CraftsmanInvoice_organizationId_idx" ON "CraftsmanInvoice"("organizationId");
CREATE INDEX "CraftsmanInvoice_craftsmanId_idx" ON "CraftsmanInvoice"("craftsmanId");
ALTER TABLE "CraftsmanInvoice" ADD CONSTRAINT "CraftsmanInvoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CraftsmanInvoice" ADD CONSTRAINT "CraftsmanInvoice_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CraftsmanInvoice" ADD CONSTRAINT "CraftsmanInvoice_craftsmanId_fkey"
  FOREIGN KEY ("craftsmanId") REFERENCES "Craftsman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
