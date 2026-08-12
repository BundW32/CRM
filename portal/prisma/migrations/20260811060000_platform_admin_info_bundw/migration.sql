-- Betreiber-Zugang für info@bundwimmobilien.de: setzt das Datenbank-Flag
-- der doppelten Wand (lib/platform-admin.ts). Das Flag ist bewusst über
-- keine Oberfläche setzbar — Migration/Seed ist der vorgesehene Weg.
--
-- Wirkt nur, wenn das Konto in DIESER Datenbank existiert (0 Zeilen sonst,
-- kein Fehler). Zugang zu /plattform entsteht erst, wenn ZUSÄTZLICH die
-- E-Mail in der Env-Variable PLATFORM_ADMIN_EMAILS des Deployments steht —
-- das Flag allein öffnet nichts.
UPDATE "User"
SET "isPlatformAdmin" = true
WHERE lower("email") = 'info@bundwimmobilien.de';
