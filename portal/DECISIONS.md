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

## Schritt 3 — Jahresabrechnung, §35a, Vermögensbericht (16.07.2026)

24. **Eigentümerschaft je Einheit (`UnitOwnership`) getrennt vom objektweiten
    `Ownership`**: Letzteres trägt Stimmrecht/MEA am Objekt, ersteres die
    tagesgenaue einheitsbezogene Zuordnung (validFrom/validTo, sharePercent)
    für die zeitanteilige Abrechnung. Beide bleiben nebeneinander bestehen —
    keine Migration des Bestands, additive Erweiterung.
25. **Jahresabrechnung live gerechnet im Entwurf, Snapshot bei FERTIG**:
    Solange ENTWURF, rechnet `computeStatementView` bei jedem Aufruf frisch aus
    der Buchhaltung (immer aktuell). Beim Fertigstellen wird das komplette
    View-Model als JSON in `AnnualStatement.snapshot` eingefroren und danach
    ausschließlich der Snapshot gerendert — revisionssicher, unabhängig von
    späteren Buchungsänderungen.
26. **Harte Plausibilitätsprüfung als Fertigstell-Voraussetzung**: Für jedes
    aktive Konto muss der gemeldete Endbestand (laut Kontoauszug) exakt dem
    rechnerischen Endbestand entsprechen (Anfangsbestand + Einnahmen − Ausgaben
    ± Umbuchungen). Zusätzlich muss die Verteilungs-Prüfliste leer sein. Ohne
    beides bleibt der Statuswechsel gesperrt (häufigster Anfechtungsgrund).
27. **Betrag positiv + Richtung** zieht sich durch: Kontostände über
    vorzeichenrichtige Summierung (`signedSum`), Umbuchungen je Konto über
    `transferOut`. Anfangsbestand eines Jahres = openingBalance + alle
    Buchungen VOR dem Wirtschaftsjahr (nicht nur das Feld) — so stimmt die
    Abrechnung auch für Folgejahre ohne erneutes Setzen des Anfangsbestands.
28. **VERBRAUCH/INDIVIDUELL/FESTBETRAG brauchen manuelle Verteilung**
    (`StatementUnitAmount`), z. B. Heizkosten aus der Messdienst-Abrechnung.
    Plausibilität: Σ je Kostenart muss centgenau dem Ist-Betrag entsprechen,
    sonst Prüffehler. Strikte Schlüssel (MEA/Fläche/Einheiten/Personen) werden
    automatisch verteilt; scheitert ein Schlüssel an fehlenden Stammdaten (z. B.
    Aufzug/FLAECHE beim Stellplatz ohne Fläche), landet er als Prüffehler in der
    Liste statt die Abrechnung abzubrechen.
29. **§35a-Ausweis = begünstigte Aufwendungen je Einheit** aus den geflaggten
    Kostenarten (haushaltsnah/Handwerker getrennt), mit UI-Hinweis, dass
    steuerlich der Lohn-/Fahrtkostenanteil laut Rechnung maßgeblich ist
    (Muster, keine Steuerberatung).
30. **Abrechnungsspitze gegen das SOLL** (beschlossene Vorschüsse aus
    `DuePosting`), nicht gegen tatsächliche Zahlungen — so verlangt es § 28
    Abs. 2 WEG. Zahlungsrückstände bleiben davon getrennt offene Forderungen
    (im Vermögensbericht als „Forderungen" ausgewiesen).

## Schritt 4 — PDF-Exporte, Belegeinsicht, Mahnwesen (17.07.2026)

31. **Mahnstufen wie im Plattform-Mahnwesen** (`lib/dunning.ts`, Stufen 1–3,
    keine automatischen Gebühren) statt eines zweiten Stufenmodells — ein
    Begriffssystem im Produkt. Eskalation nur über VERSENDETE Schreiben:
    unversendete Entwürfe erhöhen die Stufe nicht und können gelöscht werden;
    versendete bleiben als Nachweis unlöschbar.
32. **Rückstand und Empfänger als Snapshot** an der Mahnung (`arrearsCents`,
    `recipientName/-Address`): Das Schreiben bleibt reproduzierbar, auch wenn
    danach Zahlungen eingehen oder Eigentümer wechseln. Die Bankverbindung
    (IBAN des Girokontos) wird dagegen erst beim PDF-Rendern gelesen — sie
    soll immer aktuell sein.
33. **„Als versendet markieren" als Pflichtschritt** (Zero-Key): Das Datum
    dient als Fristen-/Zustellnachweis im Selbstdruck-Fallback und schaltet
    die nächste Mahnstufe frei — identisches Prinzip wie im Build-Auftrag für
    Einladungen gefordert.

## Schritt 5 — Sonderumlagen (17.07.2026)

34. **Sonderumlage als eigenes Modell + `DuePosting.source=SONDERUMLAGE`**
    statt eigener Forderungstabelle: Die Sollstellungen laufen so ohne
    Sonderweg in die bestehende Offene-Posten- und Mahnwesen-Logik ein (die
    nur nach `dueDate`/Einheit gruppieren, unabhängig von der Quelle).
35. **Einstufig „anlegen & verteilen"** (kein Entwurf/Beschluss-Statuswechsel
    wie beim Wirtschaftsplan): Eine Sonderumlage ist ein einzelner Betrag mit
    einem Schlüssel — der Beschluss wird als Freitext-Verweis erfasst, das
    Löschen (Cascade) macht sie rückgängig. Das hält den Flow schlank.
36. **Nur strikte Schlüssel** (MEA/Fläche/Einheiten/Personen): VERBRAUCH/
    FESTBETRAG/INDIVIDUELL ergeben für eine einmalige Umlage keinen Sinn.
    Verteilung über dieselbe centgenaue Engine (`distributeByWeight`).

## Schritt 6 — Prüfpflichten-Katalog (M-A, 17.07.2026)

37. **Kein neues Modell, sondern `MaintenanceTask` erweitert** (`catalogKey`,
    `lastReminderAt`): Prüfpflichten SIND wiederkehrende Wartungsaufgaben. So
    tauchen sie ohne Sonderweg in „Wartung & Prüfungen" auf (inkl. Handwerker-
    zuordnung/Vorgangserstellung) und die vorhandene „Fällige Wartungen"-
    Dashboard-Karte zeigt sie automatisch mit. `catalogKey` markiert die
    Herkunft aus dem Katalog und macht die Übernahme je Objekt idempotent —
    exakt das Muster von `adoptCostCatalog` (Abgleich per Schlüssel statt
    Titel, damit umbenannte Einträge nicht doppelt entstehen).
38. **Neuer Turnus `DREIJAEHRLICH`** statt Behelf über `ZWEIJAEHRLICH`: Die
    Legionellenprüfung ist nach TrinkwV in der Regel alle 3 Jahre fällig
    (Rechtssicherheit, Konvention #8). Additive Enum-Erweiterung
    (`ALTER TYPE … ADD VALUE`) plus Labels/Monate-Map — eine Quelle für den
    Monatswert bleibt `labels.ts` (`compliance.ts` re-exportiert sie).
39. **Fälligkeits-Turnus rechnet ab dem späteren von bisheriger Fälligkeit und
    heute** (`completeCompliance`): Quittiert man eine überfällige Pflicht,
    darf die nächste Fälligkeit nicht in der Vergangenheit landen; ist sie
    noch nicht fällig, bleibt der ursprüngliche Rhythmus erhalten (kein
    schleichendes Nach-hinten-Wandern). `addMonths` mit Monatsend-Korrektur.
40. **E-Mail-Erinnerung als reiner Beschleuniger** (`compliance-reminder.ts`,
    Cron `/api/cron/pruefpflichten`, CRON_SECRET-geschützt): Ohne SMTP-Adapter
    (`isMailEnabled === false`) passiert nichts — die Fälligkeiten stehen
    ohnehin im Dashboard (Zero-Key, Konvention #1). Anti-Spam über
    `lastReminderAt` + 7-Tage-Cooldown; Digest je Organisation an deren aktive
    Verwalter, Vorwarnfenster 14 Tage.
41. **Turnusse als fachliche Richtwerte mit Muster-Hinweis** („ersetzt keine
    Rechtsberatung"): TrinkwV/BetrSichV/GEG/DIN 14676/WEG geben die Regelfälle
    vor, die konkrete Anlage kann abweichen — die Fälligkeit ist je Pflicht
    frei editierbar.
