-- Handwerker-Magic-Link läuft ab (P1-13): Ausstellungsdatum am Token.
ALTER TABLE "Craftsman" ADD COLUMN "accessTokenIssuedAt" TIMESTAMP(3);

-- Bestand: vorhandene Tokens gelten ab jetzt — die Frist (90 Tage,
-- lib/craftsman-token.ts) beginnt mit diesem Deploy, kein Link bricht sofort.
UPDATE "Craftsman"
SET "accessTokenIssuedAt" = CURRENT_TIMESTAMP
WHERE "accessToken" IS NOT NULL;
