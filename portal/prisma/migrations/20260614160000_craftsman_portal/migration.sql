-- Handwerker-Portal-Light: Magic-Link-Token + Termin + Kommentare vom Handwerker
ALTER TABLE "Craftsman" ADD COLUMN "accessToken" TEXT;
CREATE UNIQUE INDEX "Craftsman_accessToken_key" ON "Craftsman"("accessToken");

ALTER TABLE "Ticket" ADD COLUMN "appointmentNote" TEXT;

-- Kommentar-Autor kann jetzt ein Nutzer ODER ein Handwerker sein
ALTER TABLE "TicketComment" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "TicketComment" ADD COLUMN "craftsmanAuthorId" TEXT;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_craftsmanAuthorId_fkey"
  FOREIGN KEY ("craftsmanAuthorId") REFERENCES "Craftsman"("id") ON DELETE SET NULL ON UPDATE CASCADE;
