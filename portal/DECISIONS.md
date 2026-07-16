# DECISIONS — WEG-Selbstverwaltung

Selbst getroffene Entscheidungen während der Umsetzung (Vorgabe aus dem
Build-Auftrag: „entscheide selbst und dokumentiere die Entscheidung").

## Schritt 1 — Finanz-Fundament (AP0–AP5, 16.07.2026)

### Datenmodell (AP0)

1. **Betrag positiv + `BookingKind`** statt vorzeichenbehafteter Beträge:
   klare Einnahmen-/Ausgaben-Reports ohne `ABS()`-Akrobatik. Kontostand =
   Anfangsbestand + Σ EINNAHME − Σ AUSGABE ± UMBUCHUNGen.
2. **Umbuchung Giro↔Rücklage als zwei Gegenbuchungen** (je Konto eine) mit
   gemeinsamer `transferGroupId`, beide `kind = UMBUCHUNG`. Zusatzfeld
   `transferOut Boolean` (nicht im Plan, ergänzt): ohne Richtungsflag wäre am
   einzelnen Buchungssatz nicht erkennbar, ob das Geld das Konto verlässt oder
   zufließt — nötig für die Saldoberechnung je Konto.
3. **`Unit.mea` (Kostenanteil) vs. `Ownership.mea` (Stimmgewicht)** bewusst
   getrennt: Kostenverteilung hängt an der Einheit, Stimmrecht am Eigentümer.
4. **MEA-Nenner am Objekt** (`Property.meaTotal`), Zähler je Einheit
   (`Unit.mea`); Summenprüfung in der UI, nicht als DB-Constraint (während der
   Ersterfassung sind Zwischenstände zwangsläufig inkonsistent).
5. **`BankImportBatch.property` als echte Relation** (Plan hatte nur die
   nackte `propertyId`-Spalte): konsistentes Cascade-Verhalten beim Löschen
   eines Objekts und einfachere Scope-Filter.
6. **Duplikatschutz als DB-Unique** `(accountId, dedupeHash)`: Der Import ist
   damit auch bei parallelen Requests idempotent; `dedupeHash = NULL` für
   manuelle Buchungen (Postgres-Unique ignoriert NULLs → beliebig viele
   manuelle Buchungen erlaubt).
7. **Beleg direkt an der Buchung** (`belegStoredName/FileName/MimeType`) nach
   dem Muster von `Handover.pdfStoredName` statt einer eigenen Anhang-Tabelle:
   genau ein Beleg je Buchung reicht für den MVP (KISS); eine spätere
   Mehrfach-Beleg-Tabelle kann die Felder ablösen.
8. **Migration handgeschrieben** (Repo-Konvention, timestamped Ordner) —
   lokal läuft keine Datenbank; `prisma migrate deploy` wendet sie beim
   Build/Deploy an. Schema per `prisma validate` + `prisma generate` geprüft.

### Logik-Libs (AP1)

9. **Largest-Remainder-Verfahren** in `distributeByWeight`: erst kaufmännisch
   über Quoten runden ist nicht summentreu; stattdessen Ganzzahl-Anteile +
   Verteilung der Restcents nach größtem Rest. Verbleibende Differenz (durch
   die Restcent-Regel des Auftrags) wird der betragsgrößten Position
   zugeschlagen. Ergebnis ist immer centgenau: Σ Anteile == Gesamtbetrag.
10. **Flächen-Gewichte in cm²** (`livingArea * 10000` gerundet): Gewichte
    bleiben Ganzzahlen, Fließkomma-Artefakte (76.38 m² u. ä.) verfälschen die
    Verteilung nicht.
11. **CSV-Parser selbst geschrieben** (RFC-4180-nah, `;`/`,`-Autodetect,
    `\r\n`/`\n`, Anführungszeichen): keine neue Dependency für ein
    überschaubares Problem; Bank-CSVs (Sparkasse/VR) sind semikolongetrennt.
12. **`dedupeHash` = SHA-256** über `accountId|yyyy-mm-dd|amountCents|reference`
    (Verwendungszweck normalisiert: Whitespace kollabiert, lowercase). Bewusst
    OHNE Betragsvorzeichen/Gegenpartei: Banken liefern die Gegenpartei
    uneinheitlich, Datum+Betrag+Zweck identifiziert einen Umsatz hinreichend.
13. **Zeilen ohne parsebares Datum oder Betrag werden beim Mapping
    übersprungen** (nicht abgebrochen): Bank-CSVs enthalten oft Fußzeilen
    („Anfangssaldo", Leerzeilen); ein harter Abbruch würde jeden Import
    scheitern lassen. Übersprungene Zeilen werden gezählt und angezeigt.

### UI (AP2/AP3)

14. **Ein WEG-Bereich unter `/verwaltung/weg/[propertyId]`** mit Unterseiten
    Stammdaten/Buchhaltung statt vieler Top-Level-Menüpunkte: Die Arbeit ist
    immer objektbezogen; das folgt dem bestehenden Muster `uebergabe/[id]/…`.
15. **CSV-Import zweistufig ohne Zwischenspeicherung des Files**: Schritt 1
    lädt die Datei, parst sie serverseitig und liefert Header + Mapping-Vorschlag
    + Vorschau zurück (Base64 des Dateiinhalts wandert als Hidden-Field in
    Schritt 2). Kein Blob-Upload nötig, kein Aufräum-Job — Zero-Key-Prinzip.
16. **MEA-Summenprüfung als Warnung, nicht als Speicher-Blocker**: Beim
    Speichern einzelner Einheiten wäre ein harter Block falsch (Zwischenstände).
    Die Stammdaten-Seite zeigt eine deutliche Warnbox, solange Σ mea ≠ meaTotal.

## Schritt 2 — Wirtschaftsplan & Hausgeld (16.07.2026)

17. **Vorschuss-Gewichte ≠ Abrechnungs-Gewichte** (`advanceWeightsForKey`):
    Für den Wirtschaftsplan werden VERBRAUCH/FESTBETRAG/INDIVIDUELL nach MEA
    verteilt (übliche Praxis — die Jahresabrechnung korrigiert später
    centgenau), und bei FLAECHE/PERSONEN zählen fehlende Werte als 0 (ein
    Stellplatz ohne Wohnfläche trägt Reinigungskosten nicht mit). Die strikte
    `weightsForKey` bleibt unverändert für die spätere Abrechnung.
18. **Monatsraten über `distributeByWeight` mit 12 gleichen Gewichten**:
    12 Raten summieren centgenau auf den Jahresvorschuss (Differenzen max.
    1 Cent zwischen den Raten) — kein „letzter Monat korrigiert"-Sonderfall.
19. **Beschluss als Statuswechsel mit Datum + Verweis** statt harter Kopplung
    an das Versammlungs-/Umlaufmodul: Der Plan wird „als beschlossen markiert"
    (Datum, Freitext-Verweis z. B. „ETV …, TOP 4"). Eine automatische
    Verknüpfung TOP ↔ Plan ist ein späterer Ausbauschritt; der Mustertext der
    Beschlussvorlage liegt auf der Planseite.
20. **Sollstellungen entstehen beim Beschluss** (12 je Einheit, fällig zum 1.
    des Monats, Kalendermonate des Wirtschaftsjahres). Erneutes Beschließen
    ersetzt vorhandene Sollstellungen des Plans (deleteMany + createMany in
    einer Transaktion) — idempotent.
21. **Offene Posten je Einheit, nicht je Eigentümer**: Das Bestandsschema
    verknüpft Eigentum (`Ownership`) mit dem Objekt, nicht mit der Einheit.
    Eine tagesgenaue Eigentümerschaft je Einheit (`Eigentümerschaft` mit
    gültigVon/gültigBis aus dem Build-Auftrag) ist ein bewusst verschobenes
    Schema-Delta — nötig spätestens für die zeitanteilige Jahresabrechnung.
22. **Zahlungszuordnung als `Booking.unitId`** statt eigener Zuordnungstabelle
    Zahlung↔Sollstellung: Saldo je Einheit (Σ fällige Sollstellungen − Σ
    zugeordnete Eingänge) genügt für Rückstandsliste und Mahnwesen des MVP;
    eine Einzelzuordnung je Monat kann später ergänzt werden, ohne Daten zu
    verlieren. Zuordnungs-Vorschlag: Einheiten-Kurzlabel („WE 01") im
    Verwendungszweck.
23. **Vorjahres-Istwerte = Σ AUSGABE-Buchungen je Kostenart** im vorherigen
    Wirtschaftsjahr; Umbuchungen (Rücklagenzuführung) fließen nicht ein, da
    sie keiner Kostenart zugeordnet sind — der Planwert der Rücklagenzuführung
    ist ohnehin eine bewusste Entscheidung der Gemeinschaft.
