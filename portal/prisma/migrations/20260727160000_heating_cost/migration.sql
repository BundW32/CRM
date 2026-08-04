-- HeizkostenV: Kostenarten kennzeichnen, für die die Zwangsaufteilung
-- 50-70 % Verbrauch / Rest Fläche gilt (§§ 7, 8 HeizkostenV).
ALTER TABLE "CostType" ADD COLUMN "heatingCost" BOOLEAN NOT NULL DEFAULT false;

-- Bestand: die Kostenart aus dem Standardkatalog trägt den Namen unverändert.
UPDATE "CostType" SET "heatingCost" = true WHERE "name" = 'Heizung/Warmwasser';
