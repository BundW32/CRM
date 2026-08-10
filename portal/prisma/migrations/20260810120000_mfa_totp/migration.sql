-- Zwei-Faktor-Anmeldung (TOTP, P1-10): Secret (verschlüsselt), Aktivierungs-
-- zeitpunkt und Wiederherstellungscodes (gehasht, je Code einmal einlösbar).
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
