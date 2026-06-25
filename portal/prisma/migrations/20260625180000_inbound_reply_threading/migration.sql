-- Phase 3: E-Mail-Antworten (z. B. von Handwerkern) werden anhand der
-- Vorgangsnummer im Betreff dem bestehenden Vorgang als Kommentar zugeordnet,
-- statt einen neuen Vorgang anzulegen. inboundMessageId verhindert
-- Doppel-Kommentare bei Webhook-Wiederholungen.

ALTER TABLE "TicketComment" ADD COLUMN "inboundMessageId" TEXT;
CREATE UNIQUE INDEX "TicketComment_inboundMessageId_key" ON "TicketComment"("inboundMessageId");
