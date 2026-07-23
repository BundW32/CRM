-- Titelbild je Objekt (optional). Speicher-Konvention wie beim Logo:
-- Blob-URL, Data-URL oder lokaler Dateiname im Feld storedName.
ALTER TABLE "Property" ADD COLUMN "titleImageStoredName" TEXT;
