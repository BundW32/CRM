-- Miteigentumsanteile mit Nachkommastellen.
--
-- Teilungserklärungen nennen Anteile wie „250,17/1.000". Bisher waren Zähler
-- und Nenner ganzzahlig; wer so eine Erklärung hatte, musste auf 100.000stel
-- umrechnen und sah die Zahl in jeder Abrechnung anders als im Dokument.
-- Bestehende Werte bleiben unverändert (Ganzzahl → dieselbe Gleitkommazahl).
ALTER TABLE "Property" ALTER COLUMN "meaTotal" TYPE DOUBLE PRECISION;
ALTER TABLE "Unit" ALTER COLUMN "mea" TYPE DOUBLE PRECISION;
ALTER TABLE "Ownership" ALTER COLUMN "mea" TYPE DOUBLE PRECISION;
