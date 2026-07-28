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

## Schritt 7 — Einladungs-Assistent + Fristenrechner + Einladungs-PDF (M-B, 17.07.2026)

42. **Bestehendes Versammlungsmodul erweitert statt Neubau**: Der
    Einladungs-Assistent hängt an `OwnersMeeting` (Feld `invitationSentAt`
    existierte bereits als Versanddatum). Der Fristenrechner rechnet ab genau
    diesem Datum — vor dem Versand ab „heute" (= „wenn ich jetzt einlade").
43. **Fristenrechner als reine, getestete Funktion** (`meeting-invitation.ts`,
    `checkInvitationDeadline`): Mindestladefrist 3 Wochen = 21 Kalendertage
    (§ 24 Abs. 4 WEG), uhrzeitunabhängig über `daysUntilDue`. Warnt bei
    Unterschreitung mit Angabe der fehlenden Tage und des spätesten
    Versanddatums — keine Blockade, denn kürzere Ladung ist rechtlich möglich
    (nur anfechtbar), die Entscheidung bleibt beim Verwalter.
44. **„Als versendet markieren" getrennt vom E-Mail-Versand** (Zero-Key,
    Konvention #1): `markInvitationSent` setzt nur das Versanddatum (für den
    Selbstdruck-/Postweg), `sendInvitation` verschickt zusätzlich E-Mails —
    beide mit demselben atomaren 2-Minuten-Doppelklick-Schutz. Ohne SMTP zeigt
    die UI direkt den manuellen Weg (PDF laden → markieren).
45. **Einladungs-PDF je Empfänger über eine gestreamte Route**
    (`…/einladung/pdf?owner=<userId>`): fensterumschlag-tauglicher DIN-A4-Brief
    wie die Mahnung; ohne `owner` ein neutraler „An alle Eigentümer"-Druck. Der
    Empfänger muss Eigentümer genau dieses Objekts sein (IDOR-Schutz).
46. **TOP-Vorlagenkatalog** (`meeting-agenda-templates.ts`): fertige TOPs inkl.
    Beschlussvorschlag; Beschluss-Vorlagen erzeugen — wie ein manueller
    Beschluss-TOP — automatisch eine Abstimmung (`Resolution`), damit die
    vorhandene Abstimm-/Protokolllogik ohne Sonderweg greift.
47. **Video-Link nur als Freitext-Abdruck** (`OwnersMeeting.videoLink`): erfüllt
    die Anforderung „Link zur Video-Zuschaltung im PDF" bewusst OHNE Streaming
    oder Live-Abstimmung — das echte Hybrid-/Online-Voting bleibt Modul M-J.

## Schritt 8 — Erhaltungsplanung (M-C, 17.07.2026)

48. **Eigenes Modell `MaintenanceMeasure`** (Titel, Gewerk, Zieljahr,
    Kostenschätzung in Cent) statt Zweckentfremdung von `MaintenanceTask`: eine
    langfristig geplante Erhaltungsmaßnahme (§ 19 Abs. 2 Nr. 2 WEG) ist kein
    terminierter Wartungslauf — sie hat ein Zieljahr und einen Kostenbetrag, aber
    keinen Turnus/keine Fälligkeit. `done` schließt erledigte Maßnahmen aus dem
    Bedarf aus. Gewerk als Freitext (Planung ist gröber als der Trade-Katalog).
49. **Rücklagenstand aus der Buchhaltung hergeleitet, nicht doppelt gepflegt**:
    Anfangsbestand + Σ Einnahmen − Σ Ausgaben ± Umbuchungen über die
    RUECKLAGE-Konten (dieselbe Formel wie die Buchhaltungsseite). Eine
    Gegenüberstellung mit einem separat gepflegten Wert würde zwangsläufig
    auseinanderlaufen.
50. **Jährliche Zuführung aus dem beschlossenen Wirtschaftsplan** (Positionen mit
    Kostenart-Kategorie RUECKLAGENZUFUEHRUNG): macht die Jahresprognose realistisch
    („leitet den Rücklagenbedarf her") statt nur eine statische Summe
    gegenüberzustellen. Ohne beschlossenen Plan = 0 (konservativ).
51. **Prognose als reine, getestete Funktion** (`reserve-plan.ts`,
    `projectReserve`): rollt Jahr für Jahr Zuführung − geplante Ausgaben auf den
    Startbestand und meldet das erste Jahr der Unterdeckung. Überfällige
    Maßnahmen (Zieljahr < laufendes Jahr) werden ins laufende Jahr gezogen, damit
    kein Bedarf „verschwindet". Alles Integer-Cent.

## Schritt 9 — Politur: Wirtschaftsplan-PDF & Verbrauchsinfo (M-D/M-E, 18.07.2026)

52. **Gemeinsamer PDF-Bauer statt Copy-Paste** (`weg/wirtschaftsplan-pdf.ts`):
    Verwalter- und Eigentümer-Route erzeugen exakt dasselbe Wirtschaftsplan-PDF.
    Die vorhandene Verwalter-Route wurde auf den Bauer umgestellt (kein zweiter
    Rechen-/Layoutpfad, der auseinanderlaufen könnte).
53. **Eigentümer sehen nur BESCHLOSSENe Pläne** (analog zu FERTIGen
    Jahresabrechnungen): Entwürfe sind Verwalter-Arbeitsstände. Zugriff über die
    Eigentümerstellung (`ownsProperty`), Auslieferung als gestreamtes
    `application/pdf` auf `/finanzen`.
54. **Verbrauchsinfo aus den vorhandenen Zählerständen abgeleitet**
    (`weg/consumption.ts`, getestet): UVI nach § 6a HeizkostenV = jüngste
    Verbrauchsperiode + Vergleich Vorperiode/Vorjahr, gerechnet aus den
    kumulativen `MeterReading`-Ständen. Zählerrücksprünge (Austausch) werden
    übersprungen; Vorjahresperiode über ein ±45-Tage-Toleranzfenster gematcht.
55. **`Meter.remoteReadable` als Auslöser der Pflicht**: nur fernablesbare Zähler
    lösen die monatliche Informationspflicht aus (§ 6a HeizkostenV) — additives
    Flag, in der UI markiert. Die Info-Seite ist für die Verbraucher (Mieter/
    Eigentümer) und den Verwalter zugänglich; Zugriff wie im Zählerbereich.

## Schritt 10 — Phase 3 Start: Integrationen + SEPA-Lastschrift (18.07.2026)

56. **Integrationen als Adapter-Register** (`IntegrationSetting`, unique je
    Org+Bereich): Bereiche mit optionalem API-Zugang (BANKING/MESSDIENST). Ohne
    hinterlegten Schlüssel zeigt die UI automatisch den manuellen Weg — genau das
    Zero-Key-Prinzip. SEPA erscheint dort nur als Zero-Key-Hinweis (kein Key).
57. **Secrets verschlüsselt at rest** (`crypto.ts`, AES-256-GCM, Schlüssel aus
    `INTEGRATION_ENC_KEY`/`SESSION_SECRET` abgeleitet): API-Keys werden nie im
    Klartext gespeichert oder an den Client zurückgegeben — die UI zeigt nur die
    letzten 4 Zeichen. Getestet inkl. Manipulationsschutz (GCM-Tag).
58. **SEPA-pain.008 als reine, getestete Dateierzeugung** (`weg/sepa.ts`,
    Zero-Key): pain.008.001.02; Gruppierung nach Sequenz (FRST/RCUR/OOFF) in
    getrennte `PmtInf`-Blöcke (SEPA-Vorgabe), Beträge aus Integer-Cent,
    IBAN/BIC-Normalisierung, `NOTPROVIDED` ohne BIC, XML-Escaping. Kontrollsummen
    und Transaktionszähler pro Gruppe und gesamt.
59. **Mandat je Einheit** (`SepaMandate`, unique Objekt+Einheit) + Gläubiger-ID am
    Objekt; die Gläubiger-IBAN kommt aus dem vorhandenen Girokonto. Eingezogen
    wird der zum Einzugstermin offene Hausgeld-Betrag je Einheit mit aktivem
    Mandat (Soll − Ist), Auslieferung als gestreamte XML-Datei zum Selbst-Upload.

## Schritt 11 — CO2-Kostenaufteilung (M-I, 18.07.2026)

60. **10-Stufen-Modell als reine, getestete Funktion** (`weg/co2.ts`): der
    Vermieteranteil steigt mit dem spezifischen Ausstoß (kg CO2/m²·a) gemäß
    CO2KostAufG (Wohngebäude). Stufengrenzen unten einschließlich/oben
    ausschließlich; Mieter- + Vermieteranteil ergeben stets 100 %.
61. **Centgenaue Aufteilung**: gebäudeweit wird der Vermieteranteil gerundet, der
    Mieteranteil ist der Rest (Summe exakt). Auf die Einheiten wird über die
    vorhandene `distributeByWeight`-Engine nach Wohnfläche verteilt — Einheiten
    ohne Wohnfläche (z. B. Stellplätze) tragen keine CO2-Heizkosten und werden aus
    der Flächengewichtung ausgeschlossen.
62. **Persistiert als Datenbasis** (`Co2Allocation`, unique Objekt+Jahr): erfasst
    CO2-Kostenanteil und Emissionen aus der Brennstoffrechnung (Ausweispflicht des
    Lieferanten, § 2 CO2KostAufG). Die eigentliche Weiterverarbeitung für die
    Mieter-Betriebskostenabrechnung bleibt Modul M-K (Vermieter-Zusatzmodul).

## Schritt 12 — Vermieter-Zusatzmodul: Betriebskostenabrechnung (M-K, 18.07.2026)

63. **Aus der WEG-Jahresabrechnung abgeleitet, nicht neu gerechnet**: die
    Betriebskostenabrechnung nimmt den eingefrorenen Snapshot einer FERTIGen
    `AnnualStatement` und den Einheitsanteil je Kostenart. So bleibt die
    Vermieter-Mieter-Abrechnung konsistent mit der beschlossenen WEG-Abrechnung.
64. **BetrKV-Trennung über das vorhandene `CostType.recoverableBetrKV`-Flag**:
    umlagefähige Kostenarten gehen an den Mieter, nicht umlagefähige (Verwaltung,
    Instandhaltung, Rücklagenzuführung) trägt der Eigentümer und werden nur
    informativ ausgewiesen.
65. **CO2-Integration (M-I → M-K)**: der Vermieter-CO2-Anteil der Einheit
    (CO2KostAufG) wird beim Mieter abgezogen. Der gemeinsame Helfer
    `co2-allocation.ts` (per-Einheit-Verteilung) wird von der CO2-Seite UND der
    Betriebskostenabrechnung genutzt — eine Quelle, kein Auseinanderlaufen. Der
    Abzug ist nach oben durch die umlagefähige Summe begrenzt (nie negativ).
66. **Mieterstammdaten minimal** (`Tenancy.bkPrepaymentMonthlyCents`): nur die
    Vorauszahlung wird ergänzt; Name/Zuordnung kommen aus dem vorhandenen
    Mietverhältnis. Jahres-Vorauszahlung = Monatsbetrag × 12. Reine, getestete
    Rechenlogik (`operating-costs.ts`) + gemeinsamer Ableitungs-Service für Seite
    und PDF; fensterumschlag-taugliches DIN-A4-PDF für den Mieter.

## Schritt 13 — Handwerker-Netzwerk: digitale Rechnung (M-L, 18.07.2026)

67. **Den vorhandenen Auftrags-Relay abgeschlossen, nicht neu gebaut**: Auftrag →
    Ausführung → Doku existierten bereits (Ticket + Magic-Link-Handwerkerportal).
    M-L ergänzt nur den fehlenden Schritt „Rechnung digital" (`CraftsmanInvoice`,
    eine Rechnung je Vorgang, Neueinreichung ersetzt).
68. **Handwerker reicht ein, Verwalter akzeptiert**: der Handwerker lädt über den
    Magic-Link Betrag + Datei hoch (kein Login); erst die ausdrückliche Annahme
    durch den Verwalter übernimmt Betrag und Beleg-Verweis in die vorhandene
    Kostenerfassung des Vorgangs (`Ticket.costCents/costNote`). Ablehnung mit Grund
    (E-Mail an den Handwerker), danach kann korrigiert neu eingereicht werden.
69. **Dateizugriff scope-sicher** über die bestehende `/api/files`-Route (neuer
    `kind=rechnung`): Verwalter im Ticket-Scope ODER der einreichende Handwerker
    per Magic-Link-Token — dasselbe Muster wie bei Auftrags-Anhängen. Kein neues
    Auslieferungs-/Berechtigungssystem.
70. **Kein „Marktplatz"**: das „Netzwerk" bleibt bewusst der digitale Durchlauf
    eines konkreten Auftrags bis zur Rechnung. Eine orgübergreifende Vermittlung
    wäre ein eigenes Produkt mit erheblichen rechtlichen/Datenschutz-Implikationen
    und ist hier nicht vorgesehen.

## Schritt 14 — Messdienst-Datei-Import statt API (M-H, 18.07.2026)

71. **Datei-Import statt Anbieter-API** (Produktentscheidung mit dem Auftraggeber):
    ista/Techem/Minol/Brunata bieten kleinen Selbstverwaltungen keine offenen
    Self-Service-APIs. Deshalb liest M-H die vom Messdienst gelieferte
    Abrechnungs-CSV ein — anbieter-unabhängig und Zero-Key, statt an einen API-
    Vertrag gebunden zu sein. M-G bleibt aus demselben Grund vorerst beim
    CSV-Bankimport.
72. **Reine, getestete Zuordnungslogik** (`heating-import.ts`): Spaltenerkennung
    per Header-Schlüsselwörtern; Einheiten-Abgleich zuerst über das (normalisierte)
    Label, dann über die eindeutige Nummer (Messdienste liefern oft nur „Wohnung N").
    Nicht eindeutig zuordenbare Zeilen und Einheiten ohne Zeile werden gemeldet,
    nie stillschweigend verworfen. Wiederverwendung des vorhandenen CSV-Parsers und
    der €-Betragslogik aus dem Bankimport.
73. **Fließt in die vorhandene manuelle Heizkostenverteilung** (`StatementUnitAmount`):
    der Import schreibt exakt dieselben Datensätze wie die manuelle Erfassung —
    nur eben aus der Datei vorbefüllt. Die manuelle Eingabe bleibt als Fallback und
    zur Korrektur; die harte centgenaue Summenprüfung der Abrechnung greift wie zuvor.

## Schritt 15 — M-J abgeschlossen: hybride Versammlung ohne eigenes Video (21.07.2026)

74. **Kein eigenes Video, keine eigene Konferenztechnik** (Produktentscheidung
    mit dem Auftraggeber): Videotelefonie wird an externe Dienste ausgelagert
    (Empfehlung Jitsi: Browser, kein Konto, EU). Remote-Eigentümer stimmen ohnehin
    im Portal ab (Bereich Beschlüsse) — damit ist § 23 Abs. 1a WEG abgedeckt,
    ohne Streaming-Infrastruktur und deren DSGVO-/Betriebslast.
75. **Standard-Videolink je Objekt** (`Property.defaultVideoLink`): wird beim
    Anlegen einer Versammlung als Fallback verwendet, wenn das Link-Feld leer
    bleibt; per Checkbox lässt sich ein eingegebener Link als neuer Standard
    speichern. Kein eigener Einstellungs-Dialog — die Pflege passiert dort, wo
    der Link gebraucht wird.
76. **Hybrid-Vermerk im Protokoll**: ist ein Video-Link gesetzt, dokumentiert das
    Protokoll-PDF „Hybride Versammlung (§ 23 Abs. 1a WEG) — Video-Zuschaltung: …";
    das Anwesenheitsfeld schlägt die Präsenz/online-Aufteilung vor. Damit ist die
    Teilnahmemöglichkeit rechtssicher dokumentiert.

## Schritt 16 — Geführter Erststart für Selbstverwalter (26.07.2026)

Vorarbeit: Analyse des IST-Stands plus Marktvergleich (dotega, Matera). Ergebnis
war, dass es dem Bereich nicht an Funktionen fehlt — die Pflichten aus dem
WEG-Gesetz sind vollständig abgedeckt —, sondern am **Weg durch sie hindurch**.
Eine frisch registrierte Gemeinschaft landete auf einer leeren Seite mit einem
Satz Bedienungsanleitung und lernte die zwingende Reihenfolge der Einrichtung,
indem sie in Fehlermeldungen lief.

77. **Einrichtungsstand wird aus den Daten abgeleitet, nicht gespeichert**
    (`weg/setup-status.ts`): Objekt, Einheiten samt MEA-Summenprüfung,
    Eigentümer je Einheit, Konten mit Anfangsbestand *und Stichtag*,
    Kostenkatalog, beschlossener Wirtschaftsplan. Ein abgeleiteter Zustand kann
    nicht veralten, ein gespeichertes Häkchen schon.
78. **Nur die drei Schritte außerhalb des Systems bekommen einen Vermerk**
    (`WegSetupStep`): Unterlagen der bisherigen Verwaltung angefordert,
    Konto der Gemeinschaft eröffnet, Verwaltung durch Beschluss bestellt. Sie
    sind aus keinen Daten ableitbar und zugleich der schwierigste Teil des
    Umstiegs. Unique über `(propertyId, key)` — das Abhaken ist idempotent.
    `MANUAL_SETUP_STEPS` ist zugleich die Whitelist der Server-Action: Ohne sie
    ließe sich über ein untergeschobenes Feld ein abgeleiteter Schritt als
    erledigt melden und die Einrichtung Vollzug verkünden, obwohl die
    Buchhaltung leer ist.
79. **Die Übersicht IST die Einrichtung, solange sie läuft.** Kennzahlen daneben
    zu zeigen wäre sinnlos — sie stünden alle auf null. Ist die Einrichtung
    fertig, wird aus derselben Seite der Jahresfahrplan. Kein eigener Menüpunkt,
    der nach zwei Wochen tot wäre.
80. **Miteigentümer sehen den Fortschritt, aber keine Verwaltungs-Links.** Die
    Ziele der Einrichtungsschritte sind Stammdaten-Seiten der Verwaltung; für
    einen Eigentümer ohne Verwalterrolle führten sie ins Leere.
81. **Jahresfahrplan als reine Ableitung** (`weg/roadmap.ts`): Jahresabrechnung
    fürs Vorjahr, Versammlung im laufenden Jahr (§ 24 Abs. 1), Wirtschaftsplan
    fürs kommende Jahr, fällige Prüfpflichten, offene Hausgeld-Rückstände —
    überfällig zuerst. Die Fristen sind ausdrücklich als **Richtwerte**
    ausgewiesen: § 28 Abs. 2 WEG nennt für die Jahresabrechnung kein Datum auf
    den Tag. Wer hier harte Stichtage behauptet, erfindet Recht.
82. **Der Fahrplan ersetzt die Prüfpflichten-Karte, statt neben ihr zu stehen**:
    Er enthält sie und ordnet sie zwischen Abrechnung, Plan und Versammlung ein.
83. **Objektauswahl entfällt bei genau einem Objekt** (nur Selbstverwalter):
    Die Seite `/verwaltung/weg` ist dann direkt der Finanz-Einstieg dieses
    Objekts. Bewusst **keine** Weiterleitung auf eine Unterseite — die
    Unterseiten springen über ihren „WEG-Finanzen"-Rückweg hierher zurück und
    liefen sonst im Kreis.
84. **Jeder Schritt sagt, wozu er gut ist**, in der Sprache eines Eigentümers
    statt in Verwalterdeutsch („Die Miteigentumsanteile stehen in der
    Teilungserklärung … ableiten aus der Wohnfläche lassen sie sich nicht").
    Fachlich richtige Begriffe ohne Erklärung waren der zweite Grund, warum der
    Bereich als undurchdringlich empfunden wurde.
## Schritt 17 — Block 1 der Finanzkorrekturen: Zuordnung, Storno, Objekt-Startseite (26.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befunde A1, B1) und
`docs/PLAN-WEG-Finanzkorrekturen.md` (KP1, KP2).

85. **Kostenart wird nachträglich zuordenbar** (Befund A1): Bisher setzte nur die
    manuelle Buchung eine `costTypeId`. CSV-importierte Umsätze blieben dauerhaft
    ohne Kostenart, landeten in `otherExpenseCents` und lösten dort einen
    Prüffehler aus — womit `finalizeStatement` dauerhaft abbrach. **Eine WEG, die
    den vorgesehenen Zero-Key-Weg ging, konnte ihre Jahresabrechnung nie
    fertigstellen.** Neu: `assignCostType` mit Massenauswahl über die
    Buchungsliste. Umbuchungen bleiben ausgenommen — sie sind kein Aufwand,
    sondern verschieben Geld zwischen Konten der Gemeinschaft.
86. **Korrektur nur per Storno, nie per Änderung oder Löschung** (Befund B1): Eine
    Fehlbuchung erzeugt eine Gegenbuchung (`Booking.reversalOfId`, `@unique`) mit
    umgekehrter Richtung, gleichem Betrag, Konto und Buchungstag. Beide bleiben im
    Journal sichtbar, der Saldo ist wieder korrekt. Eine Umbuchung wird immer
    beidseitig storniert (gemeinsame `transferGroupId`), sonst stünde ein halber
    Übertrag im Buch. Alternative „Buchung bearbeiten" bewusst verworfen: sie
    zerstört die Nachvollziehbarkeit, auf der die Abrechnung beruht.
87. **Stornopaare fallen aus allen fachlichen Auswertungen** (`NOT_REVERSED` in
    `lib/weg/booking-scope.ts`): Im Kontostand heben sie sich von selbst auf, in
    der Kostenverteilung nicht — das Storno einer Ausgabe ist eine Einnahme und
    hätte die Ausgabensumme der Kostenart nicht gemindert. Die Kosten wären trotz
    Storno umgelegt worden. Der Filter greift deshalb in Jahresabrechnung,
    Vorjahres-Istwerten, Verbrauchsverteilung, Rückständen, SEPA-Lastschrift und
    Eigentümersicht.
88. **Import-Rücknahme als eng begrenzte Ausnahme vom Storno-Prinzip**: Ein falsch
    zugeordneter Import (vertauschte Spalten) würde als Storno hunderte Zeilen
    erzeugen und das Journal unlesbar machen. `undoImportBatch` löscht den Batch
    deshalb im Ganzen — aber nur, solange kein Buchungstag in ein abgeschlossenes
    Wirtschaftsjahr fällt und keine Buchung daraus storniert wurde. Vollständig im
    Audit-Log.
89. **Abgeschlossene Wirtschaftsjahre sind schreibgeschützt**
    (`lib/weg/statement-lock.ts`): Liegt für ein Jahr eine Jahresabrechnung im
    Status `FERTIG` vor, sind dessen Buchungen unantastbar — weder Kostenart noch
    Storno. Sonst wiche der beschlossene Snapshot von der Buchhaltung ab, und
    genau diese Abweichung macht eine Abrechnung angreifbar. `fiscalYearOf`
    rechnet dabei in UTC, passend zu `fiscalYearRange` und `parseGermanDate`.
90. **Objekt-Startseite statt Linkmenü** (`weg/[propertyId]/page.tsx`): Die
    Einstiegsseite listete je Objekt elf gleichrangige Verweise. Buchhaltungs-
    software wird aber danach beurteilt, ob sie beim Öffnen zwei Fragen
    beantwortet: „wie viel Geld haben wir?" und „was muss ich als Nächstes tun?".
    Neu daher: Kontostände (Giro und Rücklage getrennt), eine Bereitschaftsprüfung
    für blockierende Lücken (fehlender MEA-Nenner, kein Rücklagenkonto, keine
    Kostenarten) und ein Arbeitsvorrat mit Zahlen und Absprung. Die Navigation
    folgt darunter der **Zeitachse** (einrichten · laufendes Jahr · Jahreslauf ·
    Dauerthemen) statt Themengruppen — der Wirtschaftsplan entsteht vor dem Jahr,
    die Abrechnung danach.
91. **Objektauswahl nur noch bei mehreren Objekten**: Bei genau einer WEG — dem
    Normalfall der Selbstverwaltung — leitet `/verwaltung/weg` direkt in den
    Arbeitsbereich durch. Die Auswahlseite zeigt sonst je Objekt die Salden, statt
    nur Namen und Verweise.

## Schritt 18 — Block 2, KP3: Erhaltungsrücklage richtig rechnen (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befunde A2, A3).

92. **Ausgaben aus der Rücklage werden nicht erneut umgelegt** (Befund A2): Die
    Ist-Ausgaben wurden bisher über alle Konten gesammelt — auch über das
    Rücklagenkonto. Eine aus der Rücklage bezahlte Maßnahme erhöhte damit die
    Abrechnungsspitze, obwohl sie aus Geld bezahlt wurde, das die Eigentümer über
    die Zuführungen früherer Jahre bereits aufgebracht hatten. **Sie zahlten
    dieselbe Maßnahme zweimal.** Neu: `expenseGroups` gruppiert zusätzlich nach
    Konto; was von einem RUECKLAGE-Konto kam, erscheint als Ausgabe in der
    Gesamtabrechnung (§ 28 Abs. 2 verlangt die Einnahmen-/Ausgabenrechnung),
    wird aber über die Gegenposition „Entnahme aus der Erhaltungsrücklage" aus
    der Umlage genommen. An echten Daten geprüft: 80.000 € aus der Rücklage
    lassen den Kostenanteil je Einheit unverändert.
93. **Zuführung folgt dem Schlüssel des Wirtschaftsplans** (Befund A3): Vorher
    fest MEA. Hatte die Gemeinschaft nach § 16 Abs. 2 Satz 2 WEG einen anderen
    Schlüssel beschlossen, verteilte der Plan anders als die Abrechnung — die
    Spitze war dann bei jedem Eigentümer falsch, in jedem Jahr. Der Schlüssel
    kommt jetzt aus dem beschlossenen Plan des Jahres, MEA bleibt Rückfall ohne Plan.
94. **Die Zuführung nutzt `advanceWeightsForKey`, nicht `weightsForKey`.** Beim
    Testen aufgefallen: Die strikte Verteilung der Abrechnung wirft bei einer
    Einheit ohne Wohnfläche, der Wirtschaftsplan zählt sie als 0. Mit der
    strikten Variante wäre genau die Abweichung zurückgekehrt, die diese
    Änderung behebt. Beide Seiten rechnen jetzt mit derselben Gewichtung.
95. **Kostenarten der Kategorie RUECKLAGENZUFUEHRUNG werden übersprungen.** Die
    Zuführung entsteht aus den Ist-Umbuchungen. Wurde sie zusätzlich als
    Aufwandsposition gebucht, war sie doppelt enthalten.
96. **Soll-Ist-Abgleich als Hinweis, nicht als Sperre** (neues Feld `warnings`,
    getrennt von `errors`): Eine bewusst abweichende Zuführung ist zulässig und
    darf das Fertigstellen nicht blockieren. Eine **vergessene** Umbuchung wäre
    dagegen ein stiller Fehler, der jedem Eigentümer ein Guthaben ausweist, das
    ihm nicht zusteht. Die Seed-Daten zeigen den Fall sofort: 6.000 € geplant,
    500 € umgebucht.
97. **Prüfmeldungen in Euro statt in Cent.** Sie stehen in der Oberfläche vor
    Eigentümern; „600000 Cent" ist keine Sprache für die Zielgruppe.

## Schritt 19 — Zusammenführung mit Erststart und Jahresfahrplan (27.07.2026)

Nach dem Merge von PR #36 traf der Finanz-Einstieg auf den dort gebauten
Jahresfahrplan. Beide beantworteten „was ist als Nächstes zu tun".

90. **Der Fahrplan gewinnt, es gibt keine zweite Liste.** `loadRoadmap` ist die
    bessere Ableitung — mit Fristen, Status und Klartext, und ausdrücklich als
    Richtwert gekennzeichnet. Die vier Einträge, die ich dafür gebaut hatte
    (Wirtschaftsplan, Jahresabrechnung, Prüfpflichten, Rückstände), sind
    entfallen. Ebenso die Bereitschaftsprüfung: Das macht der `SetupGuide`
    gründlicher und an der richtigen Stelle.
91. **Der Fahrplan erscheint jetzt auch für professionelle Verwaltungen.** Er
    lief nur im `SelfManagedDashboard` — B&W mit mehreren Objekten sah ihn
    nirgends. Der Objekt-Arbeitsbereich rendert ihn deshalb über dasselbe
    `loadRoadmap`; selbstverwaltete Gemeinschaften bekommen dort nur den
    Verweis auf ihre Übersicht, damit er nicht doppelt steht.
92. **Ein Baustein, zwei Routen** (`verwaltung/weg/Arbeitsbereich.tsx`): Die
    Objektauswahl rendert ihn bei selbstverwalteter Org mit genau einem Objekt
    direkt, `weg/[propertyId]` sonst. Meine ursprüngliche Weiterleitung ist
    entfallen — die Begründung aus #36 (Unterseiten springen über ihren
    Rückweg zurück und liefen im Kreis) trägt. Zwei Seiten mit gleichem Inhalt
    wären auseinandergelaufen.
93. **Was der Arbeitsbereich allein behält:** die Kontostände und die zwei
    buchhalterischen Aufgaben ohne Frist — Buchungen ohne Kostenart und
    Zahlungseingänge ohne Einheit. Beide kann kein Fahrplan kennen, weil sie
    keinen Stichtag haben; beide blockieren den Jahresabschluss.

## Schritt 20 — Block 2, KP4: Einnahmenseite im Wirtschaftsplan (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befund B7a).

94. **Neue Kategorie `CostCategory.ERTRAG` statt negativer Beträge.** § 28 Abs. 1
    WEG verlangt einen Plan über voraussichtliche **Einnahmen und Ausgaben**.
    Bisher gab es nur Ausgabenarten — Zinsen, Miete aus Gemeinschaftseigentum
    und PV-Einspeisung waren nicht abbildbar, und das Hausgeld damit bei jeder
    Gemeinschaft mit Einnahmen zu hoch. Die Invariante „`amountCents` immer
    positiv" bleibt erhalten; die Richtung steckt in der Kategorie. Ein
    signiertes Betragsfeld hätte jede Summenbildung im ganzen Modul
    umgeschrieben.
95. **Erträge folgen ihrem eigenen Schlüssel.** Ein PV-Erlös lässt sich nach
    Fläche verteilen, eine Zinsgutschrift nach MEA. Sie mindern den
    Vorschussbedarf über `computeUnitAdvances`, centgenau, und erscheinen im
    Einzelwirtschaftsplan als eigene Position mit umgekehrtem Vorzeichen.
96. **Kein `-0`.** `0 * -1` ergibt in JavaScript negative Null. Sie reist durch
    JSON und Snapshots und liest sich in der Oberfläche als „−0,00 €". Beim
    Vorzeichenwechsel deshalb explizit auf 0 geprüft — ein Test hält es fest.
97. **Plan mit Überschuss wird abgewiesen.** Übersteigen die geplanten Einnahmen
    die Ausgaben, lässt sich daraus kein Hausgeld ableiten; die Verteilung
    bricht mit einer verständlichen Meldung ab statt mit negativen Vorschüssen.
98. **In der Abrechnung laufen Ist-Einnahmen mit Ertrags-Kostenart gegen die
    Umlage.** Hausgeld-Eingänge tragen keine Kostenart und bleiben außen vor —
    die Abgrenzung ist genau diese Zuordnung.
99. **Die Kategorienliste der Server-Action wird aus `costCategoryLabels`
    abgeleitet.** Sie war handgepflegt, während sich das Auswahlfeld der Seite
    aus dem Label-Verzeichnis baut. Beim Ergänzen von ERTRAG hätte die
    Oberfläche eine Kategorie angeboten, die die Action stillschweigend ablehnt.

An echten Daten geprüft: 3.600 € PV-Einspeisung senken den Vorschussbedarf von
15.000 € auf 11.400 €; das monatliche Hausgeld sinkt bei jeder Einheit
entsprechend, Σ Einzelpläne == Vorschussbedarf.

## Schritt 21 — Block 2, KP5: Einzelwirtschaftsplan je Eigentümer (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befund B7c).

100. **Der Einzelwirtschaftsplan wird erstmals erzeugt.** § 28 Abs. 1 WEG
     verlangt Gesamtplan **und** Einzelwirtschaftspläne. Vorhanden war nur ein
     Dokument: der Gesamtplan mit einer Tabelle aller Einheiten. Jeder
     Eigentümer sah dort eine Summe statt ihrer Zusammensetzung — und nebenbei
     das Hausgeld aller Nachbarn.
101. **Die Rechenarbeit lag bereits fertig da.** `computeUnitAdvances()` liefert
     mit `perItem` die Aufschlüsselung je Position und Einheit; sie wurde
     nirgends verwendet. Der neue Generator (`documents/einzelwirtschaftsplan.ts`)
     rendert sie nur noch — kein neuer Rechenweg, keine zweite Wahrheit.
102. **Ein Bauer, zwei Routen, unterschiedliche Grenzen.** Der Verwalter wählt
     über `?dokument=einzelplan&einheit=…` frei; die Eigentümer-Route auf
     `/finanzen` ignoriert einen solchen Parameter und filtert hart auf
     `ownedUnitIdsInProperty`. Gerechnet wird in beiden Fällen über **alle**
     Einheiten — sonst stimmten die Verteilungsgewichte nicht —, gefiltert erst
     bei der Ausgabe.
103. **Positionen ohne Planwert fallen raus, Positionen ohne eigenen Anteil
     nicht.** Eine Nullzeile für eine Kostenart, die es im Plan nicht gibt, wäre
     Lärm. Eine Position, an der die eigene Einheit mit 0 € beteiligt ist
     (Stellplatz bei Verteilung nach Fläche), bleibt stehen: Sie beantwortet die
     Frage, warum dort nichts steht.
104. **Für Eigentümer heißt der Verweis „Mein Hausgeld im Detail"** und steht
     vor dem Gesamtplan. Das ist die Frage, die sie tatsächlich haben.

An echten Daten geprüft: WE 01 zeigt sechs Positionen mit Schlüssel und Anteil,
Jahresvorschuss 2.699,84 €, Monatsrate 224,98–224,99 € — deckungsgleich mit der
Hausgeld-Tabelle des Gesamtplans.

## Schritt 22 — Block 2, KP5b: Dokumente automatisch je Eigentümer ablegen (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befund C), Nachfrage „wer bekommt
wann was?".

105. **Einzelwirtschaftsplan und Einzelabrechnung waren reine Abrufdokumente.**
     Wer nicht von selbst unter „Finanzen" nachsah, bekam nichts. Beide werden
     jetzt beim Erzeugen automatisch in die Dokumente der jeweiligen Eigentümer
     gelegt (`lib/weg/owner-documents.ts`).
106. **Die Auslöser folgen dem Gesetz, nicht der Bequemlichkeit.** Der
     Einzelwirtschaftsplan wird mit dem **Beschluss** abgelegt (`resolvePlan`) —
     erst der Beschluss macht die Vorschüsse fällig (§ 28 Abs. 1 WEG), vorher
     gibt es keine aufbewahrenswerte Fassung. Die Einzelabrechnung wird mit dem
     **Fertigstellen** abgelegt (`finalizeStatement`), also **vor** der
     Versammlung: Dort wird über die Abrechnungsspitze beschlossen (§ 28 Abs. 2
     Satz 1 WEG), und dafür müssen die Eigentümer sie vorher prüfen können.
     Nach dem Beschluss zu verteilen wäre zu spät.
107. **Adressiert wird gezielt über `DocumentRecipient`.** Sind Empfänger
     gesetzt, sieht nur diese Person das Dokument (`documentWhereForUser`).
     Niemand bekommt die Abrechnung des Nachbarn samt dessen Zahlungsdaten.
108. **Einheiten ohne erfassten Eigentümer werden übersprungen — und gemeldet.**
     Ein Dokument ohne Empfänger fiele auf die `audience`-Logik zurück und wäre
     damit für **alle** Eigentümer des Objekts sichtbar. Das ist der Grund für
     das Überspringen; die Rückmeldung nennt die Einheiten, damit der Verwalter
     den Eigentümer nachträgt.
109. **`externalRef` macht den Vorgang wiederholbar.** Ein zweiter Lauf ersetzt
     die vorhandene Fassung, statt die Ablage zu verdoppeln. Ohne diesen
     Schlüssel lägen nach drei Korrekturläufen drei Abrechnungen nebeneinander,
     ohne Angabe welche gilt.
110. **Reihenfolge: erst alle Dateien hochladen, dann die Datenbank in *einer*
     Transaktion, und die ersetzten Dateien zuletzt löschen.** Der erste Entwurf
     löschte die alte Datei sofort beim Ersetzen — ein Fehler danach hätte die
     Datei gelöscht, auf die der zurückgerollte Datensatz noch zeigt.
111. **Das Abrechnungs-PDF behauptete „Beschlossene Abrechnung".** Falsch:
     `StatementStatus` kennt nur ENTWURF und FERTIG, keinen Beschlusszustand.
     Der Fuß sagt jetzt, dass über die Abrechnungsspitze noch die Versammlung
     beschließt — sonst hielte der Eigentümer eine Nachzahlung für fällig, die
     es noch nicht ist.
112. **Bekannte Lücke: keine Wiederholaktion.** Schlägt die Ablage fehl, wird
     das protokolliert, aber die Abrechnung bleibt fertiggestellt; ein erneuter
     Anlauf ist über `finalizeStatement` nicht möglich, weil das nur für
     ENTWURF läuft. Der Helfer ist idempotent, ein Wiederholknopf wäre also
     gefahrlos nachzurüsten.

An echten Daten geprüft: erster Lauf 6 erstellt, zweiter Lauf 6 ersetzt (keine
Dubletten); eine Einheit ohne `UnitOwnership` wurde übersprungen und gemeldet;
Erika Eigentümerin sieht 4, Klaus Käufer 1 Dokument — niemand das des anderen.

## Schritt 23 — Block 2, KP6: § 35a weist den Lohnanteil aus (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befund B4).

113. **Die Zeile hieß „Steuerlich begünstigte Aufwendungen" und enthielt den
     Bruttobetrag.** Begünstigt sind nach § 35a EStG aber nur Lohn-, Fahrt- und
     Maschinenkosten; Material ist es nicht. Genau diese Zahl trägt der
     Eigentümer in seine Steuererklärung ein — bei einer Handwerkerrechnung mit
     hohem Materialanteil war sie um ein Vielfaches zu hoch.
114. **Zwei Quellen, klare Rangfolge.** `Booking.laborShareCents` ist der in der
     Rechnung ausgewiesene Anteil und geht immer vor. Fehlt er, greift
     `CostType.laborSharePercent` als Erfahrungswert der Kostenart. Der Wert an
     der Buchung wird auf den Rechnungsbetrag gedeckelt: Ein Vertipper darf
     keinen Ausweis erzeugen, der über der Ausgabe liegt.
115. **Ohne beides wird nichts ausgewiesen, sondern die Lücke benannt.** Der
     Betrag erscheint als „Lohnanteil nicht erfasst" — in der Verwalter-Tabelle,
     im PDF und in der Eigentümer-Ansicht. Eine geschätzte Zahl wäre schlimmer
     als keine: Sie sieht amtlich aus, hält aber der Rückfrage des Finanzamts
     nicht stand (§ 35a Abs. 5 Satz 3 EStG verlangt die Rechnung).
116. **Fehlt der Eintrag ganz, gilt der volle umgelegte Betrag als Lücke.**
     `computeStatement` fällt dafür auf `verteilbarCents` zurück. Ohne diesen
     Rückfall verschwände die Lücke stillschweigend und die Abrechnung sähe aus,
     als gäbe es bei dieser Position nichts Begünstigtes.
117. **Der Lohnanteil wird entlang derselben Verteilung umgelegt wie die
     Position selbst.** Wer 3,7 % der Kosten trägt, trägt 3,7 % des Lohnanteils —
     centgenau über `distributeByWeight`, damit Σ Einheiten == Lohnanteil.
118. **Aus der Rücklage bezahlte Ausgaben bleiben außen vor.** Sie werden im Jahr
     nicht umgelegt, also trägt sie kein Eigentümer und niemand kann sie
     absetzen. Ist eine Position vollständig aus der Rücklage bezahlt, gibt es
     zudem kein Gewicht, an dem sich der Anteil ausrichten könnte.
119. **Nachtragen muss möglich sein.** Der Bankimport kennt nur den
     Gesamtbetrag; die Rechnung liegt oft später vor. `setLaborShare` trägt den
     Anteil an einer vorhandenen Buchung nach — mit derselben Sperre wie die
     Kostenart-Zuordnung (abgeschlossene Jahre und Stornopaare bleiben
     unverändert). Leeren setzt zurück auf „nicht erfasst"; das ist etwas
     anderes als „null Euro Lohnanteil".
120. **Die Spalte erscheint nur, wo sie eine Frage ist** — bei Ausgaben einer
     §35a-eingestuften Kostenart. Sonst lüde sie zu einer Angabe ein, die nichts
     bewirkt. Aus demselben Grund wird `laborSharePercent` geleert, sobald die
     Kostenart auf KEINE gestellt wird.

An echten Daten geprüft (Rechnung 1.000,00 €, Kostenart Hausmeister/MEA):
nichts erfasst → 0,00 € ausgewiesen und 1.000,00 € als Lücke; 40 % an der
Kostenart → 400,00 €, keine Lücke; Rechnung mit 620,00 € → 620,00 € (schlägt die
Schätzung); Tippfehler 5.000,00 € → auf 1.000,00 € gedeckelt; 333,33 € →
centgenau auf die Einheiten verteilt.

## Schritt 24 — Block 2, KP7: HeizkostenV-Schutz (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befund B3).

121. **Die Zählerverteilung legte Heizkosten zu 100 % nach Verbrauch um.** Das
     sieht gerecht aus und ist trotzdem formell fehlerhaft: §§ 7 Abs. 1, 8
     Abs. 1 HeizkostenV verlangen 50–70 % nach Verbrauch, den Rest als
     Grundkosten nach Wohnfläche. Wer anders abrechnet, gibt jedem Eigentümer
     nach § 12 Abs. 1 HeizkostenV ein Kürzungsrecht von 15 % — und die Differenz
     trägt die Gemeinschaft.
122. **Gekennzeichnet wird die Kostenart, nicht der Umlageschlüssel.**
     `CostType.heatingCost` ist im Standardkatalog für „Heizung/Warmwasser"
     gesetzt und in den Stammdaten umschaltbar. Am Schlüssel VERBRAUCH ließe
     sich das nicht festmachen: Kaltwasser und Allgemeinstrom werden zu Recht
     vollständig nach Verbrauch verteilt.
123. **Werte außerhalb 50–70 % werden abgelehnt, nicht gerundet.** Die
     Verordnung lässt keinen Spielraum, und eine stillschweigend korrigierte
     Eingabe wäre nicht das, was der Verwalter entschieden hat. Vorbelegung ist
     70 % — der in der Praxis üblichste Wert.
124. **Die Restcents sitzen bei den Grundkosten.** Sie werden als
     `totalCents − Verbrauchskosten` gebildet statt selbst gerundet. Dadurch ist
     Σ Grundkosten + Σ Verbrauchskosten == Gesamtbetrag ohne Sonderfall.
125. **Für die Grundkosten gilt die nachsichtige Flächengewichtung**
     (`advanceWeightsForKey`). Ein Stellplatz hat keine Wohnfläche und wird
     nicht beheizt — er trägt zu Recht null Grundkosten. Die strenge Variante
     bräche ab und machte die Funktion für jede WEG mit Garagen unbrauchbar.
     Fehlt die Fläche bei *allen* Einheiten, schlägt die Verteilung fehl und
     meldet das.
126. **Der Hinweis nennt den besseren Weg.** Der Messdienst-Import rechnet die
     Rohrwärme (§ 9 HeizkostenV) und die Trennung von Heizung und Warmwasser
     bereits ein; beides kann diese Funktion nicht leisten. Sie bleibt der
     Notbehelf für Gemeinschaften, die selbst ablesen — mit dem Unterschied,
     dass sie jetzt wenigstens nicht mehr rechtswidrig verteilt.

An echten Daten geprüft (12.000,00 € Heizkosten, sechs Einheiten): bei 70/30
entfallen 3.600,00 € auf Grundkosten; die Einheit ohne Verbrauch trägt jetzt
683,60 € statt 0,00 €. Σ Einheiten == Gesamtbetrag bei 70 % wie bei 50 %.

## Schritt 25 — Durchsicht des gesamten Zweigs (27.07.2026)

Vor dem Zusammenführen einmal über alles geschaut. Zwei Fehler gefunden, beide
Folgen derselben Ursache: eine Änderung, die an zwei Stellen hätte landen müssen.

127. **Der Seed trug `heatingCost` nicht mit.** Die Zuordnung Katalog → Kostenart
     stand zweimal fast wortgleich da (Server-Action und Seed); ergänzt wurde
     nur eine. Eine frisch aufgesetzte Demo-WEG hätte ihre Heizkosten weiter zu
     100 % nach Verbrauch verteilt — genau der Fehler, den KP7 behebt. Behoben
     über `costTypeFieldsFrom()` in `cost-catalog.ts`: Ein neues Feld gehört ab
     jetzt nur noch dorthin.
128. **Die Zählerverteilung rechnete mit dem Gesamtbetrag statt dem umlegbaren
     Teil.** Seit KP3 wird eine aus der Erhaltungsrücklage bezahlte Ausgabe nicht
     mehr umgelegt; `distributeByMeters` zählte sie weiter mit. Bei einer
     Heizungsposition, die teilweise aus der Rücklage bezahlt wurde, hätte die
     automatische Verteilung eine Summe geschrieben, die die Abrechnung
     anschließend als „Manuelle Verteilung unvollständig" zurückweist — ohne
     erkennbaren Grund für den Verwalter. Jetzt filtert die Abfrage auf
     Nicht-Rücklagenkonten, wie die Abrechnung selbst.

Geprüft und in Ordnung:

- **Abwärtsverträglichkeit der Snapshots.** Eine vor dieser Änderung
  fertiggestellte Abrechnung hat weder `labor.unerfasst` noch `heatingCost` im
  Snapshot. An echten Daten gegengeprüft: Das PDF entsteht unverändert, die
  Lücken-Zeile bleibt aus. Das ist richtig so — ein fertiges Jahr zeigt weiter
  das, was die Eigentümer bekommen haben. Die §35a-Zahlen abgeschlossener Jahre
  bleiben damit die alten (Brutto-)Werte; korrigierbar nur über eine neue
  Abrechnung.
- **Wanderung der Migrationen.** Fünf neue, alle additiv: zwei Spalten, ein
  Enum-Wert, eine Selbstrelation, ein Flag mit Bestandsaktualisierung. Keine
  löscht oder ändert Bestandsdaten.

## Schritt 27 — Block 3, KP8: Fortgeltung und geänderter Wirtschaftsplan (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befunde A4, B7b, B6).

133. **Der Plan war starr an sein Wirtschaftsjahr gebunden** und erzeugte mit
     dem Beschluss genau zwölf Sollstellungen. Zwei Löcher folgten daraus: Ohne
     Nachfolgeplan endeten die Forderungen mit dem Jahr — ab Januar schuldete
     niemand mehr Hausgeld, es gab keine Rückstände, nichts zu mahnen und nichts
     einzuziehen, obwohl das Geld der Gemeinschaft fehlt. Und ein unterjährig
     geänderter Plan war nicht speicherbar, weil `@@unique([propertyId, year])`
     nur einen Plan je Jahr zuließ.
134. **Nicht das Jahr bestimmt, was gilt, sondern der Geltungszeitraum.**
     `EconomicPlan.validFrom` / `validUntil` lösen beides mit demselben
     Gedanken. § 28 Abs. 1 Satz 2 WEG: Der beschlossene Plan gilt fort, bis ein
     neuer beschlossen ist — `validUntil = null` heißt genau das.
135. **Die Monatsrate beginnt im Folgejahr wieder bei Index 0.** Über die
     Jahresgrenze hinweg durchzuzählen wäre naheliegend und falsch: Die
     Restcent-Verteilung von `monthlyInstallments` muss sich in jedem Jahr
     gleich verhalten, sonst summierten sich die Raten nicht zum Jahresbetrag.
136. **Abgleichen statt löschen und neu anlegen.** Das alte `deleteMany` +
     `createMany` ist mit Zahlungen im Bestand nicht tragbar — jede Zuordnung
     einer Zahlung hinge danach in der Luft, die Historie einer Mahnung wäre
     weg. `synchronisiereSollstellungen` legt Fehlendes an, passt Beträge an
     und entfernt nicht mehr Getragenes.
137. **Bereits Fälliges bleibt unverändert — solange der Plan den Monat
     weiterhin trägt.** Was ein Eigentümer im März schuldete, schuldete er; ein
     Beschluss wirkt nach vorn. Angelegt wird dagegen auch rückwirkend: Tagt die
     Versammlung im April, entstehen die Forderungen für Januar bis März
     nachträglich, weil sie die ganze Zeit bestanden.
138. **Trägt der Plan einen Monat nicht mehr, wird auch Fälliges entfernt.**
     Der erste Entwurf schonte hier alles Fällige — der Prüflauf an echten Daten
     brachte prompt 48 Monate mit **doppelter** Forderung ans Licht: Alter und
     neuer Plan trugen dieselben Monate nebeneinander. Gefahrlos ist das
     Entfernen erst durch Punkt 139.
139. **Ein Nachfolgeplan darf nicht rückwirkend beginnen.** Verdrängt er einen
     bereits beschlossenen Plan, ist frühestens der laufende Monat zulässig.
     Sonst würde rückwirkend geändert, was jemand schuldete — und dafür müssten
     Sollstellungen weichen, die längst bezahlt oder gemahnt sein können. Der
     Normalfall bleibt erlaubt: Für Januar gibt es keinen Vorgänger, wenn im
     April erstmals über das laufende Jahr beschlossen wird.
140. **Ein Knopf, kein stiller Automatismus.** Die Fortschreibung läuft über
     „Forderungen nachziehen" im Hausgeld, nicht beim Seitenaufruf. Neue
     Forderungen sollen entstehen, weil jemand sie auslöst — nicht als
     Nebenwirkung des Hinsehens. Der Fahrplan weist mit Vorrang darauf hin,
     sobald Monate fehlen: Es ist der stillste aller Fehler, denn es fehlt
     nichts Sichtbares, es passiert nur nichts mehr.
141. **Fälligkeitsregel je Objekt** (Monatserster / dritter Werktag / fester
     Tag). Sie steuert die Sollstellungen **und** den Wortlaut der
     Beschlussvorlage aus derselben Quelle — sonst mahnt die Verwaltung zu einem
     Termin, den der Beschluss nicht nennt. Samstag zählt beim dritten Werktag
     nicht: Im Zahlungsverkehr wird an ihm nicht gebucht. Ein freier Tag ist auf
     den 28. begrenzt, damit es den Termin in jedem Monat gibt.
142. **Ein zweiter Plan desselben Jahres ist jetzt erlaubt** — das ist der
     geänderte Wirtschaftsplan. Nur ein offener *Entwurf* wird weitergeführt
     statt verdoppelt; zwei halb ausgefüllte Entwürfe nebeneinander sind bloß
     verwirrend.

An echten Daten geprüft (Plan 2026, sechs Einheiten): Beschluss im Juli erzeugt
rückwirkend die Monate ab Januar; im Februar 2027 laufen die Forderungen ohne
Nachfolger weiter bis April 2027; eine verbogene Sollstellung aus März 2026
bleibt beim Abgleich unangetastet, eine künftige wird korrigiert; ein geänderter
Plan ab Juli grenzt den Vorgänger auf Januar–Juni ab — **0 Monate mit doppelter
Forderung**.

## Schritt 28 — Block 3, KP9: echte Zahlungszuordnung (27.07.2026)

Grundlage: `docs/REVIEW-WEG-Buchhaltung.md` (Befunde B2, D3).

143. **Der Rückstand war eine Differenz zweier Summen** — „alle fälligen
     Sollstellungen minus alle Einnahmen dieser Einheit". Diese eine Subtraktion
     rechnet vier Dinge falsch: Die Zahlung einer Sonderumlage tilgte
     Hausgeldrückstände, eine Vorauszahlung verdeckte einen offenen Monat, eine
     Sammelüberweisung ließ sich nicht aufteilen — und die Mahnung nannte damit
     einen Betrag nach außen, den niemand prüfen konnte.
144. **`PaymentAllocation` beantwortet die andere Frage.** `Booking.unitId` sagt,
     *von wem* das Geld kam, und bleibt als Vorfilter. Worauf es angerechnet
     wurde, steht jetzt in eigenen Zeilen mit Teilbeträgen.
145. **§ 366 Abs. 2 BGB bestimmt die Reihenfolge:** fällige vor nicht fälligen;
     unter den fälligen die gemahnte (die „lästigere"); bei gleicher Lästigkeit
     die ältere. Bei gleichem Datum entscheidet die ID — ohne diesen Anker hinge
     die Reihenfolge an der Ladereihenfolge und der Vorschlag wäre nicht
     reproduzierbar.
146. **§ 366 Abs. 1 geht Abs. 2 vor — und das war zunächst nicht drin.** Der
     Prüflauf an echten Daten zeigte es: Eine Zahlung mit dem Verwendungszweck
     „Sonderumlage Dachsanierung" tilgte das ältere Hausgeld, weil die
     gesetzliche Reihenfolge allein angewandt wurde. Der Zahlende darf aber
     bestimmen, worauf er zahlt. Nachgetragen als Auswahl am Anrechnen-Knopf:
     **Der Verwalter liest den Verwendungszweck, nicht das Programm.** Eine
     Fehldeutung von Fließtext verschöbe echtes Geld.
147. **§ 367 Abs. 1 (Kosten → Zinsen → Hauptforderung) ist eingebaut, obwohl
     Kosten und Zinsen heute immer 0 sind.** Mahnkosten und Verzugszinsen werden
     noch nicht je Forderung erfasst. Die Aufteilung jetzt vorzusehen ist
     billiger, als sie später in eine bestehende Reihenfolge einzuziehen.
148. **Eine Vorauszahlung bleibt Guthaben.** Sie tilgt nichts Künftiges und wird
     getrennt ausgewiesen, statt den Rückstand zu mindern — genau das Verdecken
     war der Befund. Auch die Mahnung rechnet ein nicht zugeordnetes Guthaben
     **nicht** gegen: Ein Betrag, der eine noch nicht zugeordnete Überweisung
     stillschweigend verrechnet, ist von außen nicht nachvollziehbar.
149. **Angerechnet wird auf Knopfdruck, nicht still.** Der Vorschlag ist ein
     Vorschlag; lösen lässt er sich wieder, ohne die Zahlung selbst anzutasten.
150. **Offene Posten mit Altersstruktur** (0–30 / 31–60 / 61–90 / über 90 Tage)
     samt ältester offener Fälligkeit. Eine bloße Summe lässt die entscheidende
     Frage offen: Sind 1.200 € ein Monat bei mehreren Eigentümern oder ein Jahr
     bei einem? Nur das Zweite trägt die nächste Mahnstufe.
151. **Die Zuordnungshilfe kennt jetzt drei Wege**, nach Verlässlichkeit
     geordnet: IBAN aus dem SEPA-Mandat, Einheiten-Kurzlabel im Verwendungszweck,
     Nachname des Eigentümers. Der Name zählt **nur, wenn er im Objekt eindeutig
     ist** — zwei Eigentümer namens Müller machen den Hinweis wertlos.

An echten Daten geprüft (Hausgeld 5/2026 + 6/2026 je 200 €, Sonderumlage
1.000 €): Mit Zweckangabe tilgt die 1.000-€-Zahlung ausschließlich die Umlage,
ohne Zweckangabe zuerst das ältere Hausgeld; nach Ausgleich aller fälligen
Forderungen bleibt eine Vorauszahlung von 200 € vollständig als Guthaben stehen
und mindert den Rückstand nicht; der Mahnbetrag entspricht exakt dem
ausgewiesenen Rückstand; nie wird mehr angerechnet als gezahlt wurde.
