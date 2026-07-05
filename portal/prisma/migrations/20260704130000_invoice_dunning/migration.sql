-- Mahnwesen: Mahnstufe + Zeitpunkt der letzten Mahnung.
ALTER TABLE "PlatformInvoice" ADD COLUMN "reminderLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformInvoice" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
