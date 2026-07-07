-- Nachweis der Einwilligung (Art. 7 Abs. 1 DSGVO): IP + User-Agent zum Zustimmungszeitpunkt.
ALTER TABLE "Organization" ADD COLUMN "termsAcceptedIp" TEXT;
ALTER TABLE "Organization" ADD COLUMN "termsAcceptedUserAgent" TEXT;
