# Fachprüfung: WEG-Recht und Buchhaltung

Stand: 26.07.2026 · Prüfgegenstand: `portal/` — WEG-Finanzblock
(`src/lib/weg/*`, `verwaltung/weg/[propertyId]/*`, `finanzen/*`, Prisma-Schema)

Kein Code geändert. Dies ist ein Prüfbericht.

**Hinweis:** technische Fachprüfung, keine Rechts- oder Steuerberatung. Die als
kritisch markierten Punkte (A1–A4, B1) sollten vor dem Produktivgang mit einem
Fachanwalt für WEG-Recht bzw. einem Steuerberater gegengeprüft werden.

---

## 0. Zu den beiden Skills

Beide Skills sind fachlich sauber und triggern an den richtigen Stellen. Zwei
Anmerkungen:

- **`weg-buchhaltungssoftware` empfiehlt doppelte Buchführung — die Software hat
  sich bewusst dagegen entschieden.** Das ist rechtlich in Ordnung (§ 28 Abs. 2
  WEG verlangt eine reine Einnahmen-/Ausgabenrechnung), und für eine
  selbstverwaltende WEG ist die Einfachheit ein Vorteil. Aber der Skill sollte
  diese Entscheidung kennen, sonst schlägt er bei jedem neuen Feature ein
  Modell vor, das nicht zum Bestand passt. Empfehlung: im Skill ergänzen
  „**In diesem Projekt gilt: Einnahmen-/Ausgabenrechnung, kein Debitorenkonto.
  Forderungen entstehen aus `DuePosting` − zugeordneten Zahlungen.**"
- **Der Skill fordert eine echte Zuordnungslogik (Matching) — die fehlt** (siehe
  B2). Der Skill hat hier also genau das Richtige verlangt und wurde bei der
  Umsetzung nicht befolgt.

Was in beiden Skills fehlt und die Prüfung gebraucht hätte: **HeizkostenV**
(50–70 %-Regel, § 12 Kürzungsrecht), **§ 35a EStG** (nur Lohnanteil, unbare
Zahlung), **Bauabzugsteuer § 48 EStG**, **Tilgungsreihenfolge §§ 366/367 BGB**,
und die **Fortgeltung des Wirtschaftsplans (§ 28 Abs. 1 Satz 2 WEG)**. Alle fünf
sind unten Fundstellen. Ich würde sie in `weg-recht` nachtragen.

---

## 1. Gesamteindruck

Das Fundament ist überdurchschnittlich gut. Konkret richtig gemacht und
ausdrücklich zu behalten:

- **Abrechnungsspitze gegen das SOLL, nicht gegen das Ist** (`computePeakAmounts`,
  Kommentar dort). Das ist der Punkt, an dem die meisten selbstgebauten
  Abrechnungen kippen — hier ist er korrekt.
- **Jahresabrechnung als reine Einnahmen-/Ausgabenrechnung**, kein
  Soll-Ist-Vergleich — entspricht § 28 Abs. 2 WEG n. F.
- **Vermögensbericht getrennt** ausgewiesen (§ 28 Abs. 4 WEG).
- **Erhaltungsrücklage als eigenes Konto** (`LedgerAccountKind.RUECKLAGE`).
- **Kontenprüfung vor dem Fertigstellen** (`finalizeStatement`: rechnerischer
  Endbestand muss dem Kontoauszug entsprechen). Genau die richtige Härte —
  das ist der häufigste Anfechtungsgrund, und die Software lässt ihn nicht durch.
- **Snapshot bei FERTIG**, Buchungen faktisch unveränderlich, Audit-Log
  durchgängig, Restcent-Verteilung centgenau und deterministisch.
- **Beiratsprüfvermerk (§ 29 Abs. 3 WEG)** ist vorgesehen — für die
  Selbstverwaltung genau richtig.
- Der Verzicht auf automatische Mahngebühren ist die rechtlich saubere
  Entscheidung und ist im UI auch so begründet.

Die Probleme darunter sind deshalb keine Anfängerfehler, sondern die klassischen
zweiten 20 % — aber vier davon machen die Abrechnung im Echtbetrieb unbrauchbar
oder anfechtbar.

---

## A. Kritisch — blockiert oder macht die Abrechnung angreifbar

### A1. CSV-importierte Buchungen können nie einer Kostenart zugeordnet werden → Jahresabrechnung ist nicht abschließbar

**Der schwerste Fund.** `Booking.costTypeId` wird ausschließlich bei der
manuellen Buchung gesetzt (`createBooking`). Es gibt **keine Action, die die
Kostenart einer bestehenden Buchung nachträglich setzt** — `booking.update`
kommt im gesamten Code genau einmal vor, und zwar in `assignPayment`, und ändert
dort nur `unitId`. Auf der Buchhaltungsseite ist `costTypeId` nur ein *Filter*.

Folge, Kette:

1. `importCsvAction` legt alle Buchungen mit `costTypeId: null` an.
2. In `computeStatementView` landen sie damit in `otherExpenseCents`.
3. `computeStatement` schreibt daraufhin zwingend einen Fehler in `errors`
   („Ausgaben ohne Kostenart …").
4. `finalizeStatement` bricht bei `view.errors.length > 0` ab.

**Ergebnis: Eine WEG, die den vorgesehenen Zero-Key-Weg geht (Kontoauszug als
CSV importieren), kann ihre Jahresabrechnung niemals fertigstellen.** Und die
importierten Kosten tauchen in keiner Kostenart-Zeile auf, werden also auch
nicht verteilt.

Das ist kein Randfall — der CSV-Import ist der Hauptarbeitsweg des ganzen Moduls.

*Nötig:* eine Zuordnungs-Action (Kostenart je Buchung nachtragen, idealerweise
als Massenzuordnung über die Buchungsliste, plus eine Merkregel „Verwendungszweck
enthält X → Kostenart Y", damit wiederkehrende Lastschriften nicht jedes Jahr
zwölfmal von Hand angefasst werden).

### A2. Ausgaben aus der Erhaltungsrücklage werden den Eigentümern ein zweites Mal in Rechnung gestellt

`computeStatementView` sammelt die Ist-Ausgaben je Kostenart über **alle** Konten
— das Rücklagenkonto eingeschlossen. Eine Dachsanierung, die aus der Rücklage
bezahlt wird, wird also als normale Kostenposition auf die Einheiten verteilt und
erhöht die Abrechnungsspitze.

Bezahlt wurde sie aber aus Geld, das die Eigentümer über die
Rücklagenzuführung früherer Jahre bereits aufgebracht haben. Es fehlt die
Gegenposition **„Entnahme aus der Erhaltungsrücklage"**, die diese Ausgabe in
der Abrechnung neutralisiert. Ohne sie zahlen die Eigentümer doppelt.

Bei einer 80.000-€-Maßnahme aus der Rücklage bedeutet das eine
Nachschussforderung von 80.000 €, die es nicht geben darf. Der Beschluss über
diese Abrechnungsspitze wäre auf Anfechtung hin aufzuheben.

*Nötig:* Entnahmen aus RUECKLAGE-Konten als eigene, negative Position in der
Verteilung führen (Ausgabe darstellen, Umlage neutralisieren) — und in der
Erhaltungsplanung die Maßnahme mit der Entnahme verknüpfen.

### A3. Rücklagenzuführung: falscher Schlüssel, keine Absicherung, Doppelzählung möglich

Drei Fehler in einer Position (`RESERVE_ROW_ID` in `annual-statement.ts`):

1. **Fest nach MEA verteilt.** Der Wirtschaftsplan verteilt die Zuführung nach
   dem `distributionKey` der Kostenart „Zuführung Erhaltungsrücklage". Hat die
   WEG dort per Mehrheitsbeschluss (§ 16 Abs. 2 Satz 2 WEG) einen anderen
   Schlüssel gewählt — z. B. Wohnfläche —, dann verteilt der Plan nach Fläche und
   die Abrechnung nach MEA. Die Abrechnungsspitze ist dann bei **jedem**
   Eigentümer falsch, systematisch, in jedem Jahr.
2. **Hängt an der Ist-Umbuchung.** Die Zuführung zählt nur, wenn tatsächlich eine
   `UMBUCHUNG` auf ein Rücklagenkonto gebucht wurde. Vergisst der
   Selbstverwalter den Übertrag (oder macht ihn im Januar für das Vorjahr),
   verschwindet die gesamte Zuführung aus der Abrechnung, und jeder Eigentümer
   bekommt ein Guthaben ausgewiesen, das ihm nicht zusteht. Es gibt keinen
   Abgleich „Ist-Zuführung ./. Plan-Zuführung" und keine Warnung.
3. **Doppelzählung möglich.** Die Kostenart mit Kategorie
   `RUECKLAGENZUFUEHRUNG` wird in `computeStatementView` nicht ausgefiltert.
   Bucht jemand den Übertrag versehentlich als `AUSGABE` mit dieser Kostenart
   *und* macht zusätzlich die Umbuchung, erscheint die Zuführung zweimal.

### A4. Wirtschaftsplan gilt nicht fort — ab Januar entstehen keine Sollstellungen mehr

`EconomicPlan` ist über `@@unique([propertyId, year])` hart an ein Jahr gebunden,
`resolvePlan` erzeugt genau 12 Sollstellungen, und danach ist Schluss. Ein
Gültigkeitszeitraum existiert nicht.

§ 28 Abs. 1 Satz 2 WEG (und die übliche Beschlusspraxis) sagen: **der beschlossene
Wirtschaftsplan gilt fort, bis ein neuer beschlossen ist.** Genau darauf weist
auch der `weg-recht`-Skill hin — umgesetzt ist es nicht.

Praxisfolge, und die ist häufig: Die Versammlung findet erst im April statt. Von
Januar bis April existieren im System **keine Sollstellungen**. Damit:
- schuldet laut Software niemand Hausgeld,
- weist die Offene-Posten-Liste keine Rückstände aus,
- ist eine Mahnung für diese Monate unmöglich (`currentArrears` liefert 0),
- und wenn der neue Plan dann für das ganze Jahr beschlossen wird, sind die
  bereits eingegangenen Zahlungen der ersten Monate den Sollstellungen zeitlich
  vorgelagert — die Salden stimmen nur zufällig.

Für eine selbstverwaltende WEG, die selten pünktlich tagt, ist das der
wahrscheinlichste Fall überhaupt.

*Nötig:* `validFrom`/`validUntil` am Plan statt `year`, Fortschreibung der
Sollstellungen bis zum Nachfolgeplan, und beim Beschluss des Nachfolgeplans
Abgleich der bereits erzeugten Sollstellungen statt `deleteMany`.

---

## B. Schwerwiegend — Fehler im Echtbetrieb, kein Sofort-Blocker

### B1. Keine Storno-/Korrekturmöglichkeit — und kein Rückgängig für Importe

Buchungen sind unveränderlich (gut) — aber es gibt **keinen Weg, eine falsche
Buchung zu korrigieren**. Kein Storno, kein Löschen, und `BankImportBatch` hat
trotz der Planvorgabe („für Anzeige + **Rückgängig**") keine Lösch-Action.

Konkret: falsche Spalte gemappt, 300 Zeilen mit vertauschtem Vorzeichen
importiert. Die stehen dauerhaft im Journal. Die Kontenprüfung in
`finalizeStatement` wird nie aufgehen — und weil sie hart ist (zu Recht), ist die
Abrechnung dieses Objekts damit **dauerhaft blockiert**. Der einzige Ausweg wäre
ein Eingriff in die Datenbank.

*Nötig:* Storno-Buchung (Gegenbuchung mit `stornoOfId`, beide markiert, beide
sichtbar, Saldo-neutral) — nicht Löschen. Plus „Import rückgängig" für einen
Batch, solange keine Abrechnung darauf FERTIG ist.

### B2. Zahlungszuordnung ist keine Offene-Posten-Rechnung — Mahnungen können falsche Beträge nennen

`Booking.unitId` ordnet eine Zahlung *pauschal* einer Einheit zu; der Rückstand
ist dann `Σ fällige Sollstellungen − Σ ALLE Einnahmen dieser Einheit`
(`currentArrears`). Daraus folgen vier Fehler:

- **Jede Einnahme tilgt Hausgeld.** Eine Sonderumlagen-Zahlung, eine
  Versicherungserstattung, eine Rückzahlung — alles, was der Einheit zugeordnet
  wird, senkt den Hausgeldrückstand. Die Sonderumlage selbst erzeugt zwar eine
  eigene Sollstellung, aber Soll und Zahlung sind nirgends verknüpft, also
  verrechnet sich alles gegen alles.
- **Vorauszahlungen verschleiern Rückstände.** Wer im Dezember das Januar-Geld
  überweist, erscheint im Dezember als ausgeglichen.
- **Sammelüberweisungen sind nicht teilbar.** Ein Eigentümer mit zwei Einheiten
  überweist einmal — die Zahlung kann nur einer Einheit zugeordnet werden.
- **Keine Tilgungsreihenfolge.** §§ 366/367 BGB (erst Kosten, dann Zinsen, dann
  Hauptforderung; bei mehreren Forderungen die ältere) ist nicht abgebildet.

Weil die Mahnung den Rückstand *einfriert* und als Betrag im Brief nennt, wird
aus einem Rechenfehler ein Schreiben mit falscher Forderung — das ist der Teil,
der nach außen geht.

*Nötig:* Zuordnung Zahlung → Sollstellung (n:m mit Teilbeträgen), wie es der
Buchhaltungs-Skill vorsieht. Das ist der größte Einzelumbau in dieser Liste, aber
er zahlt auf OPOS, Mahnwesen, Vermögensbericht und Jahresabrechnung gleichzeitig
ein.

### B3. Zählerverteilung verstößt gegen die HeizkostenV

`distributeByMeters` verteilt die Gesamtkosten einer Kostenart **zu 100 % nach
Verbrauch**. § 7 Abs. 1 HeizkostenV verlangt für Heizung 50–70 % nach Verbrauch,
den Rest nach Wohnfläche/umbautem Raum; § 8 entsprechend für Warmwasser.

Eine so erstellte Abrechnung ist formell fehlerhaft. Zusätzlich gibt § 12 Abs. 1
HeizkostenV **jedem Eigentümer ein Kürzungsrecht von 15 %** auf seinen Anteil —
den die Gemeinschaft dann trägt.

Der Weg über den Messdienst-Import (`importHeatingAmounts`) ist unproblematisch,
weil der Messdienst die Aufteilung schon vorgenommen hat. Aber die eingebaute
Zählerverteilung wird angeboten, sieht korrekt aus und ist es nicht — es fehlt
jede Warnung.

*Nötig:* bei Kostenarten vom Typ Heizung/Warmwasser einen Grundkosten-/
Verbrauchskosten-Anteil (Default 30/70) erzwingen, oder die Funktion für diese
Kostenarten sperren und auf den Messdienst-Import verweisen. Zusätzlich fehlt
die Trennung Heizung/Warmwasser (§ 9 HeizkostenV).

### B4. § 35a-Ausweis: die Zeile heißt „begünstigte Aufwendungen", enthält aber den Bruttobetrag

`computeLaborShares` summiert für jede geflaggte Kostenart den **vollen**
Kostenanteil der Einheit. Steuerlich begünstigt ist aber nur der Anteil für
Arbeitslohn, Maschinen- und Fahrtkosten — Material ausdrücklich nicht (§ 35a
Abs. 5 Satz 2 EStG).

Fairerweise: das PDF (`einzelabrechnung.ts`) *sagt* es dazu — „Maßgeblich ist der
in den Rechnungen ausgewiesene Lohn-/Fahrtkostenanteil." Die Software behauptet
also nichts Falsches. Das Problem ist der Widerspruch zwischen Beschriftung und
Inhalt: Die Überschrift lautet „Steuerlich begünstigte Aufwendungen (§ 35a
EStG)", darunter steht ein Eurobetrag, und **genau diesen Betrag trägt der
Eigentümer in die Anlage seiner Steuererklärung ein.** Die Fußnote in 7,5 pt
verhindert das nicht. Bei 60 % Materialanteil ist der eingetragene Wert um das
Zweieinhalbfache zu hoch.

Zwei weitere Punkte fehlen: § 35a setzt **unbare Zahlung** voraus (Rechnung +
Überweisung) — nicht geprüft; und maßgeblich ist das **Jahr der Zahlung**, was
hier durch die Ist-Rechnung immerhin automatisch stimmt.

*Nötig:* entweder das Feld je Buchung/Kostenart mit einem Lohnanteil (absolut
oder %) hinterlegen und den echten Wert ausweisen — oder, als kleine Lösung, die
Spalte ehrlich in „Gesamtaufwand der begünstigten Kostenarten" umbenennen und
den Betrag nicht als bescheinigungsfähig darstellen.

*Nötig:* je Buchung (oder je Kostenart) ein Feld „davon Lohn-/Fahrt-/
Maschinenanteil" — absolut oder in Prozent, mit Vorbelegung aus der Kostenart.

### B5. Wirtschaftsplan und Jahresabrechnung sind nicht mit der Beschluss-Sammlung verknüpft

`EconomicPlan.resolutionNote` und `Sonderumlage.resolutionNote` sind **Freitext**
(„ETV 12.03.2026, TOP 4"). Es gibt keine Fremdschlüsselbeziehung auf das
vorhandene `Resolution`-Modell.

Damit kann die Software nicht garantieren, dass der Beschluss über die
Abrechnungsspitze überhaupt in der Beschluss-Sammlung (§ 24 Abs. 7 WEG) steht —
obwohl beide Bausteine existieren. Ein Tippfehler im Freitext bleibt unbemerkt,
ein gelöschter Beschluss hinterlässt eine Sollstellung ohne Grundlage.

Ebenfalls nicht abgebildet: die **Anfechtungsfrist von einem Monat** (§ 45 WEG).
Der Plan kennt nur ENTWURF/BESCHLOSSEN, kein „bestandskräftig ab". Für die
Selbstverwaltung wäre gerade das wertvoll — „dieser Beschluss ist seit dem
12.04. bestandskräftig" beantwortet die häufigste Frage im Beirat.

### B6. Fälligkeit fest auf den 1. des Monats — entschärft, aber nicht gelöst

*Korrektur gegenüber der ersten Fassung dieses Berichts:* Ich hatte das zu hart
bewertet. Die mitgelieferte **Beschlussvorlage nennt den 1. des Monats
ausdrücklich** („… und sind jeweils zum 1. eines Monats fällig"). Beschließt die
WEG diesen Text, ist der Monatserste die vereinbarte Fälligkeit, und der Verzug
nach § 286 Abs. 2 Nr. 1 BGB tritt korrekt ein. Das ist sauber gelöst.

Es bleibt ein engerer Fall: Sagt die **Gemeinschaftsordnung** etwas anderes —
verbreitet ist der 3. Werktag —, dann widersprechen sich Beschlussvorlage und
GO, und die Software kann dem nicht folgen. Der Nutzer merkt es nicht, weil der
Mustertext plausibel aussieht.

*Nötig, aber nicht dringend:* Fälligkeitsregel je Objekt (Monatserster /
3. Werktag / freier Tag), die sowohl `dueDate` als auch den Text der
Beschlussvorlage steuert.

---

## B7. Wirtschaftsplan im Detail — was er kann und was fehlt

Nachgereichte Tiefenprüfung von `wirtschaftsplan/page.tsx`,
`wirtschaftsplan/[planId]/page.tsx`, `economic-plan.ts` und
`wirtschaftsplan-pdf.ts`.

**Er kann mehr, als ich zunächst geschrieben habe.** Vorhanden und gut:
Wirtschaftsjahr mit frei wählbarem Beginn (nicht nur Kalenderjahr — das können
viele kommerzielle Programme nicht), Vorbelegung und Vergleichsspalte aus dem
Vorjahres-Ist, Planwerte je Kostenart editierbar, automatische Verteilung auf
die Einheiten nach dem jeweiligen Schlüssel, centgenaue 12 Monatsraten,
fertige Beschlussvorlage im Gesetzeswortlaut, Beschluss erzeugt idempotent die
Sollstellungen, danach unveränderlich, PDF, Beiratsvermerk, Eigentümersicht.
Das ist ein tragfähiger Wirtschaftsplan.

Was fehlt:

**a) Keine Einnahmenseite (§ 28 Abs. 1 WEG).** Der Gesamtwirtschaftsplan muss die
voraussichtlichen **Einnahmen und Ausgaben** enthalten. Hier gibt es nur
Kostenarten — alle `CostCategory`-Werte sind Ausgabenarten, `amountCents` ist
„immer positiv", und `computeUnitAdvances` wirft bei negativen Werten. Es gibt
also keinen Weg, Zinserträge, Mieteinnahmen aus Gemeinschaftseigentum
(vermietete Hausmeisterwohnung, Waschküche, Dachfläche für PV oder
Mobilfunkantenne) oder PV-Einspeisevergütung abzubilden.

Für eine WEG mit solchen Einnahmen ist der Plan strukturell unvollständig **und
das Hausgeld systematisch zu hoch** — die Einnahmen mindern den Vorschussbedarf,
tauchen aber nirgends auf. Das betrifft nicht wenige Gemeinschaften; PV auf dem
Gemeinschaftsdach ist inzwischen Normalfall. Ich stufe das als kritisch ein,
nicht als Komfortlücke.

**b) Kein geänderter Wirtschaftsplan / kein Nachtrag.** Nach dem Beschluss ist
der Plan unveränderlich, `deletePlan` greift nur bei ENTWURF, und
`@@unique([propertyId, year])` verhindert einen zweiten Plan für dasselbe Jahr.
Beschließt die WEG unterjährig einen geänderten Wirtschaftsplan — nach einem
Energiepreissprung der klassische Fall —, gibt es dafür **keinen Weg**. Weder
ändern noch löschen noch danebenlegen. Sackgasse, die nur über die Datenbank
aufzulösen ist.

**c) Der Einzelwirtschaftsplan wird nirgends erzeugt.** § 28 Abs. 1 verlangt
Einzelwirtschaftspläne — also für jeden Eigentümer die Aufschlüsselung *seines*
Anteils nach Kostenpositionen. Das PDF ist **ein** Dokument: Gesamtplan plus eine
Tabelle aller Einheiten mit Jahresbetrag und Monatsrate. Jeder Eigentümer lädt
dasselbe Blatt und sieht eine Summe, nicht ihre Zusammensetzung.

Bemerkenswert: `computeUnitAdvances` berechnet mit `perItem` genau diese
Aufschlüsselung bereits — sie wird **nirgends verwendet**. Die Rechenarbeit ist
fertig, es fehlt nur die Darstellung. Das ist die billigste substanzielle
Verbesserung in diesem ganzen Bericht.

**d) Sollstellung ohne Aufteilung Hausgeld / Rücklage.** `DuePosting` ist ein
Gesamtbetrag. Der Eigentümer erfährt nicht, welcher Teil seines Hausgelds
Kostenvorschuss und welcher Zuführung zur Rücklage ist. Das ist keine
Spitzfindigkeit: der Rücklagenanteil ist Vermögensbildung, kein Verbrauch — beim
Verkauf der Wohnung ist genau diese Zahl gefragt, und der vermietende Eigentümer
braucht sie für die Abgrenzung gegenüber dem Mieter.

**e) Nur 12 Monatsraten.** `monthlyInstallments` ist fest auf 12. Quartals- oder
Halbjahreszahlung — in kleinen Gemeinschaften nicht selten — ist nicht
abbildbar.

**f) Kein Übernahmeweg aus der Erhaltungsplanung.** `reserve-plan.ts` rechnet den
Rücklagenbedarf samt Unterdeckungsjahr sauber aus. Der Wirtschaftsplan weiß
nichts davon; die empfohlene Zuführung muss von Hand abgetippt werden. Ein
„Bedarf übernehmen"-Knopf plus eine Warnung, wenn die geplante Zuführung 0 ist
(§ 19 Abs. 2 Nr. 4 WEG — angemessene Rücklage gehört zur ordnungsgemäßen
Verwaltung), wäre für Selbstverwalter der praktischste Hinweis im ganzen Modul.

**g)** Fortgeltung (A4), Beschlussverknüpfung (B5) und die Vorbelegung mit
unvollständigen Vorjahreswerten (Abschnitt D) betreffen ebenfalls den
Wirtschaftsplan und stehen dort.

---

## C. Aus Sicht der Eigentümer — arbeiten wir an ihnen vorbei?

Nein, die Richtung stimmt. Der Beiratsprüfvermerk, die Einsicht in Plan und
Abrechnung, die unterjährige Verbrauchsinformation (§ 6a HeizkostenV) und der
Erhaltungsplan mit Rücklagenprognose sind genau die Dinge, für die
selbstverwaltende Gemeinschaften sonst Excel benutzen. Das ist echter Mehrwert.

Was Eigentümer erfahrungsgemäß zusätzlich brauchen und heute fehlt:

1. **Eigener Kontoauszug je Einheit.** „Was habe ich wann gezahlt, was schulde
   ich?" — die Eigentümersicht (`finanzen/`) zeigt Plan und Abrechnung, aber
   keine persönliche Soll-/Ist-Historie. Das ist die Nummer-eins-Rückfrage an
   jeden Verwalter und wäre aus den vorhandenen Daten sofort baubar (nach B2).
2. **Die § 35a-Bescheinigung als eigenes PDF je Eigentümer** (heute nur Teil der
   Abrechnung; der Steuerberater will ein Blatt).
3. **Belegeinsicht (§ 18 Abs. 4 WEG).** Der Anspruch ist gesetzlich; die Belege
   liegen bereits an den Buchungen. Heute sieht sie nur der Verwalter. Für eine
   Selbstverwaltung ist die kontrollierte Belegeinsicht durch den Beirat der
   eigentliche Vertrauensanker.
4. **Vorher/Nachher beim Hausgeld.** „Ab Mai zahlst du 312 € statt 287 €, weil
   Position X gestiegen ist." Der Einzelwirtschaftsplan enthält alles dafür.
5. **Vermögensbericht ohne Verbindlichkeiten.** § 28 Abs. 4 WEG nennt auch die
   wesentlichen **Verbindlichkeiten** — der Block zeigt nur Konten und
   Forderungen. Offene Handwerkerrechnungen fehlen (siehe D2).
6. **Sonderumlage: keine Ratenzahlung.** `Sonderumlage` kennt genau ein
   `dueDate`. In der Praxis wird eine 60.000-€-Umlage fast immer in Raten
   beschlossen. Heute müsste man sie mehrfach anlegen.
7. **Nichts zum Eigentümerwechsel-Fall.** `splitByOwnership` teilt den
   Kostenanteil tagesgenau — als *Information* ist das gut. Rechtlich schuldet
   den Nachschuss aber, wer im Zeitpunkt des Beschlusses Eigentümer ist; der
   Ausgleich zwischen Verkäufer und Käufer ist Sache des Kaufvertrags. Wenn die
   Oberfläche die Tagesaufteilung als „wer schuldet was" darstellt, ist das
   falsch. Bitte prüfen und eindeutig als interne Aufteilung beschriften.

---

## D. Aus Sicht eines Buchhalters — was einem Programm dieser Größe fehlt

Vorweg, damit es nicht als Lücke fehlgedeutet wird: **eine Periodenabgrenzung
fehlt zu Recht.** Die WEG-Jahresabrechnung folgt dem Zufluss-/Abflussprinzip; die
Dezember-Rechnung, die im Januar bezahlt wird, gehört ins Folgejahr. Die Software
macht das korrekt. Nicht „reparieren".

Was tatsächlich fehlt, nach Nutzen sortiert:

1. **Storno** — siehe B1. Ohne das ist es keine Buchhaltung, sondern ein
   Erfassungsformular.
2. **Kreditorenseite / offene Eingangsrechnungen.** `CraftsmanInvoice` existiert,
   ist aber mit `Booking` nicht verbunden. Eine erfasste, noch nicht bezahlte
   Rechnung ist damit weder eine Verbindlichkeit im Vermögensbericht noch eine
   Zahlungsverpflichtung in der Liquiditätssicht. Eine Verknüpfung
   Rechnung → Buchung („bezahlt am, aus Konto X") schließt drei Lücken auf
   einmal.
3. **OPOS mit Altersstruktur.** Die Rückstandsliste kennt nur „offen/
   ausgeglichen". Die Standardauswertung ist die Alterung (0–30 / 31–60 / 61–90 /
   >90 Tage) — sie ist der Auslöser für die nächste Mahnstufe und die Grundlage
   der Wertberichtigung. Der Buchhaltungs-Skill fordert sie ausdrücklich.
4. **Journal- und Kontoblatt-Export** (CSV/PDF) je Zeitraum und je Konto. Für
   Beiratsprüfung und Steuerberater unverzichtbar; heute gibt es nur die
   Bildschirmliste.
5. **Summen- und Saldenliste je Kostenart** mit Vorjahresvergleich — die
   Standardsicht vor jeder Plan-Erstellung. Die Daten sind vorhanden
   (`previousActualCents` existiert bereits punktuell).
6. **Belegpflicht.** Der Beleg-Upload ist optional, importierte Buchungen haben
   grundsätzlich keinen. Es fehlt eine Auswertung „Ausgaben ohne Beleg" — die
   erste Frage jeder Beiratsprüfung. Ohne Zwang, aber sichtbar.
7. **Vier-Augen-Prinzip.** In der Selbstverwaltung bucht und zahlt oft dieselbe
   Person. Eine Freigabe durch ein zweites Beiratsmitglied oberhalb eines
   Betragsschwellenwerts wäre ein echtes Schutzmerkmal — und ein
   Verkaufsargument.
8. **Verzugszinsen.** Bewusst weggelassen, und die Begründung ist richtig. Aber
   § 288 Abs. 1 BGB gibt der Gemeinschaft einen Anspruch, den sie so schlicht
   nicht geltend macht. Vorschlag: optional pro WEG aktivierbar, berechnet je
   Sollstellung ab Fälligkeit, ausgewiesen aber nicht automatisch gebucht.
9. **Bauabzugsteuer (§ 48 EStG).** Beauftragt eine WEG Bauleistungen über
   5.000 €/Jahr und liegt keine Freistellungsbescheinigung vor, muss sie 15 %
   einbehalten und abführen — sonst haftet sie. Selbstverwaltende Gemeinschaften
   laufen hier regelmäßig hinein und wissen es nicht. Ein Feld
   „Freistellungsbescheinigung gültig bis" am Handwerker plus eine Warnung beim
   Buchen wäre wenig Aufwand und großer Schutz.
10. **Aufbewahrung.** Keine Löschsperre für Buchungen, Belege und Abrechnungen
    (10 Jahre). Das kollidiert potenziell mit dem DSGVO-Löschpfad
    (`anonymizedAt`), wenn ein Eigentümer die Löschung verlangt.
11. **Kein Kontenrahmen/keine Kontonummern.** Für die Selbstverwaltung
    verzichtbar — aber sobald ein Steuerberater oder ein DATEV-Export ins Spiel
    kommt, fehlt die Anschlussfähigkeit. Bewusste Entscheidung, gehört nur
    dokumentiert.

### Kleinere Beobachtungen

- **Planwerte werden mit Vorjahres-Istwerten vorbelegt** (`createPlan`). Wird der
  Plan wie vorgeschrieben *vor* Jahresbeginn erstellt, ist das Vorjahr noch nicht
  abgeschlossen — die Vorbelegung ist dann systematisch zu niedrig. Als
  Vergleichswert richtig, als Vorbelegung eine stille Falle. Besser:
  hochgerechnet, und ausdrücklich als „vorläufig" gekennzeichnet.
- **`saveManualAmounts` behandelt Leerfelder als 0** und schreibt sie fest.
  Zusammen mit der Plausibilitätsprüfung (Σ manuell muss = Gesamtbetrag) ist das
  abgesichert, aber es erklärt dem Nutzer nicht, warum die Abrechnung plötzlich
  klemmt.
- **`suggestUnit`** (Zuordnungsvorschlag über das Label im Verwendungszweck) ist
  eine gute Idee, greift aber nur bei sauber beschrifteten Überweisungen. Der
  wirksamere Hebel wäre der Abgleich über den Namen des Eigentümers oder die
  IBAN aus dem SEPA-Mandat — beides ist bereits im System (`SepaMandate`).
- Datumsbehandlung ist durchgehend UTC-konsistent (`fiscalYearRange`,
  `parseGermanDate`, manuelle Buchung) — kein Jahresgrenzen-Fehler. Geprüft, in
  Ordnung.
- Die Restcent-Regel in `distributeByWeight` hat einen defensiven dritten Schritt,
  der mathematisch nie greift. Harmlos, aber der Kommentar sagt das auch.

---

## Empfohlene Reihenfolge

| # | Maßnahme | Warum zuerst |
|---|---|---|
| 1 | A1 Kostenart nachträglich zuordenbar | ohne das ist keine Abrechnung abschließbar |
| 2 | B1 Storno + Import rückgängig | ohne das ist kein Fehler korrigierbar |
| 3 | A2 Rücklagenentnahme neutralisieren | doppelte Belastung der Eigentümer |
| 4 | A3 Rücklagenzuführung: Schlüssel aus dem Plan, Soll-/Ist-Abgleich | systematisch falsche Spitze |
| 5 | A4 Fortgeltung des Wirtschaftsplans | häufigster Praxisfall |
| 5b | B7a Einnahmenseite im Wirtschaftsplan | § 28 I; Hausgeld sonst zu hoch |
| 5c | B7c Einzelwirtschaftsplan darstellen | Rechenlogik existiert bereits (`perItem`) |
| 6 | B3 HeizkostenV-Sperre/Warnung | 15 % Kürzungsrecht |
| 7 | B4 Lohnanteil für § 35a | falsche Zahl geht ans Finanzamt |
| 8 | B2 echte Zahlungszuordnung | größter Umbau, aber löst OPOS/Mahnwesen/Vermögensbericht |
| 9 | B5/B6 Beschlussverknüpfung, Fälligkeitsregel | Sorgfalt, kein akuter Schaden |
| 10 | C1 Eigentümer-Kontoauszug, D2 Kreditoren, D3 OPOS-Alterung | sichtbarster Nutzen für Eigentümer und Beirat |
