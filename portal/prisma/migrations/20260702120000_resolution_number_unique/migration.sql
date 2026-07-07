-- Lückenlose, kollisionsfreie Beschluss-Nummerierung pro Objekt (§24 VII WEG).
-- number ist nullable → Postgres erlaubt beliebig viele NULLs im Unique-Index,
-- daher kollidieren nur tatsächlich vergebene Nummern.
CREATE UNIQUE INDEX "Resolution_propertyId_number_key" ON "Resolution"("propertyId", "number");
