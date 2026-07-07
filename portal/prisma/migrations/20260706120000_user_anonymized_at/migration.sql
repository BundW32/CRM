-- DSGVO-Anonymisierung: Markierungsfeld + Bereinigung bestehender anonymisierter Nutzer.

ALTER TABLE "User" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Bereits anonymisierte Nutzer (durch anonymizeUser gesetzt: Name-Sentinel, ohne
-- E-Mail, deaktiviert) rückwirkend markieren.
UPDATE "User"
SET "anonymizedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Gelöschter Nutzer'
  AND "active" = false
  AND "email" IS NULL;

-- Verwaiste Eigentümer-/Mietverhältnisse anonymisierter Nutzer entfernen, damit sie
-- nicht länger als „Gelöschter Nutzer" in Eigentümer-/Kontaktlisten auftauchen.
DELETE FROM "Ownership"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "anonymizedAt" IS NOT NULL);

DELETE FROM "Tenancy"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "anonymizedAt" IS NOT NULL);
