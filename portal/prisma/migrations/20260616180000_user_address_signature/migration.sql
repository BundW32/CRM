-- Anschrift (z. B. Eigentümer als Wohnungsgeber) und Unterschriftsbild für Bescheinigungen
ALTER TABLE "User" ADD COLUMN "street" TEXT;
ALTER TABLE "User" ADD COLUMN "zip" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "signatureStoredName" TEXT;
