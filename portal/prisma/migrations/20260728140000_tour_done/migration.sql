-- Geführte Ersteinrichtung: einmal von selbst, danach nur auf Wunsch.
ALTER TABLE "User" ADD COLUMN "tourDoneAt" TIMESTAMP(3);
