-- Rundung der monatlichen Hausgeld-Rate.
--
-- Bisher wurde der Jahresvorschuss centgenau auf zwölf Raten verteilt; die
-- Restcents landeten auf den ersten Monaten (Januar 250,04 €, Februar bis
-- Dezember 250,03 €). Der Dauerauftrag des Eigentümers passte damit im Januar
-- nie. Jetzt wird je Objekt auf eine Stufe **aufgerundet** — alle zwölf Raten
-- sind gleich, die Gemeinschaft ist nie unterdeckt.
CREATE TYPE "HausgeldRounding" AS ENUM ('CENT', 'ZEHN_CENT', 'EURO');

-- Vorgabe für jedes Objekt: 10 Cent.
ALTER TABLE "Property"
  ADD COLUMN "hausgeldRounding" "HausgeldRounding" NOT NULL DEFAULT 'ZEHN_CENT';

-- Was ein Plan tatsächlich verwendet, wird mit dem Beschluss festgeschrieben.
-- NULL = noch nicht beschlossen (dann gilt die Objekt-Einstellung).
ALTER TABLE "EconomicPlan"
  ADD COLUMN "hausgeldRounding" "HausgeldRounding";

-- Bestandsschutz: Bereits beschlossene Pläne behalten ihre Raten. Ohne diese
-- Zeile läsen sie ab sofort die neue Objekt-Einstellung — und die Sollstellungen
-- künftiger Monate eines laufenden Plans änderten sich rückwirkend gegenüber
-- dem, was beschlossen und den Eigentümern zugestellt wurde.
UPDATE "EconomicPlan" SET "hausgeldRounding" = 'CENT' WHERE "status" = 'BESCHLOSSEN';
