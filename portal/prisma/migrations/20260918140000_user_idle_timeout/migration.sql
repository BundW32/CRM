-- Automatische Abmeldung nach Inaktivität, je Konto einstellbar.
-- NULL = aus (bisheriges Verhalten: nur die Sieben-Tage-Obergrenze).
ALTER TABLE "User" ADD COLUMN "idleTimeoutMinutes" INTEGER;
