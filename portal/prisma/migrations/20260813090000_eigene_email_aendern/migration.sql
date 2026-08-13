-- Selbst angestoßener Wechsel der E-Mail-Adresse (Doppel-Opt-in).
--
-- Die neue Adresse steht bis zur Bestätigung nur in `pendingEmail` und wird
-- erst beim Einlösen des Tokens nach `email` übernommen — `email` ist zugleich
-- der Anmeldename und @unique. Der Token steht wie alle versandten Token nur
-- als Hash in der Datenbank (lib/token-hash.ts).
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "emailChangeToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailChangeExpiry" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_emailChangeToken_key" ON "User"("emailChangeToken");
