-- Direktzuordnung einer Ausgabe an eine Einheit.
--
-- Kosten, die nur eine Einheit betreffen (der Gaskamin einer Wohnung), werden
-- nicht nach Umlageschlüssel verteilt, sondern dieser Einheit in der
-- Jahresabrechnung vollständig in Rechnung gestellt. Eigenes Feld neben
-- `unitId` (Zahlungszuordnung des Hausgelds). Additiv, bestehende Buchungen
-- bleiben ohne Direktzuordnung (NULL).
ALTER TABLE "Booking" ADD COLUMN "directUnitId" TEXT;

CREATE INDEX "Booking_directUnitId_idx" ON "Booking"("directUnitId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_directUnitId_fkey"
  FOREIGN KEY ("directUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
