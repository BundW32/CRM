-- Vorgänge ohne Objektzuordnung (z. B. unbekannter E-Mail-Absender) erlauben
ALTER TABLE "Ticket" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "Ticket" ADD COLUMN "senderEmail" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "senderName" TEXT;
