-- Fortgeltung und geänderter Wirtschaftsplan (§ 28 Abs. 1 Satz 2 WEG).

CREATE TYPE "DueDayRule" AS ENUM ('MONATSERSTER', 'DRITTER_WERKTAG', 'FREIER_TAG');

ALTER TABLE "Property" ADD COLUMN "dueDayRule" "DueDayRule" NOT NULL DEFAULT 'MONATSERSTER';
ALTER TABLE "Property" ADD COLUMN "dueDayOfMonth" INTEGER;

ALTER TABLE "EconomicPlan" ADD COLUMN "validFrom" TIMESTAMP(3);
ALTER TABLE "EconomicPlan" ADD COLUMN "validUntil" TIMESTAMP(3);

-- Bestand: Ein bereits beschlossener Plan galt ab Beginn seines
-- Wirtschaftsjahres. Der Beginn ergibt sich aus dem Objekt.
UPDATE "EconomicPlan" p
SET "validFrom" = make_timestamptz(
      CASE WHEN o."fiscalYearStartMonth" = 1 THEN p."year" ELSE p."year" END,
      o."fiscalYearStartMonth", 1, 0, 0, 0, 'UTC')
FROM "Property" o
WHERE o."id" = p."propertyId" AND p."status" = 'BESCHLOSSEN';

-- Grenze zum Nachfolger ziehen: Ein älterer Plan gilt nur bis zum Beginn des
-- nächsten beschlossenen Plans desselben Objekts.
UPDATE "EconomicPlan" p
SET "validUntil" = nachfolger."validFrom"
FROM (
  SELECT a."id", MIN(b."validFrom") AS "validFrom"
  FROM "EconomicPlan" a
  JOIN "EconomicPlan" b
    ON b."propertyId" = a."propertyId"
   AND b."status" = 'BESCHLOSSEN'
   AND b."validFrom" > a."validFrom"
  WHERE a."status" = 'BESCHLOSSEN'
  GROUP BY a."id"
) AS nachfolger
WHERE nachfolger."id" = p."id";

-- Mehrere Pläne je Jahr zulassen (unterjährig geänderter Wirtschaftsplan).
DROP INDEX IF EXISTS "EconomicPlan_propertyId_year_key";
CREATE INDEX "EconomicPlan_propertyId_year_idx" ON "EconomicPlan"("propertyId", "year");
