-- Verbindlichkeit kennt ihre Zahlung.
--
-- „Als bezahlt buchen" legt die Ausgabe an und markiert die Rechnung als
-- beglichen — die Verknüpfung zwischen beiden stand bisher nur im Audit-Log.
-- Additiv: bestehende Verbindlichkeiten bleiben ohne Buchung (NULL).
ALTER TABLE "Verbindlichkeit" ADD COLUMN "bookingId" TEXT;

CREATE INDEX "Verbindlichkeit_bookingId_idx" ON "Verbindlichkeit"("bookingId");

ALTER TABLE "Verbindlichkeit"
  ADD CONSTRAINT "Verbindlichkeit_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
