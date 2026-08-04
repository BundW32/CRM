-- Sitzungswiderruf: Ab wann Sitzungen dieses Nutzers gelten.
--
-- Bewusst NULL als Vorgabe und kein `now()`: Ein Backfill auf den
-- Migrationszeitpunkt meldete jede bestehende Anmeldung ab. Das wäre für die
-- Sicherheit unschädlich, aber es wirft am Tag der Auslieferung alle Kunden
-- gleichzeitig hinaus, ohne dass etwas vorgefallen ist. NULL heißt „nie
-- hochgesetzt" – alte Token laufen reguär aus, neue Wechsel greifen sofort.
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
