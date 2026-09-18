---
titel: Stammdaten der Finanzen
kurz: Einheiten mit Miteigentumsanteilen, Eigentümer je Einheit, Kostenarten mit Umlageschlüssel, Konten mit Anfangsbestand.
bereich: finanzen
reihenfolge: 20
rollen: verwalter
---
## Wozu die Stammdaten da sind

Ohne Stammdaten kann nichts gerechnet werden. Sie finden sie unter WEG-Finanzen → **Stammdaten & Konten**, in fünf Karten: Objekt-Einstellungen, Einheiten, Eigentümer je Einheit, Kostenarten & Umlageschlüssel, Konten. Nach jedem Speichern springt die Seite an die bearbeitete Stelle zurück.

## Objekt-Einstellungen

- **MEA-Nenner**: die Summe aller Miteigentumsanteile laut Teilungserklärung, häufig 1.000 oder 10.000. Ohne ihn läuft die Verteilung zwar, aber niemand kann prüfen, ob alle Einheiten erfasst sind.
- **Beginn des Wirtschaftsjahres**: meist Januar.
- **Hausgeld fällig**: zum Ersten des Monats, zum dritten Werktag oder zu einem festen Tag. Die Fälligkeit bestimmt, ab wann ein Hausgeld als Rückstand gilt, und erscheint im Text der Beschlussvorlage zum Wirtschaftsplan.
- **Hausgeld runden auf**: volle 10 Cent, volle Euro oder centgenau. Gerundet wird immer nach oben; die Überdeckung wird mit der Jahresabrechnung als Guthaben verrechnet. Die Einstellung greift ab dem nächsten Beschluss.
- **Mahnkosten je Mahnung**: nur, was tatsächlich anfällt (Porto, Material). Die erste Mahnung bleibt kostenfrei.

Unter der Karte prüft ein Banner die Miteigentumsanteile: „Miteigentumsanteile vollständig: 1.000 / 1.000" ist das Ziel. Weicht die Summe ab, nennt das Banner die Einheiten ohne MEA.

## Einheiten

Je Einheit pflegen Sie **Art** (Wohnung, Teileigentum, Stellplatz, Sonstiges), **MEA-Zähler**, **Fläche** und **Personen**, mit einem eigenen Speichern-Knopf je Zeile. Der MEA-Zähler ist die zentrale Angabe: Er steuert die Kostenverteilung in Abrechnung und Wirtschaftsplan und bestimmt zugleich das Stimmgewicht beim Wertprinzip. Er wird nur hier gepflegt; die Stimmgewichte leiten sich daraus ab.

Fläche und Personenzahl braucht es nur für Kostenarten, die danach verteilt werden. Fehlt der Wert bei einzelnen Einheiten, zählen diese mit null (ein Stellplatz trägt keine Wasserkosten). Fehlt er bei allen, kann die Kostenart nicht verteilt werden; das Portal sagt dann, welche.

## Eigentümer je Einheit

Die Eigentümerschaft wird tagesgenau geführt, weil die Jahresabrechnung bei einem Verkauf im Jahr zwischen Vor- und Nacheigentümer aufteilt. Je Einheit stehen die Eigentümer mit **Anteil** in Prozent und **seit**-Datum. Ein Verkauf wird mit **„+ Eigentümerwechsel oder Miteigentümer eintragen"** erfasst: neuen Eigentümer wählen, „Eigentümer seit" auf den Tag des Übergangs setzen, Häkchen **„Wechsel"** setzen, damit der Vor-Eigentümer zum Stichtag beendet wird.

Die Anteile einer Einheit müssen zusammen 100 % ergeben. Bei einem Ehepaar mit je der Hälfte also 50 und 50; zweimal 100 zählte den Anteil der Einheit doppelt.

## Kostenarten und Umlageschlüssel

Jede Kostenart hat eine **Kategorie** (Betriebskosten, Instandhaltung, Verwaltung, Rücklagenzuführung, Sonstiges, Einnahme), einen **Umlageschlüssel**, die **§ 35a-Einstufung**, einen Erfahrungswert **Lohn %**, und die Häkchen **HeizkostenV**, **umlagefähig (BetrKV)** und **aktiv**.

| Umlageschlüssel | Verteilt nach |
|---|---|
| Miteigentumsanteile (MEA) | dem Anteil laut Teilungserklärung, der gesetzliche Regelfall (§ 16 Abs. 2 WEG) |
| Wohn-/Nutzfläche | der Fläche der Einheiten |
| Wohn-/Gewerbeeinheiten (gleichmäßig) | gleichen Teilen je Wohn- oder Gewerbeeinheit; Stellplätze zahlen nichts |
| Personenzahl | den gemeldeten Personen je Einheit |
| Verbrauch | Zählerständen oder einer Messdienst-Abrechnung, erfasst in der Jahresabrechnung |
| Betrag je Einheit (manuell erfassen) | Beträgen, die Sie in der Jahresabrechnung je Einheit eintragen |
| Je Stellplatz | gleichen Teilen je Stellplatz oder Garage |

Für Kosten, die nur eine einzelne Einheit betreffen, gibt es keinen Schlüssel, sondern beim Buchen die Angabe „Nur für eine Einheit" (siehe [Rechnungen und Belege](/hilfe/rechnungen#kosten-die-nur-eine-einheit-betreffen)).

**§ 35a-Einstufung**: Handwerker, Hausmeister, Reinigung, Gartenpflege, Winterdienst sind als „haushaltsnahe Dienstleistung" oder „Handwerkerleistung" zu kennzeichnen. Sonst kommt der Lohnanteil der Rechnungen auf keine Steuerbescheinigung. Lieferungen, Versicherungen und Versorger bleiben bei „kein § 35a-Lohnanteil". Der **Lohn %**-Wert ist ein Erfahrungswert, der nur greift, wenn an der Buchung kein Lohnanteil erfasst ist.

**HeizkostenV** kennzeichnet Heiz- und Warmwasserkosten: 50 bis 70 % nach Verbrauch, der Rest nach Wohnfläche. **Umlagefähig (BetrKV)** entscheidet, ob eine Kostenart in der Betriebskostenabrechnung an Mieter weitergegeben wird.

Beim Start übernehmen Sie mit **„WEG-Standardkatalog übernehmen"** die üblichen Kostenarten (Hausmeister, Gartenpflege, Allgemeinstrom, Wasser/Abwasser, Müllabfuhr, Heizung/Warmwasser, Versicherungen, Aufzug, Treppenhausreinigung, Winterdienst, Instandhaltung, Verwaltungskosten, Kontoführung, Zuführung Erhaltungsrücklage, Zinserträge) und passen sie danach an. Eine Kostenart, an der schon Buchungen hängen, wird beim „entfernen" nur deaktiviert, nicht gelöscht.

## Konten

Legen Sie das **Girokonto** der Gemeinschaft und das getrennte Konto der **Erhaltungsrücklage** an: Name, Kontoart, IBAN, **Anfangsbestand** und **Stichtag**. Beides ist Pflicht: Ein neu eröffnetes Konto trägt „0,00", leer lassen geht nicht, sonst rechnet die Buchhaltung mit einem Stand, den niemand geprüft hat. Die IBAN des Girokontos erscheint auf dem Einzelwirtschaftsplan unter dem monatlichen Hausgeld und wird für die SEPA-Lastschrift gebraucht.
