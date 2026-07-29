-- Freistellungsbescheinigung (§ 48b EStG) als Datei am Handwerker.
-- Nummer und Gueltigkeitsdatum steuern die Pruefung; das Dokument ist der
-- Nachweis. Gleiche Storage-Konvention wie Buchungsbeleg und Anhang.
ALTER TABLE "Craftsman" ADD COLUMN "exemptionStoredName" TEXT;
ALTER TABLE "Craftsman" ADD COLUMN "exemptionFileName" TEXT;
ALTER TABLE "Craftsman" ADD COLUMN "exemptionMimeType" TEXT;
