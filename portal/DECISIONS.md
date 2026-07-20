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
