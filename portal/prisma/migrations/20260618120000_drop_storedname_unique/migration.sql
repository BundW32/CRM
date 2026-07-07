-- storedName kann eine Base64-Data-URL enthalten (Fallback ohne Vercel Blob).
-- Solche Werte überschreiten das btree-Indexlimit von ~2704 Bytes, weshalb der
-- Unique-Index das Speichern großer Dateien verhindert. Index daher entfernen.
DROP INDEX IF EXISTS "Attachment_storedName_key";
DROP INDEX IF EXISTS "Document_storedName_key";
