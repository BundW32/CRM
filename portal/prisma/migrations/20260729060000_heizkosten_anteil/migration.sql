-- Angewandter Verbrauchsanteil der HeizkostenV-Aufteilung (50–70 %).
-- Wird beim Verteilen gesetzt, damit die Abrechnung den Schlüssel benennen
-- kann: "70 % Verbrauch, 30 % Wohnfläche" statt nur "Verbrauch".
ALTER TABLE "CostType" ADD COLUMN "heatingConsumptionPercent" INTEGER;
