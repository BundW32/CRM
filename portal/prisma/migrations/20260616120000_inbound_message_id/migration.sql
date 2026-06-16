-- Idempotenz für den E-Mail-Eingang: verhindert doppelte Tickets bei Webhook-Retries
ALTER TABLE "Ticket" ADD COLUMN "inboundMessageId" TEXT;
CREATE UNIQUE INDEX "Ticket_inboundMessageId_key" ON "Ticket"("inboundMessageId");
