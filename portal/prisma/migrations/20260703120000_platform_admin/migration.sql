-- Plattform-Betreiber-Ebene: Admin-Flag, Kundennotiz, manuelles Rechnungsmodul.
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('ENTWURF', 'OFFEN', 'BEZAHLT', 'STORNIERT');

ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "platformNote" TEXT;

CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 19,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'ENTWURF',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformInvoice_year_number_key" ON "PlatformInvoice"("year", "number");
CREATE INDEX "PlatformInvoice_organizationId_idx" ON "PlatformInvoice"("organizationId");
CREATE INDEX "PlatformInvoice_status_idx" ON "PlatformInvoice"("status");
CREATE INDEX "PlatformInvoiceItem_invoiceId_idx" ON "PlatformInvoiceItem"("invoiceId");

ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoiceItem" ADD CONSTRAINT "PlatformInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
