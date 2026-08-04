-- Externe Bezeichnung / Lage einer Einheit (optional). Interne label bleibt
-- unveraendert; externalLabel wird in Dokumenten und Mieter-/Eigentuemer-
-- Ansichten genutzt (Fallback auf label).
ALTER TABLE "Unit" ADD COLUMN "externalLabel" TEXT;
