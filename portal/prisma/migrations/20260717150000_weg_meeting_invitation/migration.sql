-- Einladungs-Assistent: optionaler Freitext-Link zur Video-Zuschaltung, der nur
-- in Einladung/Protokoll abgedruckt wird (kein Streaming, keine Live-Abstimmung).
-- Rein additiv.
ALTER TABLE "OwnersMeeting" ADD COLUMN IF NOT EXISTS "videoLink" TEXT;
