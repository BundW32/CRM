-- Optionale Stammdaten zum Objekt
ALTER TABLE "Property" ADD COLUMN "buildYear" INTEGER;
ALTER TABLE "Property" ADD COLUMN "livingArea" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "floors" INTEGER;
ALTER TABLE "Property" ADD COLUMN "buildingType" TEXT;
ALTER TABLE "Property" ADD COLUMN "heatingType" TEXT;
ALTER TABLE "Property" ADD COLUMN "notes" TEXT;
