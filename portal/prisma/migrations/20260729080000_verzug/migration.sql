-- Verzugszinsen (§§ 286, 288 BGB) und Mahnkosten.
--
-- Der Basiszinssatz (§ 247 BGB) wird als DATEN gefuehrt, nicht als Tabelle im
-- Quelltext: Er wechselt halbjaehrlich zum 1.1. und 1.7. Ein einprogrammierter
-- Wert waere ab dem naechsten Halbjahr falsch, ohne dass es jemand merkt --
-- und die veraltete Zahl landete in einer Mahnung, die nach aussen geht.
-- Bewusst OHNE Vorbelegung: Lieber keine Zinsen ausweisen als falsche.
CREATE TABLE "BaseInterestRate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "basisPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BaseInterestRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BaseInterestRate_organizationId_validFrom_key" ON "BaseInterestRate"("organizationId", "validFrom");
CREATE INDEX "BaseInterestRate_organizationId_idx" ON "BaseInterestRate"("organizationId");
ALTER TABLE "BaseInterestRate" ADD CONSTRAINT "BaseInterestRate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Momentaufnahme in der Mahnung. Spaeter neu zu rechnen waere falsch: Das
-- Schreiben ist raus, und was darin stand, muss nachvollziehbar bleiben.
ALTER TABLE "HausgeldMahnung" ADD COLUMN "interestCents" INTEGER;
ALTER TABLE "HausgeldMahnung" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0;

-- Tatsaechliche Mahnkosten je Mahnung (Porto, Material). KEINE Pauschale von
-- 40 EUR: § 288 Abs. 5 BGB gilt nur zwischen Unternehmern, der
-- Wohnungseigentuemer ist regelmaessig Verbraucher.
ALTER TABLE "Property" ADD COLUMN "mahnkostenCents" INTEGER NOT NULL DEFAULT 0;
