-- Phase 3: Abschluss-Bestätigung. Die Erledigung wird vom Handwerker GEMELDET
-- (oft per Telefon/WhatsApp/E-Mail, nicht zwingend im Portal). Erst die
-- ausdrückliche Bestätigung durch den Verwalter schließt den Vorgang.

ALTER TABLE "Ticket" ADD COLUMN "completionReportedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "completionReportedVia" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "closedById" TEXT;
