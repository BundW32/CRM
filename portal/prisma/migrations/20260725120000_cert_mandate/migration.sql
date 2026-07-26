-- Ermaechtigung des Eigentuemers fuer Bescheinigungen (§ 19 Abs. 5 BMG).
--
-- Bisher erzeugte das Portal Wohnungsgeberbestaetigungen im Namen des
-- Eigentuemers, ohne dass eine Beauftragung dokumentiert war – im Zweifel
-- sogar mit der Unterschrift des Verwalters unter dem Namen des Eigentuemers.
-- Die Ermaechtigung haengt an der Person (ein Datensatz je Eigentuemer); ob
-- sie greift, entscheidet zusaetzlich das aktive Mietverhaeltnis der Einheit.
-- Rein additiv: Bestandsnutzer haben keine Ermaechtigung (NULL).
ALTER TABLE "User" ADD COLUMN "certMandateGrantedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "certMandateRevokedAt" TIMESTAMP(3);

-- Herkunft der Unterschrift. Bestandsunterschriften wurden ausnahmslos vom
-- Verwalter erfasst (einen anderen Weg gab es nicht), daher FALSE als Default
-- und fuer alle vorhandenen Zeilen. Sie erscheinen damit kuenftig mit dem
-- Zusatz „i. A." statt unter dem Namen des Eigentuemers.
ALTER TABLE "User" ADD COLUMN "signatureSelfSigned" BOOLEAN NOT NULL DEFAULT false;
