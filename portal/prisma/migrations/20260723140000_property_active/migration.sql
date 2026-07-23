-- Objekt archivieren: aktive Objekte sind Standard; archivierte werden aus den
-- aktiven Verwalter-Listen ausgeblendet (Bestandsdaten bleiben erhalten).
ALTER TABLE "Property" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
