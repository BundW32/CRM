-- Wann das Versammlungsprotokoll zuletzt erzeugt wurde.
--
-- Grundlage für den Hinweis „das verteilte Protokoll ist älter als die
-- Beschlussergebnisse": Ohne Zeitstempel lässt sich nicht feststellen, ob nach
-- der Protokollerstellung noch Stimmen nachgetragen wurden.
--
-- Nullable und ohne Vorbelegung: Für bestehende Versammlungen ist der Zeitpunkt
-- unbekannt, und ein geratener wäre schlimmer als keiner — er würde einen
-- Vergleich tragen, der nichts aussagt.
ALTER TABLE "OwnersMeeting" ADD COLUMN "protocolGeneratedAt" TIMESTAMP(3);
