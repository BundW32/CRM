-- M-J-Rest: Standard-Link zur Video-Zuschaltung je WEG-Objekt (externer Dienst).
-- Wird beim Anlegen einer Versammlung vorbelegt; je Termin überschreibbar. Additiv.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "defaultVideoLink" TEXT;
