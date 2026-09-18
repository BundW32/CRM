---
titel: Bankimport und Buchungsliste
kurz: Kontoauszüge einlesen, Vorschläge übernehmen, Zwillinge zusammenführen, stornieren, umbuchen, exportieren.
bereich: finanzen
reihenfolge: 40
rollen: verwalter
---
## Kontoauszug importieren

Eine Bankanbindung braucht das Portal nicht: Sie laden die Umsatzdatei aus Ihrem Online-Banking hoch. Erkannt werden **CSV**, **MT940** (.sta) und **CAMT.053** (.xml).

1. Unter WEG-Finanzen → **Buchhaltung** in der Karte „Bankumsätze importieren" das **Konto** wählen, die Datei wählen, **„Datei analysieren"**.
2. Der Diagnoseblock zeigt Format, Zeichensatz und bei CSV Trennzeichen und Kopfzeile. Bei CSV prüfen Sie die **Spaltenzuordnung** (Buchungstag, Betrag oder Soll und Haben, Verwendungszweck, Zahlungspartner). Das Portal merkt sich die bestätigte Zuordnung je Konto; beim nächsten Mal passt sie von selbst. MT940 und CAMT brauchen keine Zuordnung.
3. Die **Vorschau** zeigt jede Zeile mit Status: **neu**, **Duplikat** (schon importiert, wird übersprungen) oder **passt zu Handbuchung**.
4. **Zuordnungsvorschläge**: Einnahmen bekommen eine Einheit, Ausgaben eine Kostenart, jeweils mit Güte „sicher", „wahrscheinlich" oder „unsicher". Vorbelegt sind nur die sicheren; die anderen übernehmen Sie per Häkchen. Angerechnet wird dabei nichts: Auf welche Forderung eine Zahlung tilgt, entscheiden Sie im Hausgeld.
5. **„… Buchung(en) importieren"**.

## Zwillinge: schon von Hand gebucht

Haben Sie eine Zahlung schon von Hand erfasst (etwa über „Als bezahlt buchen" mit Beleg), erkennt der Import den Umsatz als Zwilling: gleicher Betrag, gleiche Richtung, Buchungstag höchstens fünf Tage auseinander. Die Vorschau fragt je Paar:

- **„Zusammenführen (empfohlen)"**: Die Handbuchung bleibt mit Beleg, Kostenart, Lohnanteil und Verbindlichkeit bestehen und bekommt Verwendungszweck und Wertstellung der Bank. Der Umsatz wird nicht ein zweites Mal gebucht.
- **„Trotzdem neu anlegen"**: nur, wenn es wirklich eine zweite Zahlung gleicher Höhe ist.

## Import zurücknehmen

Unter „Letzte Importe" lässt sich ein Import mit **„Import zurücknehmen"** im Ganzen entfernen, solange keine Buchung daraus storniert wurde und das Wirtschaftsjahr offen ist. Zusammengeführte Handbuchungen bleiben dabei erhalten.

## Die Buchungsliste

Die Liste zeigt Datum, Konto, Art, Text, Kostenart, Lohnanteil, Betrag und Beleg. Filter: Jahr, Konto, Art (Einnahme, Ausgabe, Umbuchung), Kostenart, **Zuordnung → „Ohne Kostenart"**, **Beleg → „Ohne Beleg"**. Eine fehlende Kostenart steht orange als „fehlt"; stornierte Zeilen sind grau.

**Sammelaktion**: Buchungen anhaken, dann Kostenart, Handwerker oder „Nur für eine Einheit" wählen und **„Zuordnen"**. Umbuchungen tragen keine Kostenart.

**Je Zeile**: Lohnanteil eintragen (Knopf „ok"), **„Beleg"** ansehen, **„Beleg anhängen"** oder **„ersetzen"**, **„Stornieren"**. Ein vorhandener Beleg wird nie still überschrieben.

## Umbuchung

Geld von einem Konto der Gemeinschaft auf ein anderes, typisch die **Zuführung zur Erhaltungsrücklage**: Karte „Umbuchung", Von-Konto, Auf-Konto, Datum, Betrag, **„Umbuchen"**. Eine Umbuchung ist weder Einnahme noch Ausgabe und trägt keine Kostenart. Buchen Sie die Zuführung als Ausgabe, fehlt sie in der Rücklagenentwicklung; die Kontendiagnose der Jahresabrechnung nennt genau diesen Fall.

## Journal und Kontoblätter

Für den Beirat, den Steuerberater oder einen Verwalterwechsel: Die aufklappbare Karte „Journal und Kontoblätter als CSV" liefert je Wirtschaftsjahr das **Journal** (alle Buchungen in zeitlicher Folge) und je Konto das **Kontoblatt** mit fortlaufendem Saldo. Stornierte Buchungen stehen mit drin und sind gekennzeichnet.
