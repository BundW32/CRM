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

## Schritt 29 — Eigene Felder auf die Oberflächen-Bausteine ziehen (28.07.2026)

Anlass: PR #43 macht rohes `<input type="date">` und den Nachbau von `Card` und
`Badge` zu Build-Fehlern (`eslint.oberflaeche.mjs`).

152. **Die vier angefassten Dateien stehen noch auf der Ausnahmeliste** — der
     Zweig baut also auch ohne Änderung. Umgestellt wurden trotzdem die Felder,
     die **dieser Zweig neu hinzugefügt** hat: das Datumsfeld „Gilt ab" im
     Wirtschaftsplan (`DateField`), die Fälligkeitsregel in den Stammdaten und
     die Tilgungsbestimmung im Hausgeld (`SelectField`).
153. **Grund: Die Ausnahmeliste soll kürzer werden, nicht länger bleiben.** Wer
     in einer noch ausgenommenen Datei neue Verstöße nachlegt, verlängert die
     Umstellungswelle für den, der sie später anfasst — und die Regel wäre
     genau dort wirkungslos, wo neu gearbeitet wird.
154. **Der Bestand bleibt liegen.** Die übrigen rohen Datumsfelder dieser vier
     Dateien gehören zur geplanten Welle und werden dort mitgezogen; sie hier
     nebenbei anzufassen, hieße zwei Zweige über dieselben Zeilen zu führen.

## Schritt 30 — Durchsicht der eigenen Arbeit: drei Nachlässigkeiten (28.07.2026)

Nach Abschluss von KP1–KP9 einmal über alles Eigene geschaut. Drei Funde, alle
selbst verursacht.

155. **Sechs Warteschlangen statt einer auf der Hausgeld-Seite.** Mit jedem
     Schritt (Fortgeltungs-Prüfung, offene Posten, SEPA-Mandate, Eigentümer,
     Übernahme, Mahnungen) war ein weiteres `await` dazugekommen, ohne dass
     eines auf das vorige wartet. Sechs Stufen heißen sechs Wartezeiten zur
     Datenbank **nacheinander** — sie addieren sich zur Ladezeit, obwohl sie
     gleichzeitig laufen könnten. Jetzt ein einziger `Promise.all`.
     Der Fehler entsteht schleichend: Jede Änderung für sich sah harmlos aus.
156. **Ein Kommentar behauptete etwas Falsches.**
     `sortiereNachTilgungsreihenfolge` trug „exportiert, weil die Reihenfolge in
     der Oberfläche erklärt wird" — das tut sie nirgends. Exportiert ist sie,
     damit die Vorschrift für sich geprüft werden kann; genau das sagt der
     Kommentar jetzt. Ein Kommentar, der nicht stimmt, ist schlimmer als keiner:
     Der nächste Leser richtet sich danach.
157. **Doppelte Logik statt des vorhandenen Helfers.** `resolvePlan` rechnete
     den Monatsersten mit einer eigenen kleinen Funktion aus, obwohl
     `monatsBeginn` aus `plan-validity.ts` genau das tut. Zwei Stellen, die
     dasselbe rechnen, laufen irgendwann auseinander.

Nicht geändert, obwohl es auffiel: Die Hausgeld-Seite lädt die Sollstellungen
zweimal — einmal als Summe je Einheit (`dueSums`, „Soll fällig") und einmal
vollständig für die offenen Posten. Zusammenlegen ginge nicht ohne Verlust: Die
Spalte zeigt **alle fälligen** Forderungen, die offenen Posten nur die **noch
offenen**. Aus dem einen lässt sich das andere nicht ableiten.

## Schritt 31 — LP1: Erklärungen ein- und ausschaltbar (28.07.2026)

Grundlage: `docs/PLAN-Laientauglichkeit.md` (LP1).

158. **Es gab bisher keinerlei Nutzereinstellung.** `User` trug nur Kontoflags.
     `showHints` ist das erste Feld, das eine *Vorliebe* speichert — und
     deshalb ein neues Muster, kein Anbau an ein vorhandenes.
159. **Standardmäßig an.** Die umgekehrte Voreinstellung erreichte genau die
     nicht, für die die Hinweise gedacht sind: Wer nicht weiß, was eine
     Sollstellung ist, sucht keinen Schalter für ihre Erklärung.
160. **Am Nutzer, nicht an der Organisation.** Zwei Eigentümer derselben WEG
     dürfen es verschieden wollen. Deshalb steht der Schalter unter „Konto" und
     nicht in den Verwalter-Einstellungen.
161. **Serverseitig entschieden.** `<Tipp>` rendert gar nicht erst, wenn die
     Hinweise aus sind. Rendern und per CSS verstecken hätte den Text trotzdem
     über die Leitung geschickt und ihn beim Laden aufblitzen lassen.
     `getUser()` ist pro Request gecacht — beliebig viele Hinweise auf einer
     Seite kosten zusammen eine Abfrage.
162. **Warnungen und Fehlermeldungen hängen NICHT daran.** Ein abgeschalteter
     Tipp darf niemanden in einen Fehler laufen lassen, den er hätte vermeiden
     können. `src/lib/tipp-regeln.test.ts` hält das fest: kein `<Alert>` in
     einem `<Tipp>`, und keine Seite liest `showHints` selbst aus — sonst stünde
     die Regel bald in dreißig Dateien und gälte in achtundzwanzig davon.
163. **Der Wächter hätte sich fast selbst ausgehebelt.** Erster Wurf:
     `join(__dirname, "..")` statt `".." , ".."` — der Glob fand **null**
     Dateien und der Test meldete Erfolg, ohne eine einzige gesehen zu haben.
     Aufgefallen nur, weil ein absichtlicher Verstoß eingebaut und geprüft
     wurde, ob der Test ihn fängt. Seitdem sichert eine eigene Zusicherung
     (`dateien.length > 50`) genau das ab.
164. **Der WEG-Bereich wurde vollständig umgestellt, der Rest zieht nach.**
     Ein Schalter, der drei Texte betrifft, ist kein Schalter — deshalb sind
     alle 15 Erklärabsätze der WEG-Finanzseiten mit umgezogen. Das ist der
     Bereich, in dem Laien tatsächlich arbeiten. Außerhalb (rund 190 Texte)
     gilt weiter: Wer die Seite ohnehin anfasst, zieht sie mit.
165. **Nicht jeder graue Kleintext ist ein Hinweis.** Von 25 Absätzen im
     WEG-Bereich enthalten 10 **Daten** — Beträge, Zähler, abgeleitete Aussagen
     („Bedarf übersteigt den Rücklagenstand"). Die blieben stehen: Sie
     abzuschalten hieße, dem Nutzer Zahlen vorzuenthalten, nicht Erklärungen.
     Die Trennung lief über eine Prüfung auf eingebettete Ausdrücke, nicht über
     Augenmaß.

An echten Daten geprüft: Schalter vorbelegt an; ausgeschaltet verschwinden die
Erklärungen auf Stammdaten und Wirtschaftsplan-Detail, Warnungen und
Rückstandshinweise bleiben; wieder eingeschaltet sind sie zurück.

## Schritt 32 — LP2: Fehlermeldungen führen ans Ziel (28.07.2026)

Grundlage: `docs/PLAN-Laientauglichkeit.md` (LP2).

166. **„Die Verteilung ist nicht möglich" ließ den Nutzer suchen.** Die Meldung
     nennt jetzt die betroffene Einheit beim Namen: „Der Miteigentumsanteil
     (MEA) fehlt bei WE 03." Die Daten dafür lagen bereits vor —
     `PositionNichtVerteilbar` kennt das Feld, `einheitenOhneFeld` liefert die
     Einheiten dazu.
167. **Zeilenanker statt Abschnittsanker.** Bisher gab es fünf Sprungziele, alle
     auf Kartenebene. Bei zwanzig Einheiten landet man damit richtig und sucht
     trotzdem weiter. Jede Einheit, Kostenart und jedes Konto hat jetzt ein
     eigenes Ziel. **Eigener Namensraum (`zeile-…`), weil `einheit-…` bereits
     die Formular-ID dieser Zeile ist** — zwei gleiche IDs hätten den
     `form`-Verweis mehrdeutig gemacht.
168. **Die angesprungene Zeile hebt sich kurz hervor** (`:target` in
     `globals.css`). Ohne Markierung landet man richtig und sieht es nicht,
     besonders bei zwanzig gleich aussehenden Zeilen. Bei `prefers-reduced-motion`
     bleibt die Markierung stehen statt zu verblassen — die Information darf
     nicht verlorengehen, nur weil jemand Bewegung abstellt.
169. **Der Ankersprung funktionierte überhaupt nicht zuverlässig — und zwar
     schon vorher.** Gemessen: In zwei von drei Aufrufen blieb die Seite oben
     stehen. Die naheliegende Erklärung („das Ziel gibt es noch nicht") war
     falsch; das Ziel war da. **Die Seite war noch nicht hoch genug:** Next
     liefert gestreamt aus, und solange der Teil unterhalb fehlt, gibt es
     nichts zu scrollen. `scrollIntoView` läuft dann folgenlos durch.
170. **`HashScroll` wiederholt den Sprung, bis er sitzt** — Bild für Bild,
     längstens anderthalb Sekunden, Abbruch sobald der Nutzer selbst scrollt.
     Ein erster Entwurf versuchte es nur zwanzig Bilder lang und machte es
     dadurch **schlechter** als vorher (0 von 5 statt 1 von 3). Nach dem Umbau:
     5 von 5. Das betrifft alle Anker, auch die vorhandenen
     `?flash=gespeichert#einheiten`-Rücksprünge.
171. **`fehlermeldungen.test.ts` hält es fest:** Kein Text darf auf die
     Stammdaten verweisen, ohne dorthin zu verlinken. Der Wächter fand sofort
     eine Fundstelle (Sonderumlagen) — genau dafür ist er da.

An echten Daten geprüft (MEA bei WE 03 entfernt): Die Meldung nennt WE 03, der
Link zeigt auf `#zeile-<id>`, das Ziel steht nach dem Sprung 96 px unter dem
Rand (die `scroll-mt-24`-Marge), die Hervorhebung greift — fünf von fünf Läufen.

## Schritt 33 — LP3: Glossar an Ort und Stelle (28.07.2026)

Grundlage: `docs/PLAN-Laientauglichkeit.md` (LP3).

172. **Die Begriffe werden nicht ersetzt.** Das war die naheliegende Idee und
     wäre falsch: „Abrechnungsspitze" und „Sollstellung" benutzen der Beirat,
     der Steuerberater und im Streitfall das Gericht. Wer sie umbenennt, macht
     das Programm für Laien verständlich und für alle anderen unbenutzbar — und
     der Eigentümer lernt nie, wovon in seiner Versammlung die Rede ist. Die
     Erklärung tritt **daneben**, nicht an die Stelle.
173. **Ein Satz je Begriff, hart begrenzt.** Zwei liest niemand, der gerade
     etwas anderes vorhat. `glossar.test.ts` erzwingt die Grenze, sonst wächst
     aus der Erklärung ein Absatz und aus dem Absatz ein zweites Handbuch.
174. **Kein Popup-Framework, kein Client-JS.** Die Erklärung steht im Dokument
     und wird per CSS bei Mauszeiger oder Tastaturfokus eingeblendet. Sie
     funktioniert damit ohne JavaScript, kostet nichts, und Screenreader lesen
     sie ohnehin vor — unabhängig davon, ob sie gerade sichtbar ist.
175. **Tastaturfokus ist Absicht, obwohl er Tab-Stopps kostet.** Ein Begriff,
     den nur die Maus erreicht, ist für Tastaturnutzer nicht vorhanden. Der
     Preis sind auf der längsten Seite etwa ein Dutzend zusätzliche Stopps.
176. **Ein Paragraph ohne Gesetz ist keine Fundstelle.** „§ 28 Abs. 1" allein
     sagt nicht, woraus — und bei diesen Begriffen liegt die Antwort zwischen
     WEG, BGB, EStG und HeizkostenV. Der Test verlangt die Angabe.
177. **Ein Tippfehler im Begriffsnamen fiele sonst erst zur Laufzeit auf** — und
     dort als leere Erklärung, nicht als Fehler. Der Test gleicht alle
     verwendeten Namen gegen das Glossar ab; die Gegenprobe mit einem
     absichtlichen Tippfehler schlug fehl, wie sie soll.

An echten Daten geprüft: Begriff gepunktet unterstrichen, Erklärung erscheint
bei Mauszeiger **und** bei Tastaturfokus, ist vorher unsichtbar; bei
abgeschalteten Hinweisen bleibt das Wort als gewöhnlicher Text stehen.

## Schritt 34 — LP4/LP5: geführte Ersteinrichtung (28.07.2026)

Grundlage: `docs/PLAN-Laientauglichkeit.md` (LP4, LP5).

178. **Die Führung erklärt das Programm, nicht die Bedienung.** Eine Tour, die
     auf Schaltflächen zeigt, lehrt Klicken. Wer seine WEG zum ersten Mal selbst
     verwaltet, braucht zuerst die Antwort auf „wozu ist das da". Jeder Text
     sagt deshalb, was der Bereich **einem bringt** — „Hier sehen Sie, ob das
     Geld der Gemeinschaft reicht" statt „Hier stehen Ihre Konten".
179. **Eigenbau statt Bibliothek.** driver.js und Shepherd bringen eigenes
     Aussehen mit und kämpfen gegen das gerade vereinheitlichte Design. Die
     Sprechblase benutzt stattdessen dieselben Bausteine wie jede Karte —
     `cardSurfaceClass`, `buttonClass`, dieselbe Erhebung.
180. **Die Marker leiten sich aus der Navigation ab.** `data-tour="nav-…"`
     entsteht aus dem `href` des Menüpunkts. Ein neuer Punkt bringt seinen
     Marker damit selbst mit, ein entfernter nimmt ihn mit. Von Hand gepflegte
     Marker wären genau die Kopplung, die eine Führung bei jedem Umbau
     zerbrechen lässt.
181. **Die Führung wechselt die Seite.** Ohne das zeigte sie ins Leere, sobald
     ein Ziel nicht zufällig auf der aktuellen Seite lag — im ersten Prüflauf
     traf **einer von sechs** Schritten. Jetzt trägt jeder Schritt seinen Pfad,
     und die Mechanik fasst nach, bis das Ziel der neuen Seite da ist.
182. **Zwei Arten von „nicht zu sehen", die verschieden zu behandeln sind.**
     Beim ersten Anlauf hatte ich sie vermischt: *Unter dem Falz* ist erreichbar
     (hinscrollen), *seitlich draußen* nicht (auf dem Handy liegt die Navigation
     in einem geschlossenen Schubfach). Dorthin führt kein Scrollen — dort gibt
     es die zentrierte Karte statt eines Lichtkegels auf die falsche Stelle.
183. **Kein Schritt verspricht etwas, das es nicht gibt.** Ohne API-Schlüssel
     existiert der Assistent nicht; der Schritt, der ihn anpries, schickte den
     Nutzer auf eine vergebliche Suche. Er erscheint jetzt nur, wenn das Widget
     tatsächlich läuft. Dasselbe für die Selbstverwalter-Schritte.
184. **Texte geräteunabhängig.** „Alles liegt links" stimmte nur am Rechner.
     Auf dem Handy sitzt die Leiste hinter dem Menü-Knopf — der Prüflauf bei
     390 px zeigte eine Erklärung, die dort nicht zutrifft.
185. **Dreimal lag mein Prüfskript falsch, nicht das Programm.** Es suchte nach
     „irgendeinem orangen Ring" und fand den pulsierenden Hinweis zur
     Startbildschirm-Installation; es maß vor dem Seitenwechsel; es erwartete
     mobil einen Lichtkegel, wo der zentrierte Rückfall richtig ist. Der
     Lichtkegel trägt jetzt `data-tour-ring`, damit eine Prüfung ihn eindeutig
     findet — ein Test, der das falsche Element misst, ist schlimmer als keiner.

An echten Daten geprüft, Desktop (1280 px) und Handy (390 px), je für
Selbstverwaltung und professionelle Verwaltung: Jeder Lichtkegel sitzt auf
seinem Ziel oder fällt bewusst auf die zentrierte Karte zurück; Escape beendet;
die Führung erscheint genau einmal von selbst und lässt sich unter „Konto"
neu starten.

## Schritt 35 — LP6: die Tour selbst (28.07.2026)

Der Inhaltsdurchgang. LP4/LP5 hatten die Mechanik und die Marker; hier ging es
darum, ob die Führung für einen Laien **stimmt** — und der Prüflauf hat dabei
drei Dinge zutage gefördert, die auf dem Papier in Ordnung aussahen.

186. **Die Sprechblase lag unter dem Bildrand.** Ihre Position hing an einer
     geratenen Zahl („mehr als 220 px unter dem Ziel, dann passt sie schon").
     Unter der Bereichsleiste reichte der Platz rechnerisch — der Text dieses
     Schritts macht die Blase aber höher, und ihr „Weiter"-Knopf lag außerhalb
     des Bildes. Die Führung war an dieser Stelle **nicht mehr bedienbar**, und
     zwar am Rechner, nicht in irgendeinem Sonderfall. Jetzt wird die Höhe
     gemessen (`useLayoutEffect`) und die Blase notfalls dorthin gesetzt, wo sie
     ganz sichtbar ist. Eine Zahl, die von der Textlänge abhängt, gehört nicht
     in den Quelltext.
187. **Der erste Satz war für den professionellen Verwalter falsch.** „Sie
     verwalten Ihre Gemeinschaft ab jetzt selbst" — gilt für die
     Selbstverwaltung, für niemanden sonst. Ein Programm, das im ersten Satz
     danebenliegt, verspielt das Zutrauen genau dort, wo es am meisten zählt.
     Jetzt gibt es zwei Begrüßungen (`nurVerwaltung` als Gegenstück zu
     `nurSelbstverwaltung`); ein Test hält fest, dass jeder Nutzer **genau
     eine** davon sieht.
188. **`querySelector` traf die falsche Bereichsleiste.** Sie steht zweimal im
     Seitenbaum: einmal für den Rechner (`hidden md:block`), einmal im Schubfach
     fürs Handy. Auf dem Handy fand die Führung zuerst die ausgeblendete Fassung
     mit Breite 0, hielt das für „vorhanden, aber unsichtbar" und zeigte die
     zentrierte Karte. Jetzt wird das erste Ziel genommen, das wirklich Fläche
     hat — und damit **zieht die Führung das Schubfach mobil selbst auf** (und
     danach wieder zu, aber erst, wenn der nächste Schritt es nicht auch
     braucht — sonst flackert es).
189. **„Was ansteht" steht im Futur.** Der Fahrplan erscheint erst, wenn die
     Einrichtung fertig ist — also genau dann *nicht*, wenn diese Führung läuft.
     Der alte Text behauptete, die Liste stünde schon da, und schickte einen
     Anfänger auf die Suche nach etwas, das es noch gar nicht geben kann.
190. **Der Schlusshinweis gehört in die Mechanik, nicht in einen Schritt.** Der
     letzte Schritt ist je nach Kontotyp und Assistent ein anderer; ein achter
     Schritt nur für „Sie finden das wieder" hätte die Grenze aus dem Plan
     gesprengt. Jetzt steht der Satz unter der Blase des jeweils letzten
     Schritts — immer und genau einmal. Ein Test hält beide Hälften zusammen.
191. **Kein gemerkter Fortschritt — und das mit Absicht.** Der Plan sah
     `User.tourState` vor. Die Führung wechselt die Seiten aber selbst
     (Soft-Navigation), ein Neuladen mitten in der einen Minute kommt praktisch
     nicht vor. Ein Ablegen im Browser scheiterte zudem an der Hydration: Der
     Server kennt den Stand nicht und zeigte „Schritt 1", der Browser gleich
     darauf „Schritt 4". Was zählt, steht ohnehin serverseitig — `tourDoneAt`.
192. **Fachsprache ist jetzt testbar verboten.** Kein „Sollstellung", kein
     „Abrechnungsspitze", kein „§" in einem Tour-Text. Prinzip 1 des Plans sagt,
     dass Fachbegriffe nicht umbenannt werden — aber die Führung ist das eine,
     was jemand *vor* allem anderen liest. Erklärt wird an der Stelle, an der es
     gebraucht wird (Glossar, LP3).

Geprüft an echten Daten in vier Kombinationen (Desktop 1280 px / Handy 390 px
× Selbstverwaltung / professionelle Verwaltung): Alle Schritte sind
durchklickbar — was der Prüflauf mitbeweist, denn Playwright klickt nichts an,
was außerhalb des Bildes liegt —, jeder Lichtkegel sitzt auf seinem Ziel oder
fällt bewusst auf die zentrierte Karte zurück, und am Ende bleibt kein
Schubfach offen stehen.

## Schritt 36 — Die Führung kennt jetzt die Rolle (28.07.2026)

Aus einer Rückfrage entstanden: „Bekommen die anderen Eigentümer beim ersten
Login auch eine Ersteinführung?" Sie bekamen sie — nur die falsche.

193. **Max Mieter las „Sie verwalten Ihre Gemeinschaft ab jetzt selbst."** Die
     Führung filterte nach Kontotyp der Organisation, nicht nach der Rolle des
     Angemeldeten. In einer selbstverwalteten WEG gibt es aber **einen**
     verwaltenden Eigentümer und daneben alle übrigen Eigentümer und Mieter.
     Die drei bekamen dieselben sechs Schritte — davon drei als leere Karten,
     weil `/verwaltung/weg` nur in den Verwalter-Menüs steht und die
     Einrichtungs-Karte nur für den verwaltenden Eigentümer rendert. Falscher
     erster Satz plus drei Fehlanzeigen: der schlechtestmögliche erste Eindruck,
     und ausgerechnet für die Gruppe, die das Programm am wenigsten kennt.
194. **Schritte tragen jetzt `rollen`.** Eigentümer bekommen eine eigene
     Begrüßung und Schritte zu Stimme, Geld und Unterlagen; Mieter eine zu
     Schadensmeldung und Unterlagen. Handwerker bekommen gar keine — sie haben
     kein Portalkonto.
195. **Der Bereichsleisten-Text stimmte für drei von vier Zielgruppen nicht.**
     Er zählte die Gruppen auf („Alltag, Stammdaten, WEG, Betrieb"). So heißen
     sie nur beim professionellen Verwalter; die Selbstverwaltung hat andere,
     und Eigentümer und Mieter haben überhaupt keine Gruppen, sondern eine
     flache Liste. Jetzt ohne Aufzählung.
196. **Zwei Tests, die genau das künftig fangen.** Der eine prüft jeden Schritt
     gegen die Navigation **seiner Rolle** in `app-nav.ts` — zeigt er auf einen
     Menüpunkt, muss dieser dort stehen. Der andere verbietet, einen Menü- oder
     Gruppennamen im Text zu zitieren: Dieselbe Stelle heißt je nach Rolle und
     Kontotyp anders. Beide laufen über **alle zwölf** Kombinationen aus Rolle,
     Kontotyp und Assistent; der erste wurde mit einer absichtlich falschen
     Zuordnung gegengeprüft und schlug fehl.

Schrittzahlen danach: verwaltender Eigentümer 6 (7 mit Assistent),
professioneller Verwalter 3 (4), Eigentümer 6, Mieter 5. An echten Daten mit
allen vier Konten durchgeklickt — jeder Schritt trifft ein Ziel, das es in
diesem Menü wirklich gibt.

## Schritt 37 — Bauabzugsteuer § 48 EStG (28.07.2026)

Vorgezogen aus „Block 4 — später" des Finanzplans. Begründung: Es ist der
einzige offene Punkt, bei dem Nichtwissen unmittelbar Geld kostet. Bleibt der
Steuerabzug zu Unrecht aus, haftet der Leistungsempfänger für den nicht
abgeführten Betrag (§ 48a Abs. 3 EStG) — bei einer selbstverwalteten WEG also
die Gemeinschaft und damit alle Eigentümer. Ein Eigentümer, der nebenbei
verwaltet, weiß davon nichts. Die Falle ist unauffällig: Drei Rechnungen à
1.800 € sind einzeln harmlos und zusammen über der Grenze.

197. **Der Zahlungspartner war Freitext — das war die eigentliche Lücke.** Die
     Buchhaltung ist strukturiert (Konto, Kostenart, Einheit); nur *wer* bezahlt
     wurde, stand als getippter Name da. Die 5.000-€-Grenze gilt aber **je
     Leistendem und Kalenderjahr**, und über Text lässt sich nicht summieren:
     „Meier GmbH", „Meier Gmbh" und „Fa. Meier" wären drei Handwerker. Deshalb
     `Booking.craftsmanId` als Verknüpfung. `counterparty` bleibt daneben — der
     Bankimport liefert nun einmal Text, und die meisten Zahlungen gehen an
     niemanden aus dem Adressbuch.
198. **Kalenderjahr, nicht Wirtschaftsjahr.** § 48 Abs. 2 EStG stellt auf das
     laufende Kalenderjahr ab; eine WEG darf ein abweichendes Wirtschaftsjahr
     haben (`fiscalYearStartMonth`). Wer hier das Wirtschaftsjahr nähme, käme
     bei jeder solchen WEG auf eine falsche Summe.
199. **Die zweite Grenze von 15.000 € ist NICHT eingebaut** — eine bewusste
     Auslassung, keine Vergesslichkeit. § 48 Abs. 2 Satz 1 Nr. 1 EStG knüpft sie
     an ausschließlich steuerfreie Vermietungsumsätze nach § 4 Nr. 12 UStG. Die
     Leistungen einer WEG an ihre Eigentümer sind nach § 4 Nr. **13** UStG
     steuerfrei — eine andere Nummer. Ob die höhere Grenze greift, ist eine
     Frage an den Steuerberater, nicht aus dem Wortlaut zu beantworten. Bis das
     geklärt ist, gilt die niedrigere: Wer zu früh warnt, verursacht eine
     Rückfrage; wer zu spät warnt, verursacht eine Haftung. Die Zahl steht an
     genau einer Stelle (`BAGATELLGRENZE_CENTS`).
200. **„Bauleistung" als Kennzeichen an der Kostenart.** § 48 gilt nur für
     Herstellung, Instandsetzung, Instandhaltung, Änderung und Beseitigung von
     Bauwerken. Gartenpflege, Treppenhausreinigung und Winterdienst sind keine
     Bauleistungen. Ohne diese Unterscheidung warnte das Programm bei jeder
     Reinigungsrechnung und wäre nach dem dritten Fehlalarm wertlos.
201. **Die Warnung steht vor der Zahlung, nicht danach** — und rechnet ohne
     Serveranfrage, weil Jahressummen und Bauleistungs-Kennzeichen ohnehin auf
     der Seite stehen.
202. **Sie sperrt nicht, sie verlangt eine Entscheidung.** Ob einbehalten wurde,
     weiß nur der Mensch davor — vielleicht wurde längst gekürzt überwiesen. Das
     bewusste Häkchen wandert samt Betrag ins Audit-Log: Bei einer späteren
     Haftungsfrage ist genau das die Frage — wusste es jemand, und wann?
     Serverseitig läuft dieselbe Prüfung noch einmal; ein Häkchen im Browser ist
     keine Zusicherung.
203. **Drei Orte, drei Tonlagen — weil drei verschiedene Dinge noch möglich
     sind.** Beim manuellen Buchen: warnen, Einbehalt ist noch möglich. Beim
     nachträglichen Zuordnen importierter Buchungen: nur informieren, das Geld
     ist überwiesen. In der Kontaktliste: vorwarnen ab 4.000 €, damit die
     Bescheinigung **vor** dem nächsten Auftrag angefordert wird.
204. **Freistellungsbescheinigung: zwei Felder und eine Datei, kein Häkchen.**
     Ein Kreuz „hat eine" könnte das Programm nie widerrufen — Bescheinigungen
     laufen ab, und das ist der häufige Fall. Das Datum macht die Prüfung
     selbsttätig, und „abgelaufen" wird von „gab es noch nie" unterschieden,
     weil die Abhilfe eine andere ist. Alle drei Angaben sind **freiwillig**.
205. **Ein Upload darf kein Feld löschen.** Die Dateifelder werden nur
     überschrieben, wenn wirklich eine neue Datei kam — sonst hätte das Ändern
     der Telefonnummer die hinterlegte Bescheinigung mitgelöscht.

**Was die Prüfläufe gefunden haben** (alles behoben): ein Codeblock war in die
**falsche Funktion** gerutscht (`createBooking` statt `assignCostType`); der
Fehlerfall beim Datei-Upload wäre **stumm** geblieben, weil die Kontakt-
Detailseite kein Fehlerbanner hatte; der Link auf die hinterlegte Datei wurde
vom Rahmen **abgeschnitten**; und **„5.400,00 € €"** — `formatCents` bringt das
Währungszeichen selbst mit.

Geprüft an echten Daten: drei Rechnungen à 1.800 €, mit und ohne Bescheinigung,
mit abgelaufener, gegen eine Nicht-Bauleistung über 9.000 €, und nach Storno
einer der drei. Dazu der Import-Weg im Browser.

## Schritt 38 — Verzugszinsen § 288 BGB (29.07.2026)

Vorgezogen, weil die Lücke **im schon gebauten Code** stand: Die Tilgungs-
reihenfolge nach § 367 BGB (Kosten → Zinsen → Hauptforderung) war seit KP9
sauber eingebaut und bekam in `opos-service.ts` immer Nullen geliefert
(`kostenCents: 0, zinsenCents: 0`). Das ist die unangenehmste Sorte Lücke — sie
sieht im Code vollständig aus. Für eine WEG ist sie existenziell: Ein säumiger
Eigentümer bedeutet, dass die übrigen seine Lücke vorstrecken.

206. **Der Basiszinssatz ist Daten, keine Tabelle im Quelltext.** Er wechselt
     halbjährlich zum 1.1. und 1.7. (§ 247 Abs. 2 BGB). Ein einprogrammierter
     Wert ist ab dem nächsten Halbjahr falsch, niemand merkt es, und die
     veraltete Zahl steht in einer Mahnung, die nach außen geht. **Bewusst ohne
     Vorbelegung ausgeliefert:** Werte, die ich nicht belegen kann, wären in
     einem Schreiben, das der Empfänger nachrechnet, schlimmer als gar keine.
207. **Fehlt ein Satz, wird nicht gerechnet.** Kein Fortschreiben des letzten
     bekannten Werts. Die Oberfläche schreibt „nicht berechenbar" statt
     „0,00 €" und nennt den Weg zur Pflege. Eine Null, die in Wahrheit eine
     Lücke ist, ist die gefährlichste Zahl auf der Seite. Ein Test hält das fest.
208. **Fünf Punkte über Basiszinssatz, nicht neun.** § 288 Abs. 2 BGB gilt nur
     ohne Verbraucherbeteiligung; der Wohnungseigentümer ist regelmäßig
     Verbraucher. Eine Mahnung mit überhöhter Zinsforderung ist angreifbar.
209. **Verzug ab dem Tag nach Fälligkeit, ohne Mahnung.** Hausgeld aus einem
     beschlossenen Wirtschaftsplan ist kalendermäßig bestimmt (§ 286 Abs. 2
     Nr. 1 BGB). Der Fälligkeitstag selbst zählt nicht mit (§ 187 Abs. 1).
210. **Taggenau und je Zinsperiode getrennt**, mit 365 bzw. 366 Tagen. Über den
     ganzen Zeitraum mit einem Durchschnittssatz zu rechnen wäre einfacher und
     falsch. Gerundet wird erst am Ende.
211. **Zinsen nur auf fällige Forderungen**, und je Forderung ab ihrer eigenen
     Fälligkeit. Eine Sollstellung für den nächsten Monat ist nicht rückständig.
212. **Keine 40-€-Pauschale.** § 288 Abs. 5 BGB gilt nur zwischen Unternehmern.
213. **Ein Fehler in meiner eigenen Zeile, sofort korrigiert.** Die Mahnkosten
     hängen an der ältesten offenen Forderung. Ohne die Fälligkeit in der
     Bedingung wären sie in dem Fall, dass alle vergangenen Forderungen bezahlt
     sind, lautlos aus der gefilterten Liste gefallen.
214. **Der Glossar-Test aus LP3 hat mich abgefangen**: Meine erste Erklärung zu
     „Verzugszinsen" war zu lang. Die Regel gilt auch für den, der sie
     aufgestellt hat.

Gegengerechnet an echten Daten, Zeile für Zeile:

```
2026-03-01: 51,99 € x 7,5 % x 150 d = 1,60 €
2026-04-01: 52,00 € x 7,5 % x 119 d = 1,27 €
2026-05-01: 52,00 € x 7,5 % x  89 d = 0,95 €
2026-06-01: 52,00 € x 7,5 % x  58 d = 0,62 €
2026-07-01: 52,00 € x 7,5 % x  28 d = 0,30 €
                                SUMME 4,74 €
```

Dieselben 4,74 € stehen in der Rückstandsliste; ohne hinterlegten Satz stand
dort in jeder Zeile „nicht berechenbar".

## Schritt 39 — Mahnwesen vollständig (29.07.2026)

Zinsen und Kosten stehen jetzt auch **im Schreiben**, nicht nur in der Liste.

215. **Festgeschrieben beim Erstellen**, nicht bei jeder Anzeige neu gerechnet.
     Ist das Schreiben raus, muss nachvollziehbar bleiben, was darin stand. Eine
     Mahnung, deren Beträge sich später von selbst ändern, ist als Nachweis
     wertlos. `interestCents` bleibt `null`, wenn kein Basiszinssatz vorlag.
216. **Die erste Stufe bleibt kostenfrei.** Vor der ersten Mahnung wusste der
     Schuldner nicht, dass Kosten entstehen; erst ab der zweiten sind sie ein
     ersatzfähiger Verzugsschaden.
217. **Das PDF schlüsselt auf, statt eine Summe zu nennen.** Eine Mahnung, die
     nur einen Endbetrag zeigt, gibt dem Empfänger nichts, was er prüfen kann.
     Bei einer Zahlungserinnerung ohne Zinsen und Kosten bleibt es beim
     bisherigen einzeiligen „Offener Betrag".
218. **Das Mahnkosten-Feld zeigte „2,50 €" statt „2,50".** `formatCents` hängt
     ein geschütztes Leerzeichen und das Währungszeichen an; das Label sagt
     ohnehin „(€)". Gefunden im Prüflauf, nicht beim Lesen.
219. **Drei DECISIONS-Einträge waren zwischenzeitlich verloren.** Die Schritte
     37 bis 39 wurden mit `cat >> portal/DECISIONS.md` in Befehlsketten
     angehängt, die vorher an einem Verzeichniswechsel abbrachen — der Commit
     danach enthielt nur den Code. Ich hatte den Eintrag jeweils schon als
     erledigt gemeldet. Nachgetragen; künftig wird das Anhängen nicht mit
     anderen Befehlen verkettet.

Am fertigen PDF gegengeprüft (Text aus dem Dokument selbst gezogen, nicht aus
der Oberfläche):

```
Hausgeld-Rückstand                259,99 €
Verzugszinsen (§ 288 Abs. 1 BGB)    4,74 €
Mahnkosten                          2,50 €
Gesamtforderung:                  267,23 €
```

Datenseitig bestätigt: Stufe 1 mit `feeCents = 0`, Stufen 2 und 3 mit 2,50 €.
Der zum Prüfen eingetragene Basiszinssatz, die Testmahnungen und die Mahnkosten
wurden danach wieder entfernt — erfundene Zahlen bleiben nicht in der Datenbank
stehen.

## Schritt 40 — Eigentümer-Kontoauszug (29.07.2026)

Die Gegenseite der Mahnung. Der Verwalter sieht Rückstände, Zinsen und
Mahnstufen; der Eigentümer sah bisher zwei Summen — „Soll" und „Gezahlt". Wer
bei einer Differenz wissen wollte, *woran* es liegt (welcher Monat offen ist, ob
die Überweisung vom März angekommen ist), konnte das nicht nachvollziehen. Was
gemahnt wird, muss der Gemahnte prüfen können; sonst bleibt ihm nur, dem
Programm zu glauben.

220. **Bewegungen statt Salden.** Der Auszug führt jede Sollstellung als
     Belastung und jede **angerechnete** Zahlung als Gutschrift, in ihrer
     Entstehungsreihenfolge. Bewusst über die Zuordnungen und nicht als
     Differenz zweier Summen — genau diese Differenzrechnung war der Fehler, den
     KP9 beseitigt hat: Eine Vorauszahlung konnte einen offenen Monat verdecken.
     Ein Test hält den Fall fest.
221. **Am selben Tag steht die Belastung vor der Gutschrift.** Sonst sähe der
     Saldo zwischendurch nach einem Guthaben aus, das es nie gab.
222. **Künftige Monate zählen nicht zum Stand von heute.** Im ersten Prüflauf
     stand für eine Einheit mit 1.574,93 € Rückstand „3.599,80 € offen": Zwölf
     noch nicht fällige Monate waren mitgezählt. Ein Programm, das jemandem das
     Doppelte seiner Schuld nennt, verliert sein Vertrauen an dieser Stelle
     endgültig. Die kommenden Monate bleiben sichtbar — wer wissen will, was auf
     ihn zukommt, findet es hier —, aber grau und mit „noch nicht fällig", und
     `saldoHeute()` nimmt die letzte nicht-künftige Zeile.
223. **Zinsen stehen getrennt, nicht im Saldo.** Sie sind eine eigene Forderung
     neben der Hauptforderung (§ 367 Abs. 1 BGB); sie in die Spalte „Saldo" zu
     mischen machte diese mehrdeutig. Fehlt der Basiszinssatz, sagt die Seite
     genau das — statt „0,00 €".
224. **Nicht zugeordnete Zahlungen als eigener Hinweis.** Sie erscheinen nicht
     in der Tabelle (sie gehören noch zu keiner Forderung), aber der Eigentümer
     erfährt, dass sein Geld angekommen ist und was als Nächstes passiert.
225. **Die Zugriffsprüfung ist der wichtigste Teil der Seite.** Die Einheiten-ID
     steht offen in der URL. Geprüft wird serverseitig gegen die
     Eigentümerschaft (`ownedUnitIdsInProperty`); ein Verwalter zusätzlich gegen
     sein Objekt, nie gegen die Rolle allein. Bei fehlender Berechtigung
     `notFound()` — wer keinen Zugriff hat, soll nicht einmal erfahren, dass es
     die Einheit gibt.

**Gegenprobe im Browser, mit vier Konten.** Erika (Eigentümerin) sieht ihre
Einheit, nicht die eines fremden Objekts; Klaus sieht seine, nicht Erikas; der
Mieter sieht keine; der Verwalter sieht alle seines Objekts. Der ausgelieferte
HTML-Text der gesperrten Seite enthält **keine** Spur der fremden Daten — weder
Einheitenbezeichnung noch Beträge noch Objektname; geprüft wurde der Rohtext,
nicht nur das Bild.

Zur Statuszeile: Next liefert bei gestreamten Seiten HTTP 200 aus, auch wenn
`notFound()` später greift — die Kopfzeilen sind da schon raus. Die Sperre wirkt
trotzdem; der Inhalt ist die 404-Seite. Ein Prüfskript, das nur den Statuscode
liest, hielte das fälschlich für einen Treffer. Deshalb wird der **Inhalt**
geprüft, und `kontoauszug-zugriff.test.ts` hält die Regel im Quelltext fest,
damit sie nicht bei einem Umbau still verschwindet.

## Schritt 41 — Die Prüfung hängt nicht mehr an GitHub Actions (29.07.2026)

**Befund.** Ab dem 29.07.2026, 06:58 Uhr, wurde auf diesem Repository auf
**keinem** Branch mehr ein Workflow gestartet — nicht fehlgeschlagen, sondern
gar nicht ausgelöst. Der letzte Lauf über alle Branches:

```
06:58  claude/pdf-generation-analysis-229u0r   success
06:51  claude/pdf-generation-analysis-229u0r   success
06:35  claude/weg-accounting-review-dch465     success   ← PR #51
(danach nichts mehr, auf keinem Branch)
```

PR #53 bekam deshalb keine `pruefung`. Schließen und Wiederöffnen löste nichts
aus. Das Workflow selbst steht auf `active`, die Datei ist unverändert, der
Auslöser (`pull_request`) stimmt — die Ursache liegt also außerhalb des
Quelltextes, auf Konto- oder Repository-Ebene (Actions-Kontingent oder
-Berechtigung). Daran kommt aus dieser Umgebung niemand heran.

226. **Rückfallebene statt Warten: dieselbe Prüfung läuft jetzt im
     Vercel-Build.** Vercel baute unverändert weiter — nur prüfte der Build
     nichts. Ein grüner Deploy sagte damit nichts über Typen, Linter oder Tests
     aus. `portal/vercel.json` ruft jetzt `npm run pruefung` **vor** Migration
     und Build auf. Damit ist jeder Pull Request wieder prüfbar, ganz ohne
     GitHub-Runner.
227. **Ein Skript, zwei Aufrufer.** `package.json` bekommt
     `"pruefung": "tsc --noEmit && eslint && vitest run"`; sowohl das
     GitHub-Workflow als auch Vercel rufen genau diesen Eintrag auf. Vorher
     standen die drei Befehle als eigene Schritte im Workflow — zwei Listen von
     Befehlen laufen früher oder später auseinander, und dann prüft die eine
     Seite etwas, das die andere nicht prüft.
228. **Was das kostet, und warum es richtig ist.** Ein Fehlschlag blockiert
     jetzt den Deploy — auch den in Produktion. Das ist die Absicht: Genau davor
     soll eine Prüfung schützen. Der Preis sind rund anderthalb Minuten je
     Deploy. Wer im Notfall daran vorbei muss, nimmt den Aufruf in
     `vercel.json` heraus; das ist eine Zeile und in der Datei vermerkt.
229. **Gegengeprüft, dass es wirklich abbricht** — eine Prüfung, die nie „nein"
     sagt, ist keine. Mit einem absichtlich eingebauten Typfehler bricht die
     Kette mit Exit 2 ab, mit einem absichtlich falschen Test mit Exit 1, im
     heilen Zustand mit 0. Danach die vollständige Vercel-Befehlskette
     (`pruefung && repair || true && migrate deploy && next build`) einmal
     genau so ausgeführt, wie Vercel sie aufruft: 337 Tests, 90 Migrationen,
     Build — Exit 0.

**Was Ihr Gegenüber am Konto prüfen müsste**, falls die Workflows dauerhaft
ausbleiben: GitHub → Settings → Billing (Actions-Minuten / Spending Limit) und
Settings → Actions → General (ob Actions für das Repository erlaubt sind). Für
den Betrieb ist das nun nicht mehr dringend — die Prüfung läuft ohnehin.

## Schritt 42 — Die drei gesetzlich geforderten Lücken (29.07.2026)

Drei Punkte, die das Gesetz verlangt und die das Programm bisher offen ließ.
Klein im Umfang, aber jeder davon der Unterschied zwischen „erfüllt" und
„nicht erfüllt".

230. **Der Vermögensbericht kannte nur die Haben-Seite** (§ 28 Abs. 4 WEG).
     Gezeigt wurden Rücklage, Kontostände und Hausgeldrückstände; darunter stand
     der Satz, Verbindlichkeiten würden „derzeit nicht erfasst". Ein Bericht
     über das Vermögen, der nur nennt, was hereinkommt, ist keiner — und er ist
     auf die gefährliche Weise falsch: Er sieht zu gut aus, und genau danach
     wird über Sonderumlagen entschieden. Neu ist ein Modell `Verbindlichkeit`
     je Objekt, eine Pflegeseite und die Gegenüberstellung Aktiva/Passiva mit
     **Reinvermögen**. Ist es negativ, sagt der Bericht das ausdrücklich.
231. **Verbindlichkeiten werden von Hand geführt, nicht abgeleitet.** Eine noch
     nicht bezahlte Rechnung ist gerade *keine* Buchung — sie liegt im Ordner.
     Ableiten ließe sich nur, was schon bezahlt wurde, und das ist keine
     Verbindlichkeit mehr.
232. **Drei Daten statt einem, und das ist der ganze Punkt.** `incurredOn`
     (entstanden), `dueDate` (fällig, freiwillig), `settledAt` (beglichen). Der
     Bericht blickt auf einen **Stichtag**: Eine Rechnung vom 3. November zählt
     zum 31.12., auch wenn sie erst im Februar bezahlt wird; eine vom Februar
     zählt nicht. Beglichene Einträge werden **nicht gelöscht**, sondern
     datiert — sonst änderte sich ein bereits beschlossener Bericht rückwirkend,
     sobald jemand eine alte Rechnung bezahlt.
233. **Der Bericht wird eingefroren, nicht nachgerechnet.** Er entsteht in
     `computeStatementView` und wandert damit bei FERTIG in den Snapshot. Läde
     die Seite die Verbindlichkeiten stattdessen live, hätte derselbe Fehler
     durch die Hintertür wieder Einzug gehalten. Ältere, vor dieser Erweiterung
     fertiggestellte Abrechnungen tragen den Bericht nicht im Snapshot; sie
     bekommen einen Hinweis statt einer nachträglich gerechneten Zahl.
234. **Bauabzugsteuer: die zweite Hälfte der Pflicht** (§ 48a Abs. 1 EStG).
     Bisher warnte das Programm *vor* der Zahlung — richtig, aber halb. Wer
     einbehält, muss bis zum **10. Tag des Folgemonats** anmelden und abführen.
     Diese Frist verstreicht lautlos: Das Geld liegt auf dem Gemeinschaftskonto,
     sieht nach Guthaben aus und ist keines, und die Haftung besteht fort.
235. **Aus einem Häkchen wurde eine Frage.** Vorher: „Ich habe das
     berücksichtigt" — das hielt nur fest, *dass* gewarnt wurde. Jetzt zwei
     Antworten: einbehalten oder ungekürzt gezahlt. Nur die erste erzeugt eine
     Frist, und nur weil das Programm den Unterschied kennt, kann es erinnern.
     Beides landet zusätzlich im Audit-Log — bei einer Haftungsfrage ist genau
     das die Frage.
236. **§ 108 Abs. 3 AO ist mitgerechnet**, samt beweglicher Feiertage. Fällt der
     10. auf Samstag, Sonntag oder Feiertag, endet die Frist am nächsten
     Werktag. Dafür braucht es den Ostersonntag (Karfreitag, Ostermontag und
     Christi Himmelfahrt können auf einen Zehnten fallen). **Landesfeiertage
     bewusst nicht**: § 108 Abs. 3 AO stellt auf den Ort des Finanzamts ab, und
     Fronleichnam gilt nicht überall. Wer sie einträgt, trifft für die Hälfte
     der Nutzer eine falsche Aussage; das Weglassen nennt höchstens einen Tag zu
     früh — nie einen zu spät.
237. **Abgehakt wird je Monat, nicht je Buchung.** Abgegeben wird eine Anmeldung
     für den Monat. Ließen sich einzelne Buchungen abhaken, gäbe es irgendwann
     einen halb angemeldeten Monat — und keine Möglichkeit zu sagen, welche
     Hälfte. Die Meldung sagt außerdem ausdrücklich, dass der Haken ein Vermerk
     ist und keine Abgabe.
238. **Belegeinsicht: das meiste war schon da, die Lücke lag woanders.** Der
     geplante Punkt „Belegeinsicht für den Beirat" war zu zwei Dritteln bereits
     gebaut — Eigentümer sehen die Buchhaltung ihrer WEG samt Belegen, und der
     Prüfvermerk des Beirats ließ sich setzen. Zwei echte Lücken blieben:
239. **Stornierte Buchungen standen ungekennzeichnet in der Belegeinsicht.**
     Herausgefiltert werden dürfen sie nicht — § 18 Abs. 4 WEG umfasst den
     vollständigen Bestand, und eine Buchhaltung, aus der etwas verschwindet,
     ist keine. Ungekennzeichnet zählt der Eigentümer die Ausgabe aber zweimal:
     einmal das Original, einmal die Gegenbuchung. Jetzt tragen beide ein
     Etikett und einen durchgestrichenen Betrag.
240. **Der Beirat wusste nicht, dass etwas auf ihn wartet.** Der Prüfvermerk
     ließ sich setzen — aber nur, wenn man ihn auf der Finanzen-Seite zufällig
     fand. Der Beiratsbereich listet jetzt, was zu prüfen ist, mit dem Stand des
     Vermerks und einem Link in die Belege **des betreffenden Jahres**: Wer die
     Abrechnung 2025 prüft, will die Buchungen von 2025 sehen und nicht erst
     einen Filter suchen.

**Unterwegs gefunden — und das war der wichtigste Fund des Tages.**

241. **Jede Seite antwortete mit HTTP 500, solange die Tour lief.** In der
     Sprechblase stand `window.innerWidth`, und zwar in dem Zweig, der greift,
     solange kein Ziel gemessen ist — also genau im Serverfall. Ergebnis:
     `ReferenceError: window is not defined`, und der Server antwortete mit 500.
     Im Browser sah man davon **nichts**: React reicht den Client-Teil nach, die
     Seite baut sich auf, alles wirkt heil. Aufgefallen ist es erst, weil der
     Prüfdurchgang die Antwortcodes mitliest und nicht nur den sichtbaren Text.
     Gegengeprüft an vier bestehenden Seiten (`/dashboard`, `/verwaltung/objekte`,
     `/vorgaenge`, `/verwaltung/weg`) — alle vier betroffen, alle vier jetzt 200.
     Das stand seit LP6 in Produktion.
242. **Behoben per CSS, nicht per Messung**: `min(Xpx, calc(100vw - 24px))`. Das
     rechnet der Browser selbst, bei jeder Größenänderung, ganz ohne erneutes
     Rendern — und es gibt nichts mehr, was auf dem Server fehlen könnte.
243. **Ein Test, der ohne `window` rendert.** `tour.ssr.test.tsx` ruft
     `renderToString` in der Node-Umgebung der Testsuite auf — dieselbe Lage wie
     im Produktionsserver. Bewusst **kein** jsdom: Ein Test, der `window`
     bekommt, hätte diesen Fehler nie gefunden. Und bewusst kein Verbot des
     Wortes `window` im Quelltext — in Effekten ist es völlig richtig. Geprüft
     wird, ob das Rendern gelingt. Gegengeprüft, dass er greift: mit
     zurückgedrehter Korrektur schlägt er mit genau diesem `ReferenceError` fehl.
     Dafür nimmt `vitest.config.ts` jetzt auch `.test.tsx` an.

**Zwei Fehler, die erst der Blick auf die fertige Seite zeigte** — beide wären
durch Typprüfung, Linter und Tests unbemerkt durchgegangen:

244. **Datumsangaben trugen die Uhrzeit**: „01.06.2025, 00:00". `formatDate`
     statt `formatDateOnly` — in einer Liste von Rechnungsdaten ist die Uhrzeit
     Lärm, und „00:00" sieht nach fehlender Angabe aus.
245. **Die erledigten Verbindlichkeiten standen oben.** `orderBy settledAt asc`
     sortiert NULL in PostgreSQL ans **Ende** — offene Posten haben aber
     `settledAt = null`. Also stand ganz oben, was schon erledigt war, und
     unten, was noch zu tun ist. Behoben mit `nulls: "first"`.

**Geprüft.** 398 Tests (27 neue), ESLint, `tsc`, Produktions-Build. Datenbank von
null: 94 Migrationen, Seed, dann 16 Gegenproben an echten Daten — unter anderem,
dass von fünf Verbindlichkeiten genau drei zum Stichtag zählen, dass der Bericht
die JSON-Runde des Snapshots übersteht, dass die Frist für eine Zahlung im
September 2026 auf Montag, den 12.10., rutscht (der 10. ist ein Samstag) und dass
eine stornierte Zahlung keine Anmeldepflicht erzeugt. Danach der Durchgang im
Browser mit Verwalter- und Eigentümerkonto: keine Fehler, kein 500er.

## Schritt 43 — Journal und Kontoblatt als CSV (29.07.2026)

Die beiden Auszüge, nach denen jeder fragt, der die Buchhaltung von außen
ansieht: der Verwaltungsbeirat bei der Rechnungsprüfung, der Steuerberater, der
Nachfolger nach einem Verwalterwechsel. Bisher gab es die Zahlen nur in der
Oberfläche — und aus einer Oberfläche kann niemand nachrechnen.

246. **Zwei Auszüge, zwei Fragen.** Das **Journal** ist die zeitliche Liste
     aller Buchungen und beantwortet „was ist passiert". Das **Kontoblatt**
     zeigt ein einzelnes Konto mit fortlaufendem Saldo von Anfangs- bis
     Endbestand und beantwortet „stimmt der Kontostand". Nur das zweite lässt
     sich gegen den Bankauszug halten, deshalb sind es zwei Dateien und nicht
     eine mit Filter.
247. **Stornos bleiben drin und werden beschriftet.** Sie heben sich im Saldo
     von selbst auf, weil die Gegenbuchung die umgekehrte Richtung trägt — es
     muss also nichts herausgerechnet werden, nur gekennzeichnet. Eine
     Buchhaltung, aus der etwas spurlos verschwindet, ist als Nachweis wertlos.
     (In der Kostenverteilung ist das umgekehrt; dort greift `NOT_REVERSED`,
     und der Kommentar dort sagt seit KP2 schon, dass das Journal alles zeigt.)
248. **Die Vorzeichenregel steht jetzt an genau einer Stelle.** Sie stand
     gleichlautend in `statement-service.ts` und wäre im Kontoblatt ein zweites
     Mal entstanden. Zwei Kopien laufen auseinander, sobald eine vierte
     Buchungsart dazukommt — und dann nennen Kontoblatt und Jahresabrechnung
     verschiedene Endbestände, ohne dass jemand sagen kann, welcher stimmt.
     `vorzeichenBetrag` in `journal.ts` ist der einzige Ort; `signedSum` ruft ihn.
249. **Gegengeprüft, dass beide Wege dasselbe sagen** — das war der eigentliche
     Prüfpunkt: Kontoblatt „Girokonto WEG" endet auf 4.176,48 €,
     „Erhaltungsrücklage" auf 19.250,00 €, und exakt diese beiden Zahlen nennt
     `computeStatementView` als `endCents`. Wären sie verschieden, wäre einer
     der beiden Auszüge falsch.
250. **Zwei Spalten statt einer vorzeichenbehafteten.** Einnahme und Ausgabe
     stehen getrennt, jeweils als positive Zahl. So lässt sich jede Richtung für
     sich summieren — und genau das ist der Handgriff beim Abgleich mit dem
     Kontoauszug.
251. **Beträge ohne Euro-Zeichen und ohne Tausenderpunkt.** Klingt nach einer
     Verschlechterung gegenüber der Oberfläche, ist aber der Punkt: Excel-DE
     erkennt „1234,56" als Zahl. „1.234,56 €" landet als **Text** in der Zelle,
     und dann summiert der Steuerberater eine Spalte, die sich nicht summieren
     lässt. Das Format ist damit bewusst ein anderes als überall sonst im
     Programm, und `csvBetrag` sagt im Kommentar warum.
252. **Stabil sortiert, nicht nach Anlagezeitpunkt.** Bei gleichem Buchungsdatum
     entscheidet die ID. Zwei Exporte desselben Zeitraums müssen dieselben
     Zwischensalden zeigen — sonst wirkt die Datei manipuliert, obwohl sich
     nichts geändert hat. Ein Test hält das fest.
253. **Anfangsbestand ist der des Zeitraums, nicht der des Kontos.**
     Eröffnungssaldo plus alles, was vor dem Wirtschaftsjahr gebucht wurde. Ohne
     diesen Vorlauf begänne jedes Kontoblatt wieder bei null und der Endbestand
     stimmte nur im ersten Jahr.
254. **Wirtschaftsjahr, nicht Kalenderjahr — und das steht auf der Seite.** Der
     Jahresfilter über der Buchungsliste meint das Kalenderjahr, die Abrechnung
     rechnet über das Wirtschaftsjahr. Bei abweichendem Jahresbeginn liefert der
     Export also einen **anderen** Zeitraum als die Liste darüber zeigt. Das ist
     richtig so — dagegen soll sich das Kontoblatt abgleichen lassen —, aber es
     darf nicht stillschweigend passieren: Die Karte nennt den konkreten
     Zeitraum, sobald er vom Kalenderjahr abweicht.
255. **Nur für den Verwalter.** Das Einsichtsrecht des Eigentümers nach § 18
     Abs. 4 WEG ist über die Belegeinsicht unter „Finanzen" abgedeckt. Ein
     Massen-Download der gesamten Buchhaltung als Datei ist etwas anderes als
     Einsicht. Im Browser gegengeprüft: Der Eigentümer bekommt 401, und die
     Antwort enthält **keine** Spur von Buchungsdaten.
256. **Der vorhandene CSV-Helfer wurde benutzt, nicht nachgebaut.**
     `lib/csv.ts` bringt Semikolon, CRLF, UTF-8-BOM und den Schutz gegen
     Formel-Injection schon mit (Excel führt Zellen aus, die mit `=`, `+`, `-`
     oder `@` beginnen). Am fertigen Download nachgemessen: erste drei Bytes
     `EF BB BF`, Umlaute sauber dekodierbar, alle Zeilen gleich breit.

**Zwei Fehlalarme aus dem eigenen Prüfskript**, beide festgehalten, weil sie
beim nächsten Mal wieder auftreten:

257. „BOM vorhanden: false" — `fetch().text()` **entfernt** das BOM beim
     Dekodieren. Wer es messen will, muss den `arrayBuffer` ansehen. Die Datei
     war die ganze Zeit richtig.
258. „Konten verlinkt: 0" — im HTML steht `&amp;` statt `&`. Die Suche im
     Quelltext muss beides zulassen.

## Schritt 44 — LP7: Der Assistent bekommt Geld, Begriffe und eine Grenze (29.07.2026)

Der letzte offene Punkt aus `PLAN-Laientauglichkeit.md`. **Zuerst nachgesehen,
was schon da ist** — und das war das Wichtigste an diesem Schritt: Der Assistent
existierte bereits, mit rechtegefiltertem Abruf über Beschlüsse, Aushänge,
Versammlungen, Anträge, Vorgänge und Dokumenttitel, mit Bedienhilfe,
Quellenangabe und Gemini-Anbindung. Ihn neu zu bauen wäre teuer und falsch
gewesen. Es fehlten genau die drei Punkte, die der Plan nennt.

259. **Er kannte kein Geld.** Auf „Wie viel haben wir auf dem Konto?" oder „Bin
     ich im Rückstand?" kam „Dazu finde ich in Ihren Unterlagen nichts" — die
     häufigsten Fragen eines selbstverwaltenden Eigentümers. Neu ist
     `assistant-finanzen.ts` mit Kontoständen, Rückständen, dem eigenen Stand
     und der Lage im Jahreslauf.
260. **Die Rechte-Grenze verläuft nicht entlang der Rolle, sondern entlang
     dessen, was der Fragende ohnehin sehen darf.** Kontostände und die
     **Summe** der Rückstände stehen im Vermögensbericht (§ 28 Abs. 4 WEG), den
     die Gemeinschaft bekommt — die darf also jeder Eigentümer erfahren.
     **Wer** säumig ist, steht in keinem Bericht, den alle bekommen, und bleibt
     der Verwaltung vorbehalten. Den eigenen Stand sieht der Eigentümer über
     seine Einheiten. Mieter und Handwerker bekommen gar nichts.
261. **Diese Grenze steht im Code, nicht im Prompt.** Ein Sprachmodell ist keine
     Zugriffskontrolle. Was `finanzQuellen` nicht herausgibt, kann es auch nicht
     ausplaudern — deshalb filtert die Funktion, und der Prompt bekommt nur, was
     ohnehin herausgehen darf.
262. **Gegengeprüft, dass der Test den Bruch findet.** Mit entferntem
     `istVerwalter`-Wächter schlägt `assistant-finanzen.test.ts` mit genau der
     Zeile fehl, um die es geht („expected … not to contain 'WE 02'").
263. **Und gegengeprüft, dass die Prüfung an echten Daten nicht gegenstandslos
     ist.** Der erste Lauf gegen die Datenbank meldete „keine fremde Einheit
     verraten" — er ging aus dem falschen Grund durch: Der Demo-Eigentümer
     besitzt **alle** sechs Einheiten, es gab schlicht nichts zu verraten. Erst
     mit `kaeufer@demo.de` (eine Einheit von sechs) war die Probe echt: fünf
     fremde Einheiten vorhanden, keine davon im Text, die eigene drin, die
     Gesamtsumme trotzdem sichtbar. Eine Prüfung, die nicht scheitern **kann**,
     ist keine.
264. **Das Glossar aus LP3 ist jetzt eine Quelle.** „Was ist eine
     Abrechnungsspitze?" war bis dahin unbeantwortbar. Bewusst dieselben Texte,
     die im Programm an den Begriffen hängen — eine zweite Sammlung daneben
     altert getrennt, und dann erklärt der Assistent etwas anderes als die Seite.
265. **Abgrenzung zur Rechtsberatung im Prompt.** Der Assistent erklärt Recht,
     er wendet es nicht an. Ohne diesen Satz klingt eine Auskunft zu einem
     Paragraphen wie eine Rechtsberatung — und wird dann auch so verstanden.
266. **Finanzquellen tragen das Datum „heute".** Die Kandidaten werden bei
     Gleichstand nach Aktualität sortiert. Fragt jemand nach dem Kontostand,
     ist die heutige Zahl die Antwort — nicht ein Beschluss von 2024, der
     zufällig dieselben Wörter enthält.
267. **Die Beispielfragen decken jetzt die drei Quellen ab** statt dreimal
     dieselbe. Sie sind die einzige Stelle, an der jemand erfährt, was der
     Assistent überhaupt kann.
268. **Punkt 1 des Plans bleibt bewusst offen.** „Speist sich aus `app-nav.ts`"
     — die Bedienhilfe deckt das inhaltlich ab. Aus `app-nav.ts` erzeugte
     Einträge wären Menütitel ohne Erklärung, und die Erklärung ist der Teil,
     der hilft.

**Was ich nicht prüfen konnte, und das ist ein echter Unterschied zu allem
anderen hier:** Die Antwort von Gemini selbst. In dieser Umgebung liegt kein
Schlüssel, und ausgehende Verbindungen sind ohnehin gesperrt. Geprüft ist die
gesamte Kette **bis** zum Modell — Abruf, Rechtefilter, Prompt-Aufbau — sowie
das Verhalten bei ungültigem Schlüssel: Der Assistent antwortet dann „momentan
nicht erreichbar", ohne Absturz und ohne 500er. Im Browser mit drei Rollen
gegengeprüft: Verwalter und Eigentümer sehen den Assistenten, der Mieter nicht.

**Zum Betrieb:** Der Assistent braucht **zwei** Umgebungsvariablen, nicht eine —
`GEMINI_API_KEY` **und** `AI_ASSISTANT_ENABLED="true"`. Fehlt eine davon,
erscheint er gar nicht erst. Das ist Absicht (Freitext geht an Google, das
gehört bewusst eingeschaltet), aber es ist auch die Stolperstelle: Ein
hinterlegter Schlüssel allein genügt nicht.

## Schritt 45 — Der Basiszinssatz kommt von der Quelle (30.07.2026)

Bis hierher musste der Basiszinssatz zweimal im Jahr von Hand eingetragen
werden, sonst rechnete das Programm keine Verzugszinsen. Der Abruf schließt das
— und die Frage, wie er es tut, ist wichtiger als dass er es tut.

269. **Von der Quelle, nicht aus einem Sprachmodell.** Die Anfrage lautete
     zunächst, ob „die KI" den Satz nicht selbst herausfinden könne. Nein — und
     zwar nicht aus technischen Gründen: Der Basiszinssatz nach § 247 BGB ist
     keine Wissensfrage, sondern eine amtlich veröffentlichte Zahl. Ein Modell
     würde sie *raten*, und ein geratener Zinssatz in einer Mahnung ist
     schlimmer als gar keiner, weil er richtig aussieht. Geholt wird deshalb die
     Zeitreihe der Bundesbank.
270. **Leitentscheidung: lieber nichts als etwas Falsches.** Jede Unsicherheit
     endet in „nicht übernommen" — Netzfehler, Statuscode, unlesbare Antwort,
     unplausibler Wert. Geschrieben wird nur, was drei Prüfungen besteht.
271. **Ein von Hand eingetragener Satz wird nie überschrieben.** Er ist die
     Entscheidung eines Menschen, der die Bekanntmachung gelesen hat. Ihn durch
     einen Abruf zu ersetzen hieße, diese Entscheidung stillschweigend zu
     verwerfen — und danach stünde die andere Zahl in einer Mahnung, ohne dass
     es jemand merkt. Der Abruf **ergänzt** nur, was fehlt.
272. **Das Datum ist der Formatwächter.** § 247 Abs. 2 BGB: Der Satz ändert sich
     zum 1.1. und 1.7. Ein Wert mit dem Datum 15. März ist damit kein
     Basiszinssatz, sondern ein Lesefehler — genau daran erkennt der Parser, dass
     er die falsche Spalte erwischt hat. Dazu die Plausibilitätsgrenze von ±25 %,
     dieselbe wie bei der Eingabe von Hand; sie fängt den verrutschten Faktor 100.
273. **Der Parser ist absichtlich formattolerant, weil ich das Format nicht
     prüfen konnte.** Die Bundesbank-Adresse war aus der Entwicklungsumgebung
     gesperrt (403 über die Sicherheitsrichtlinie), die Antwort ließ sich also
     nicht ansehen. Er sucht deshalb in *jeder* Zeile nach einem Datum-Wert-Paar
     und ignoriert alles andere. Ein Parser, der das Format genau kennen muss,
     wäre beim ersten Umbau der Seite still kaputt; dieser liefert dann schlicht
     nichts — und das ist der ungefährliche Fall, weil dann nichts geschrieben wird.
274. **Der Test fand einen Fehler, der eine falsche Mahnung verursacht hätte.**
     Erste Fassung behandelte `;` **und** `,` gleichzeitig als Spaltentrenner.
     Bei `2024-01-01;3,62` wurden daraus die Spalten „3" und „62" — gelesen
     wurden **3,00 %** statt 3,62 %. Plausibel, innerhalb aller Grenzen, und
     falsch. Jetzt wird das Trennzeichen je Zeile entschieden: Enthält die Zeile
     ein `;`, ist das der Trenner und `,` das Dezimalzeichen; sonst umgekehrt.
275. **Monatlich statt halbjährlich.** Der Lauf ist idempotent, also heilt ein
     monatlicher Versuch sich selbst — bei verzögerter Bekanntmachung, bei einem
     einmaligen Netzfehler, bei Wartung an genau dem einen Tag. Zwei Termine im
     Jahr hätten genau zwei Chancen.
276. **Der Cron antwortet auch bei misslungenem Abruf mit 200.** Der Job hat
     getan, was er konnte; die Bundesbank ist nicht Teil dieser Anwendung. Ein
     500er ließe Vercel einen Ausfall melden, obwohl nichts kaputt ist — und
     würde die echten Ausfälle im Rauschen untergehen lassen.
277. **Auslöser von Hand auf der Seite**, damit sich der Abruf sofort prüfen
     lässt, statt bis zum Zweiten des nächsten Monats zu warten. Das war der
     eigentliche Grund für den Knopf: Ich kann den Erfolgsfall hier nicht
     erzeugen, also muss ihn jemand anders auslösen können.
278. **Die Rückmeldung nennt Zahlen, nicht „hat geklappt".** Wie viele Sätze
     dazukamen, ist die eigentliche Auskunft — und „0 neu" heißt „alles war schon
     da", nicht „es ging schief". Deshalb zwei getrennte Meldungen mit
     unterschiedlichem Ton.
279. **Geprüft im neuen Datenbank-Harnisch** (`basiszins-abruf.dbtest.ts`, sieben
     Prüfungen). Das Netz wird ersetzt, die Datenbank nicht: Ob ein Handeintrag
     überlebt, lässt sich nur daran ablesen, was nach dem Lauf in der Tabelle
     steht. **Gegengeprüft, dass die Prüfung greift** — mit einem `upsert`
     anstelle des Ergänzens schlägt sie mit genau der richtigen Zeile fehl.
280. **Im Browser geprüft, was ich prüfen konnte.** Der Knopf löst aus, und der
     Fehlerfall sieht gut aus: „Die Bundesbank antwortete mit Status 403. Es
     wurde nichts übernommen — die hinterlegten Sätze sind unverändert." Kein
     Absturz, kein 500er, Tabelle unangetastet. Die drei Erfolgsmeldungen über
     ihre Parameter gegengeprüft, samt Singular/Plural.

**Was offen bleibt und von Ihnen geprüft werden muss:** der Erfolgsfall über das
echte Netz. Aus dieser Umgebung ist die Bundesbank nicht erreichbar; ob die
Antwort so aussieht, wie der Parser sie erwartet, zeigt erst der erste Klick auf
„Bei der Bundesbank abrufen" nach dem Deploy. Meldet die Seite dann
„Format geändert", ist der Parser anzupassen — geschrieben wird in diesem Fall
nichts, es entsteht also kein Schaden, nur Arbeit.
