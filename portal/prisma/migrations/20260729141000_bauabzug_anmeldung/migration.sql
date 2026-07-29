-- Bauabzugsteuer: tatsaechlicher Einbehalt und Anmeldung (§ 48a Abs. 1 EStG)
ALTER TABLE "Booking" ADD COLUMN "bauabzugCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "bauabzugAngemeldetAt" TIMESTAMP(3);
