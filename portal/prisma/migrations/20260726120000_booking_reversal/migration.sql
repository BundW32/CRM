-- Storno einer Buchung: die Gegenbuchung zeigt auf das Original.
-- Buchungen werden weiterhin nie geändert oder gelöscht (append-only).
ALTER TABLE "Booking" ADD COLUMN "reversalOfId" TEXT;

-- Jede Buchung darf höchstens einmal storniert werden.
CREATE UNIQUE INDEX "Booking_reversalOfId_key" ON "Booking"("reversalOfId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
