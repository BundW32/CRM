-- Anrechnung einer Zahlung auf eine bestimmte Forderung (§§ 366, 367 BGB).
-- Booking.unitId bleibt als Vorfilter bestehen: Es beantwortet "von wem kam das
-- Geld", diese Tabelle "worauf wurde es angerechnet".
CREATE TABLE "PaymentAllocation" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "bookingId"      TEXT NOT NULL,
  "duePostingId"   TEXT NOT NULL,
  "amountCents"    INTEGER NOT NULL,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAllocation_bookingId_duePostingId_key"
  ON "PaymentAllocation"("bookingId", "duePostingId");
CREATE INDEX "PaymentAllocation_duePostingId_idx" ON "PaymentAllocation"("duePostingId");

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_duePostingId_fkey"
  FOREIGN KEY ("duePostingId") REFERENCES "DuePosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
