-- Enums
CREATE TYPE "Trade" AS ENUM (
  'SANITAER', 'HEIZUNG', 'ELEKTRO', 'DACH', 'MALER', 'BODENLEGER',
  'FENSTER_TUEREN', 'SCHLOSSEREI', 'GARTEN', 'REINIGUNG',
  'SCHAEDLINGSBEKAEMPFUNG', 'AUFZUG', 'ALLGEMEIN', 'SONSTIGES'
);
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'TELEFON', 'MOBIL', 'POST');

-- Bevorzugter Kontaktweg für Nutzer (Mieter/Eigentümer)
ALTER TABLE "User" ADD COLUMN "preferredContact" "ContactMethod";

-- Handwerker-Stammdaten (Kontaktbuch, ohne Login)
CREATE TABLE "Craftsman" (
  "id" TEXT NOT NULL,
  "company" TEXT,
  "name" TEXT NOT NULL,
  "trade" "Trade" NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "preferredContact" "ContactMethod" NOT NULL DEFAULT 'TELEFON',
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Craftsman_pkey" PRIMARY KEY ("id")
);

-- Ticket: Gewerk + Handwerker-Zuordnung
ALTER TABLE "Ticket" ADD COLUMN "trade" "Trade";
ALTER TABLE "Ticket" ADD COLUMN "craftsmanId" TEXT;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_craftsmanId_fkey"
  FOREIGN KEY ("craftsmanId") REFERENCES "Craftsman"("id") ON DELETE SET NULL ON UPDATE CASCADE;
