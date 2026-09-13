-- Herkunft eines Tagesordnungspunkts aus dem Vorlagenkatalog.
--
-- Zweck ist das Stimmverbot nach § 25 Abs. 4 WEG: Ob über die Entlastung der
-- Verwaltung abgestimmt wird, entscheidet darüber, wer mitstimmen darf. Diese
-- Frage allein über einen frei änderbaren Titel zu beantworten wäre zu wenig.
--
-- Nullable, ohne Vorbelegung: Bestehende Tagesordnungspunkte stammen aus einer
-- Zeit ohne dieses Feld. Ein geratener Schlüssel wäre schlimmer als keiner — er
-- würde eine Sperre tragen, die auf einer Vermutung beruht. Für sie greift der
-- Titelabgleich in lib/weg/stimmverbot.ts.
ALTER TABLE "MeetingAgendaItem" ADD COLUMN "templateKey" TEXT;

-- Ein Vorlagen-TOP höchstens einmal je Versammlung. NULL-Werte sind davon
-- ausgenommen (PostgreSQL behandelt sie in UNIQUE-Indizes als verschieden) —
-- von Hand angelegte TOPs bleiben also beliebig oft möglich, wie bisher.
CREATE UNIQUE INDEX "MeetingAgendaItem_meetingId_templateKey_key"
  ON "MeetingAgendaItem"("meetingId", "templateKey");
