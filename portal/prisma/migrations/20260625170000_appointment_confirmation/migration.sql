-- Phase 3: Terminvorschlag des Handwerkers wird erst nach Bestätigung durch den
-- Verwalter wirksam. Null = Vorschlag offen / wartet auf Bestätigung.

ALTER TABLE "Ticket" ADD COLUMN "appointmentConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "appointmentConfirmedById" TEXT;
