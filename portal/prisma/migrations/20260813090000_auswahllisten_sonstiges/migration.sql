-- Auswahllisten: fehlende Werte und „Sonstiges" mit Freitext.
--
-- Mehrere Auswahllisten boten zu wenige Möglichkeiten und keinen Ausweg. Wo
-- die Liste fachlich nicht abschließend ist, kommen die fehlenden Werte dazu
-- und daneben ein Freitextfeld, das erscheint, sobald „Sonstiges" gewählt ist
-- (Baustein `components/select-sonstiges.tsx`, Auswertung `lib/sonstiges.ts`).
--
-- Das Hinzufügen eines Enum-Werts ist in Postgres unproblematisch: Bestehende
-- Zeilen bleiben unberührt, es wird nichts umgeschrieben. Die neuen Werte
-- werden in dieser Migration nirgends VERWENDET — das ist die Bedingung
-- dafür, dass ADD VALUE innerhalb einer Transaktion zulässig ist.

-- AlterEnum: Antragsarten (§ 24 Abs. 2 WEG kennt Beschlussantrag und
-- Versammlungsverlangen; der Punkt für die nächste Versammlung war keins von
-- beidem und musste bisher als eines von beiden eingereicht werden).
ALTER TYPE "MotionType" ADD VALUE 'TAGESORDNUNGSPUNKT';
ALTER TYPE "MotionType" ADD VALUE 'SONSTIGES';

-- AlterEnum: Dokumentarten. Versicherungsunterlagen, Rechnungen, Angebote,
-- Grundrisse und Behördenschreiben landeten allesamt unter SONSTIGES.
ALTER TYPE "DocumentCategory" ADD VALUE 'VERSICHERUNG';
ALTER TYPE "DocumentCategory" ADD VALUE 'RECHNUNG';
ALTER TYPE "DocumentCategory" ADD VALUE 'ANGEBOT';
ALTER TYPE "DocumentCategory" ADD VALUE 'PLAN_GRUNDRISS';
ALTER TYPE "DocumentCategory" ADD VALUE 'BEHOERDE';

-- AlterEnum: Zählerarten. Wärmemengen- und Abwasserzähler gibt es in
-- Bestandsgebäuden regelmäßig.
ALTER TYPE "MeterType" ADD VALUE 'WAERMEMENGE';
ALTER TYPE "MeterType" ADD VALUE 'ABWASSER';

-- AlterEnum: Kontaktarten des Adressbuchs (der Schema-Kommentar nennt genau
-- diese Fälle: Ableseservice, Versicherung, Steuerberatung).
ALTER TYPE "ContactKind" ADD VALUE 'MESSDIENST';
ALTER TYPE "ContactKind" ADD VALUE 'VERSICHERUNG';
ALTER TYPE "ContactKind" ADD VALUE 'STEUERBERATUNG';
ALTER TYPE "ContactKind" ADD VALUE 'RECHTSANWALT';

-- AlterTable: Freitext zu „Sonstiges". Nullable — für alles, was nicht
-- „Sonstiges" ist, bleibt die Spalte leer.
ALTER TABLE "OwnerMotion" ADD COLUMN "typeOther" TEXT;
ALTER TABLE "Document" ADD COLUMN "categoryOther" TEXT;
ALTER TABLE "Meter" ADD COLUMN "typeOther" TEXT;
ALTER TABLE "Craftsman" ADD COLUMN "kindOther" TEXT;
