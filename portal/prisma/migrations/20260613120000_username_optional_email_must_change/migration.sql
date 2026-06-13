-- Email wird optional (Mieter ohne E-Mail-Adresse erhalten ein Zugangsschreiben)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Benutzername als alternative Anmeldung (für Zugänge ohne E-Mail)
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Erzwungener Passwortwechsel bei Erst-Passwort aus dem Zugangsschreiben
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
