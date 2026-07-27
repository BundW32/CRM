-- § 35a EStG: begünstigt ist nur der Lohn-, Fahrt- und Maschinenkostenanteil,
-- nicht der Bruttobetrag der Rechnung.
ALTER TABLE "Booking" ADD COLUMN "laborShareCents" INTEGER;
ALTER TABLE "CostType" ADD COLUMN "laborSharePercent" INTEGER;
