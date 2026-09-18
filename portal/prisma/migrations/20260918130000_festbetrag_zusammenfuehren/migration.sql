-- FESTBETRAG und INDIVIDUELL zusammenführen.
--
-- Beide Schlüssel verhielten sich im Code identisch (manuelle Verteilung je
-- Einheit in der Jahresabrechnung) und unterschieden sich nur im Namen. An der
-- Kostenart gibt es ab jetzt nur noch INDIVIDUELL („Betrag je Einheit"). Der
-- Enum-Wert FESTBETRAG bleibt bestehen: Fertige Abrechnungen tragen ihn im
-- Snapshot, und ein Enum-Wert lässt sich in Postgres nicht entfernen, ohne
-- den Typ neu zu bauen. Sonderumlagen ließen beide Schlüssel nie zu.
UPDATE "CostType" SET "distributionKey" = 'INDIVIDUELL' WHERE "distributionKey" = 'FESTBETRAG';
