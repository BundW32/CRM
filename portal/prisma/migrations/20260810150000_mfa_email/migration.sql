-- Zwei-Faktor-Anmeldung per E-Mail als zweites Verfahren neben der
-- Authenticator-App (Entscheidung des Betreibers vom 10.08.2026: MFA ist
-- optional und wird in den Einstellungen gewählt). Der Code steht nur als
-- Hash mit Ablauf in der Datenbank.
ALTER TABLE "User" ADD COLUMN "mfaEmailEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaEmailCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEmailCodeExpiresAt" TIMESTAMP(3);
