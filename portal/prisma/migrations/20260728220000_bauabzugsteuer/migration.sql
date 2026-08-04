-- Bauabzugsteuer (§ 48 EStG)
--
-- Drei Ergänzungen, alle nullable bzw. mit Vorgabewert — kein Backfill nötig:
--   1. Freistellungsbescheinigung (§ 48b EStG) am Handwerker.
--   2. Verknüpfung Buchung -> Handwerker. Der bisherige Freitext
--      "counterparty" bleibt; die 5.000-EUR-Grenze gilt aber je Leistendem,
--      und daraus laesst sich ueber Text nicht summieren.
--   3. Kennzeichen "Bauleistung" an der Kostenart.
ALTER TABLE "Craftsman" ADD COLUMN "exemptionNumber" TEXT;
ALTER TABLE "Craftsman" ADD COLUMN "exemptionValidUntil" TIMESTAMP(3);

ALTER TABLE "Booking" ADD COLUMN "craftsmanId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_craftsmanId_fkey"
  FOREIGN KEY ("craftsmanId") REFERENCES "Craftsman"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Booking_craftsmanId_idx" ON "Booking"("craftsmanId");

ALTER TABLE "CostType" ADD COLUMN "constructionWork" BOOLEAN NOT NULL DEFAULT false;

-- Der Bestandskatalog kennt genau eine Kostenart, die typischerweise
-- Bauleistungen traegt. Gartenpflege, Reinigung und Winterdienst sind
-- ausdruecklich KEINE Bauleistungen; Aufzugswartung ist Instandhaltung an
-- einem Bauwerk und faellt darunter.
UPDATE "CostType" SET "constructionWork" = true
  WHERE "name" IN ('Laufende Instandhaltung', 'Aufzug (Wartung)');
