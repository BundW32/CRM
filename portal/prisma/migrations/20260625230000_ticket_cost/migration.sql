-- Optionale Kostenerfassung am Vorgang (KEIN Buchhaltungsmodul, reine Notiz).
-- Betrag in Cent, plus freie Notiz für Anbieter/netto-brutto/KV-Nr.
ALTER TABLE "Ticket" ADD COLUMN "costCents" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "costNote" TEXT;
