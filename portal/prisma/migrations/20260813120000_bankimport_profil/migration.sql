-- AlterTable
-- Zuletzt bestätigte Lesart der Bankdatei je Konto (Spalten, Zeichensatz,
-- Trennzeichen, „ohne Kopfzeile"). NULL = noch nie ein Import bestätigt.
ALTER TABLE "LedgerAccount" ADD COLUMN "importProfile" JSONB;
