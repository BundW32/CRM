-- Adressbuch: Art eines Kontakteintrags.
--
-- Bisher enthielt die Tabelle ausschliesslich Handwerker. Mit der Kategorie
-- passen auch Dienstleister, Versorger und Behoerden hinein, ohne dass eine
-- zweite Kontakttabelle entsteht (sonst pflegte man dieselbe Firma doppelt).
-- Rein additiv: Bestandszeilen erhalten ueber den Default HANDWERKER.
CREATE TYPE "ContactKind" AS ENUM ('HANDWERKER', 'DIENSTLEISTER', 'VERSORGER', 'BEHOERDE', 'SONSTIGES');

ALTER TABLE "Craftsman" ADD COLUMN "kind" "ContactKind" NOT NULL DEFAULT 'HANDWERKER';

-- Adressbuch-Listen filtern und sortieren ueber die Art.
CREATE INDEX "Craftsman_kind_idx" ON "Craftsman"("kind");
