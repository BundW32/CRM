-- Zeitpunkt des letzten E-Mail-Versands einer Plattform-Rechnung.
ALTER TABLE "PlatformInvoice" ADD COLUMN "sentAt" TIMESTAMP(3);
