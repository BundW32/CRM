-- Einnahmenseite des Wirtschaftsplans (§ 28 Abs. 1 WEG): Zinsen, Miete aus
-- Gemeinschaftseigentum, PV-Einspeisung. Beträge bleiben positiv, die Richtung
-- steckt in der Kategorie.
ALTER TYPE "CostCategory" ADD VALUE 'ERTRAG';
