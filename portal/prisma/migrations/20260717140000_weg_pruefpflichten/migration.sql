-- WEG-Prüfpflichten-Katalog: wiederkehrende Prüf-/Verwaltungspflichten werden je
-- Objekt in MaintenanceTask übernommen. Additive Änderungen:
--   1) neuer Turnus DREIJAEHRLICH (z. B. Legionellenprüfung alle 3 Jahre, TrinkwV)
--   2) catalogKey     -> Herkunft aus dem Katalog + Idempotenz der Übernahme
--   3) lastReminderAt -> letzte per E-Mail-Adapter versendete Erinnerung

-- ALTER TYPE ... ADD VALUE muss außerhalb einer Transaktion laufen und darf im
-- selben Migrationsschritt nicht verwendet werden (nur Deklaration).
ALTER TYPE "MaintenanceInterval" ADD VALUE IF NOT EXISTS 'DREIJAEHRLICH';

ALTER TABLE "MaintenanceTask" ADD COLUMN IF NOT EXISTS "catalogKey" TEXT;
ALTER TABLE "MaintenanceTask" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MaintenanceTask_propertyId_catalogKey_idx"
  ON "MaintenanceTask"("propertyId", "catalogKey");
