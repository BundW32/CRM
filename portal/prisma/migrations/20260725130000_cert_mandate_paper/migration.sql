-- Schriftliche Vollmacht (Papier), von der Verwaltung vermerkt.
--
-- Der Self-Service unter „Konto" setzt voraus, dass der Eigentuemer einen
-- Portalzugang hat und ihn nutzt. Viele Eigentuemer haben beides nicht – ihre
-- Vollmacht liegt unterschrieben auf Papier im Ordner. Ohne diesen Weg bliebe
-- fuer sie gar keine Bescheinigung moeglich.
--
-- Der Vermerk ist bewusst kein blosses Haekchen: Quelle, Fundstelle und der
-- Vermerkende werden mitgefuehrt, sonst waere er kein Nachweis.
-- Rein additiv. Bestehende Ermaechtigungen stammen ausnahmslos aus dem
-- Self-Service, weil es bis hierher keinen anderen Weg gab.
ALTER TABLE "User" ADD COLUMN "certMandateSource" TEXT;
ALTER TABLE "User" ADD COLUMN "certMandateNote" TEXT;
ALTER TABLE "User" ADD COLUMN "certMandateRecordedById" TEXT;

UPDATE "User" SET "certMandateSource" = 'SELBST' WHERE "certMandateGrantedAt" IS NOT NULL;
