---
titel: Rechnungen und Belege
kurz: Die drei Wege, wie eine Rechnung ins Buch kommt, und wie der Beleg immer an der Buchung landet.
bereich: finanzen
reihenfolge: 30
rollen: verwalter
---
## Erst die Frage: Ist schon Geld geflossen?

Eine Rechnung kommt auf drei Wegen ins Portal. Welcher der richtige ist, hängt davon ab, wann bezahlt wird:

| Lage | Weg |
|---|---|
| Schon bezahlt: Lastschrift oder Überweisung ist bereits vom Konto abgegangen | Fall 1: Kontoauszug importieren, dann Kostenart und Beleg an die importierte Buchung |
| Rechnung liegt vor und wird jetzt überwiesen | Fall 2: Buchung erfassen mit der Rechnung als Beleg |
| Rechnung liegt vor und wird später bezahlt | Fall 3: als Verbindlichkeit erfassen, bei Zahlung „Als bezahlt buchen" |

Alle drei Wege enden gleich: eine Ausgabe mit Buchungstag, Kostenart, Beleg und, wo es ihn gibt, dem Lohnanteil nach § 35a. Der Buchungstag ist immer der Tag der Zahlung, nicht das Rechnungsdatum.

## Fall 1: Die Zahlung ist schon vom Konto abgegangen

Typisch bei Lastschriften des Versorgers, der Versicherung oder bei einer Überweisung, die Sie im Online-Banking gemacht haben, bevor Sie ins Portal kamen.

1. Importieren Sie den Kontoauszug unter WEG-Finanzen → **Buchhaltung** (siehe [Bankimport und Buchungsliste](/hilfe/bankimport)). Der Umsatz erscheint als Buchung, zunächst ohne Kostenart und ohne Beleg.
2. Ordnen Sie die **Kostenart** zu: entweder aus dem Vorschlag beim Import oder später in der Buchungsliste. Der Filter **Zuordnung → „Ohne Kostenart"** zeigt alles, was noch offen ist. Mehrere Buchungen zugleich: in der Liste anhaken, Kostenart wählen, **„Zuordnen"**.
3. Hängen Sie den **Beleg** an: In der Zeile der Buchung auf **„Beleg anhängen"** klicken, die Rechnungs-PDF wählen, **„Anhängen"**. Das Portal liest die Rechnung und vergleicht: Weicht der Rechnungsbetrag vom gebuchten ab, fragt es nach Teilzahlung oder Skonto; liegt das Rechnungsdatum nach dem Buchungstag, sagt es das. Steht in der Rechnung ein Lohnanteil, übernehmen Sie ihn mit einem Häkchen.

Der Filter **Beleg → „Ohne Beleg"** zeigt, wo noch Belege fehlen. Vor der Jahresabrechnung lohnt ein Blick darauf: Eigentümer und Beirat sehen die Belege in der Belegeinsicht.

## Fall 2: Die Rechnung wird jetzt überwiesen

Sie haben die Rechnung vor sich und überweisen sie heute.

1. Öffnen Sie WEG-Finanzen → **Buchhaltung** → Karte **„Buchung erfassen"**.
2. Wählen Sie unter **„Rechnung wählen"** die Rechnungs-PDF. Betrag, Zahlungspartner, Buchungstext und Lohnanteil füllen sich von selbst; die Datei wird als Beleg gespeichert. Gelesen wird im Portal, nichts verlässt den Server.
3. Prüfen Sie die Werte, vor allem den **Buchungstag**: der Tag der Überweisung.
4. Wählen Sie **Konto**, **Art** „Ausgabe" und die **Kostenart**.
5. **„Buchen"**.

Kommt der Umsatz später mit dem Kontoauszug herein, erkennt der Import die Buchung als Zwilling (gleicher Betrag, gleiche Richtung, Buchungstag wenige Tage auseinander) und schlägt **„Zusammenführen"** vor. Die Handbuchung bleibt mit Beleg, Kostenart und Lohnanteil bestehen und bekommt den Verwendungszweck der Bank. Nichts wird doppelt gebucht.

## Fall 3: Die Rechnung wird später bezahlt

Die Rechnung ist da, bezahlt wird erst nächste Woche oder im nächsten Jahr. Bis dahin ist sie eine Schuld der Gemeinschaft und gehört in den Vermögensbericht.

1. Öffnen Sie WEG-Finanzen → **Verbindlichkeiten** und klicken Sie oben rechts auf **„Rechnung erfassen"**. Auch hier füllt die Rechnungs-PDF die Felder vor. Der Beleg wird an dieser Stelle noch nicht abgelegt; er kommt mit der Zahlung an die Buchung.
2. Prüfen Sie **Bezeichnung**, **Gläubiger**, **Offener Betrag**, **Entstanden am** (das Rechnungsdatum, nicht der Zahltag) und **Fällig am**. Dann **„Verbindlichkeit erfassen"**.
3. Am Tag der Zahlung klicken Sie in der Liste auf **„Als bezahlt buchen"**. Das Buchungsformular öffnet sich mit Betrag, Zahlungspartner und Text aus der Rechnung; Sie tragen den Tag der Überweisung ein, wählen die Rechnungs-PDF als Beleg und buchen. Die Rechnung gilt danach als beglichen und zeigt den Link **„Zahlung ansehen"** zur Buchung.

Kam die Zahlung stattdessen schon über den Bankimport herein, klicken Sie nur auf **„nur als beglichen markieren"** und hängen den Beleg an die importierte Buchung, wie in Fall 1.

Viele Rechnungen auf einmal erfassen Sie unter Verbindlichkeiten → **„Aus CSV importieren"**: eine Tabelle mit Kopfzeile, eine Rechnung je Zeile (Bezeichnung, Gläubiger, Betrag, Rechnungsdatum, Fällig am, Rechnungsnummer, Notiz). Eine Vorlage zum Herunterladen liegt bereit; schon erfasste Zeilen werden übersprungen.

## Der Lohnanteil nach § 35a

Eigentümer können den Lohnanteil von Handwerker- und haushaltsnahen Leistungen von der Steuer absetzen, nicht das Material. Damit er auf der Steuerbescheinigung erscheint, braucht es zweierlei:

- Die **Kostenart** ist in den Stammdaten als § 35a-Leistung gekennzeichnet (siehe [Stammdaten der Finanzen](/hilfe/stammdaten#kostenarten-und-umlageschluessel)). Fehlt das Kennzeichen, warnt das Buchungsformular und verlinkt dorthin.
- Der **Lohnanteil** steht an der Buchung: aus der Rechnung übernommen, im Feld „davon Lohnanteil § 35a" eingetragen oder später in der Buchungsliste nachgetragen. Fehlt er, greift der Erfahrungswert der Kostenart. Fehlt auch der, erscheint die Position auf der Bescheinigung als „ohne Lohnanteil".

## Kosten, die nur eine Einheit betreffen

Eine Reparatur, die allein eine Wohnung betrifft und der Gemeinschaft in Rechnung gestellt wurde, wird nicht nach Umlageschlüssel auf alle verteilt. Wählen Sie beim Buchen unter **„Nur für eine Einheit"** die betroffene Einheit. In der Jahresabrechnung erscheint der Betrag dann vollständig bei dieser Einheit, gekennzeichnet als „Direkt zugeordnet (nur diese Einheit)". Nachträglich setzen Sie die Direktzuordnung in der Buchungsliste über die Sammelaktion.

## Bauabzugsteuer

Zahlt die Gemeinschaft einem Handwerker ohne gültige Freistellungsbescheinigung im Jahr mehr als 5.000 €, greift die Bauabzugsteuer (§ 48 EStG): 15 % sind einzubehalten und ans Finanzamt abzuführen. Das Buchungsformular bucht in diesem Fall nicht, ohne dass Sie sich entscheiden: Bescheinigung anfordern und beim Handwerker eintragen, oder den Einbehalt bestätigen. Die Anmeldung beim Finanzamt begleitet die Seite Einstellungen → [Bauabzugsteuer](/verwaltung/bauabzugsteuer); siehe [Prüfpflichten, Erhaltung, Steuer und Zinsen](/hilfe/pruefpflichten#bauabzugsteuer).

## Was Sie nie tun müssen

Eine falsche Buchung wird nicht gelöscht, sondern **storniert**: In der Zeile auf „Stornieren" klicken. Original und Gegenbuchung bleiben im Journal, der Kontostand ist wieder wie vorher. Danach buchen Sie richtig neu. Ist das Wirtschaftsjahr schon durch eine fertige Jahresabrechnung abgeschlossen, bleibt auch das Storno gesperrt.
