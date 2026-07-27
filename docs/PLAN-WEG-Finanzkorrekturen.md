# Umsetzungsplan — WEG-Finanzkorrekturen

Stand: 26.07.2026 · Basis: [`REVIEW-WEG-Buchhaltung.md`](./REVIEW-WEG-Buchhaltung.md)

Korrektur der in der Fachprüfung gefundenen Fehler im WEG-Finanzblock. Kein
Neubau — alle Pakete erweitern Bestehendes. Format und Konventionen wie in
[`PLAN-WEG-Finanzfundament.md`](./PLAN-WEG-Finanzfundament.md).

---

## 0. Verstandener Rahmen (Produkt, Mandanten, Rollen)

Vorangestellt, weil jedes Paket unten davon abhängt. Nachgelesen in
`app-mode.ts`, `access.ts`, `session.ts`, `weg/scope.ts`, `registrieren/actions.ts`
und dem Prisma-Schema.

### Zwei Betriebsmodi (`APP_MODE`, `src/lib/app-mode.ts`)

| Modus | Wer | Verhalten |
|---|---|---|
| `verwaltung` (Default) | **B&W** und ihre Kunden | Startseite = Login, **keine** Self-Service-Registrierung |
| `weg` | WEG-SaaS, künftig White Label | öffentliche Landing-Page, Self-Service-Registrierung, `accountType` immer `selbstverwalter` |

### Mandantenmodell

Mandant ist die **`Organization`**. Alles Fachliche hängt an `organizationId`.
White Label ist im Datenmodell bereits angelegt: `slug` (Subdomain/Custom-Domain),
`logoStoredName`, `primaryColor`, `legalName` und die Impressumsfelder; die
PDF-Erzeugung zieht das über `getBrandingForOrg`. **Konsequenz für alle Pakete:
kein neuer Code darf B&W-spezifisch sein, und jedes neue Dokument läuft über
`getBrandingForOrg`.**

### Zwei Kundenprofile (`Organization.accountType`)

- `verwaltung` — professionelle Hausverwaltung (B&W). WEG liegt unter
  „Verwaltung", Branding-Einstellungen verfügbar.
- `selbstverwalter` — selbstverwaltende WEG. WEG liegt unter „Gemeinschaft",
  eigenes `SelfManagedDashboard`, Anträge/Umlaufbeschlüsse freigeschaltet,
  Branding gesperrt (Standard-Erscheinungsbild).

Das ist die eigentliche Profilweiche — unabhängig von `APP_MODE`, weil eine
selbstverwaltende WEG auch in der B&W-Instanz existieren kann.

### Rollen und Rechte

Vier Rollen: `VERWALTER`, `EIGENTUEMER`, `MIETER`, `HANDWERKER`.

Der entscheidende Kniff, der beide Profile mit einem Rechtemodell bedient: **In
der Selbstverwaltung ist der administrierende Eigentümer ein `VERWALTER`-User,
der zugleich `Ownership` hat.** Deshalb funktioniert `requireVerwalter` in beiden
Profilen, und `canVoteOnProperty` ist bewusst rollen*un*abhängig, damit der
interne Verwalter bei Beschlüssen mitstimmen darf.

- **Beirat ist keine Rolle**, sondern das Flag `Ownership.isBoardMember`. Er erbt
  die Eigentümerrechte; Zusatzrechte (Prüfvermerk § 29 III, erweiterte Einsicht)
  hängen am Flag (`isBoardMemberOf`).
- **Objekt-Scope**: `PropertyAssignment` grenzt Verwalter ein, `isSuperAdmin`
  hebt die Grenze auf. `canVerwalterAccessProperty` ist die Wand.
- **Der gesamte WEG-Finanzbereich läuft über `requireWegProperty` /
  `loadWegProperty`** — Verwalter **und** Objektzugriff **und**
  `managementType === "WEG"`. Diese Kette bleibt in jedem Paket unangetastet.
- Eigentümer sehen ihre Finanzdaten ausschließlich über `/finanzen`, gescoped
  über `wegPropertiesForOwner` / `ownedUnitIdsInProperty`.

**Heutiger Stand, der für KP2 und Block 4 wichtig ist:** Schreibrechte in der
Buchhaltung hat ausschließlich `VERWALTER`. Der Beirat kann **nur** den
Prüfvermerk setzen. Für ein späteres Vier-Augen-Prinzip ist das Fundament
(`isBoardMemberOf`) da und muss nur verdrahtet werden.

---

## Harte Prinzipien (in jedem Paket einzuhalten)

1. **Geld = Integer-Cent**, nie Float. `parseEuroToCents` / `formatCents`.
   Verteilungen ausschließlich über `distributeByWeight` (centgenau).
2. **Buchungen bleiben append-only.** Korrektur = Stornobuchung, niemals
   `booking.update` auf wertrelevante Felder, niemals Löschen. Die einzige
   Ausnahme regelt KP2 explizit und eng.
3. **Scope-Wand unverändert**: jede schreibende Action über `loadWegProperty`;
   kein Cross-Org-, kein Cross-Objekt-Zugriff.
4. **Audit-Log** für jede schreibende Aktion; neue `AUDIT`-Konstanten ergänzen.
5. **Nichts wird B&W-spezifisch.** Org-gescoped, Branding über
   `getBrandingForOrg`, keine festen Firmennamen in Texten oder PDFs.
6. **FERTIG-Abrechnungen sind unantastbar.** Kein Paket darf Daten ändern
   können, die in einen bestehenden `AnnualStatement`-Snapshot eingeflossen sind.
7. **Rechtlich vs. Praxis kennzeichnen.** Wo etwas nicht zwingend vorgeschrieben
   ist, gehört ein Kommentar „gesetzlich nicht zwingend, aber Best Practice"
   an den Code — wie bisher.
8. **Laientauglich, ohne fachlich falsch zu werden.** Zielgruppe ist der
   Eigentümer, der das nebenbei macht. Fachbegriffe bleiben als Überschrift
   (sie stehen so im Gesetz und im Beschluss), bekommen aber eine Klartextzeile
   darunter; Erklärungen hängen an `User.showHints` (an für Selbstverwalter, aus
   für Profis). Fehlermeldungen nennen immer den nächsten Klick. Details in
   [`PRODUKT-Laientauglichkeit-und-UseCases.md`](./PRODUKT-Laientauglichkeit-und-UseCases.md).
9. **Deutsche UI, fachlich korrekte Begriffe, Zeitzone Europe/Berlin.**
   Datumsgrenzen bleiben UTC-konsistent (`fiscalYearRange`, `parseGermanDate`) —
   das ist heute korrekt und darf nicht aufgeweicht werden.
10. Nach jedem Paket: `npx prisma generate`, `next build`, `npm test` grün.
   Selbstentscheidungen in `portal/DECISIONS.md` dokumentieren.

---

## Block 1 — Entblocken (klein, ohne Migrationsrisiko)

Ohne diese zwei Pakete ist das Modul im Echtbetrieb nicht benutzbar: die
Abrechnung lässt sich nicht fertigstellen und Fehler nicht korrigieren.

### KP1 — Kostenart nachträglich zuordnen  *(Befund A1)*

Heute setzt nur `createBooking` die `costTypeId`. CSV-importierte Buchungen
bleiben dauerhaft ohne Kostenart, landen in `otherExpenseCents` und blockieren
`finalizeStatement` für immer.

- Neue Action `assignCostType` in `buchhaltung/actions.ts`: setzt
  `Booking.costTypeId` (Kostenart muss zum Objekt gehören — IDOR-Schutz wie in
  `loadAccount`). `null` erlaubt (Zuordnung aufheben).
- **Massenzuordnung**: Checkboxen in der Buchungsliste + eine Kostenart-Auswahl
  → eine Action für n Buchungen, in einer Transaktion.
- Sperre: Buchung, deren `bookingDate` in ein Wirtschaftsjahr mit
  `AnnualStatement.status = FERTIG` fällt, ist nicht mehr änderbar
  (Prinzip 6) — verständliche Fehlermeldung.
- UI: prominenter Filter „ohne Kostenart" mit Zähler auf der Buchhaltungsseite;
  Hinweisbanner, solange `> 0` (das ist die Zahl, die später die Abrechnung
  blockiert).
- `AUDIT.WEG_BOOKING_COSTTYPE_ASSIGNED`.

*Kein Regelwerk in diesem Paket* — die Merkregel „Verwendungszweck enthält X →
Kostenart Y" ist bewusst nach Block 4 geschoben (eigenes Modell, eigene Tests).

### KP2 — Storno und Import-Korrektur  *(Befund B1)*

Heute gibt es keinen Weg, eine falsche Buchung zu korrigieren, und
`BankImportBatch` hat trotz Planvorgabe keine Rücknahme. Ein falsch gemappter
Import blockiert das Objekt dauerhaft, weil die Kontenprüfung nie aufgeht.

**Storno als Gegenbuchung, nicht als Löschung:**

```prisma
model Booking {
  // …
  reversalOfId String?  @unique   // diese Buchung storniert jene
  reversalOf   Booking? @relation("BookingReversal", fields: [reversalOfId], references: [id])
  reversedBy   Booking? @relation("BookingReversal")
}
```

- Action `reverseBooking`: legt eine Buchung mit **umgekehrter Richtung**,
  gleichem Betrag, gleichem Konto und gleichem Buchungstag an, Text
  `"Storno: <Originaltext>"`, `reversalOfId` gesetzt. Beide bleiben sichtbar,
  der Saldo ist neutral.
- Bei `UMBUCHUNG` werden **beide** Seiten der `transferGroupId` storniert,
  in einer Transaktion.
- Sperren: nur einmal stornierbar (`@unique`), ein Storno ist selbst nicht
  stornierbar, und nicht, wenn eine FERTIG-Abrechnung den Zeitraum abdeckt.
- Kontenstände und Abrechnung brauchen **keine** Anpassung — Storno ist eine
  normale Buchung und läuft durch `signedSum` und `computeStatementView` von
  selbst richtig durch. Test dafür schreiben.

**Import zurücknehmen:** Action `deleteImportBatch` löscht Batch samt seiner
Buchungen **hart** — bewusst als eng begrenzte Ausnahme von Prinzip 2, weil 300
Stornozeilen für einen Fehlmapping-Import das Journal unlesbar machen.
Bedingungen, alle drei: keine FERTIG-Abrechnung deckt den Zeitraum, keine
Buchung des Batches ist storniert, und der Batch ist vollständig (keine
Teillöschung). Vollständig im Audit-Log mit Anzahl und Dateiname.
→ Entscheidung nach `DECISIONS.md`.

---

## Block 2 — Rechnerisch richtig (mittlere Größe, eine Migration)

### KP3 — Erhaltungsrücklage: Entnahme und Zuführung  *(Befunde A2 + A3)*

Der schwerste Rechenfehler. Drei Teile:

1. **Entnahme neutralisieren.** Ausgaben von einem `RUECKLAGE`-Konto werden
   heute wie laufende Kosten auf die Einheiten verteilt — obwohl sie aus
   bereits eingezahltem Rücklagenvermögen bezahlt wurden. Die Eigentümer zahlen
   doppelt. `computeStatement` bekommt eine Gegenposition „Entnahme aus der
   Erhaltungsrücklage", die diese Ausgaben in der Umlage neutralisiert; in der
   Darstellung bleiben sie als Ausgabe sichtbar (§ 28 II verlangt die
   Einnahmen-/Ausgabenrechnung).
2. **Zuführung nach dem Schlüssel des Wirtschaftsplans**, nicht fest nach MEA.
   `RESERVE_ROW_ID` zieht den `distributionKey` der Kostenart mit Kategorie
   `RUECKLAGENZUFUEHRUNG` aus dem Plan des Jahres; nur ohne Plan bleibt MEA der
   Rückfall.
3. **Doppelzählung verhindern und Soll/Ist abgleichen.** Kostenarten der
   Kategorie `RUECKLAGENZUFUEHRUNG` werden aus der normalen Ausgabenverteilung
   ausgefiltert. Zusätzlich eine Prüfzeile: geplante Zuführung laut
   Wirtschaftsplan gegen tatsächliche Umbuchungen — Abweichung als Warnung in
   `errors` (nicht als harter Blocker, weil eine bewusst abweichende Zuführung
   vorkommen kann).

Tests: Entnahme verändert die Abrechnungsspitze nicht; abweichender Schlüssel
wird übernommen; fehlende Umbuchung erzeugt eine Warnung; als Ausgabe gebuchte
Zuführung wird nicht doppelt gezählt.

### KP4 — Einnahmenseite im Wirtschaftsplan  *(Befund B7a)*

§ 28 Abs. 1 verlangt voraussichtliche **Einnahmen und Ausgaben**. Heute gibt es
nur Ausgabenarten; Zinserträge, Miete aus Gemeinschaftseigentum und
PV-Einspeisung sind nicht abbildbar, das Hausgeld daher zu hoch.

- Neue `CostCategory`-Ausprägung **`ERTRAG`** (statt negativer Beträge — die
  Invariante „`amountCents` immer positiv" bleibt damit erhalten).
- `computeUnitAdvances`: Ertragspositionen **mindern** den zu verteilenden
  Vorschussbedarf, verteilt nach ihrem eigenen Schlüssel.
- `computeStatement`: Ist-Einnahmen mit Kostenart `ERTRAG` werden analog
  gegengerechnet, statt in `incomeCents` unterzugehen.
- Stammdaten-UI und Katalog: Ertragsarten anlegbar; im Standardkatalog
  „Zinserträge" ergänzen.
- Sperre: Gesamtvorschuss darf nicht negativ werden — verständlicher Fehler.

### KP5 — Einzelwirtschaftsplan je Eigentümer  *(Befund B7c)*

Die Aufschlüsselung existiert bereits (`computeUnitAdvances().perItem`) und wird
**nirgends verwendet**. Billigste substanzielle Verbesserung des Plans.

- Neues Dokument in `src/lib/documents/`: je Einheit die Zusammensetzung des
  Jahresvorschusses nach Kostenposition, Schlüssel, Anteil, plus Monatsrate und
  gesonderter Ausweis des Rücklagenanteils.
- Route unter `wirtschaftsplan/[planId]/einzelplan/[unitId]/pdf` (Verwalter) und
  eigentümer-gescoped unter `/finanzen`, beide über denselben Bauer — Muster wie
  `wirtschaftsplan-pdf.ts`.
- Branding über `getBrandingForOrg`.

### KP6 — § 35a: echter Lohnanteil  *(Befund B4)*

Die Zeile heißt „Steuerlich begünstigte Aufwendungen", enthält aber den
Bruttobetrag — und genau den trägt der Eigentümer in seine Steuererklärung ein.

- `Booking` + `laborShareCents Int?` — der in der Rechnung ausgewiesene Lohn-,
  Fahrt- und Maschinenkostenanteil, erfassbar bei manueller Buchung und
  nachträglich (gleiche Sperre wie KP1).
- `CostType` + `laborSharePercent Int?` — Vorbelegung/Schätzwert, wenn an der
  Buchung nichts erfasst ist.
- `computeLaborShares` rechnet mit dem Lohnanteil statt mit dem Gesamtbetrag.
- Wo kein Anteil hinterlegt ist: Position **nicht** ausweisen und in der
  Abrechnung sichtbar als „Lohnanteil nicht erfasst" führen — lieber eine Lücke
  als eine falsche Zahl.
- Text im PDF entsprechend anpassen.

### KP7 — HeizkostenV-Schutz  *(Befund B3)*

`distributeByMeters` verteilt zu 100 % nach Verbrauch; § 7/8 HeizkostenV
verlangt 50–70 % Verbrauch und den Rest nach Fläche, § 12 gibt sonst jedem
Eigentümer 15 % Kürzungsrecht.

- Für Kostenarten, die als Heizung/Warmwasser gekennzeichnet sind: Eingabe des
  Verbrauchsanteils (Default 70 %), Rest nach `FLAECHE`; Werte außerhalb 50–70 %
  werden abgelehnt.
- Kennzeichnung über ein neues Flag `CostType.heatingCost Boolean @default(false)`,
  im Standardkatalog für „Heizung/Warmwasser" gesetzt.
- Hinweistext, dass der Weg über den Messdienst-Import (`importHeatingAmounts`)
  vorzuziehen ist, weil der Messdienst die Aufteilung samt Rohrwärme (§ 9)
  bereits vornimmt.

---

## Block 3 — Datenmodell (groß, eigene Runde)

### KP8 — Fortgeltung und geänderter Wirtschaftsplan  *(Befunde A4 + B7b)*

Heute ist der Plan über `@@unique([propertyId, year])` starr an ein Jahr
gebunden und erzeugt genau 12 Sollstellungen. Tagt die Versammlung erst im
April, existieren Januar–April keine Sollstellungen: niemand schuldet Hausgeld,
keine Rückstände, keine Mahnung. Ein unterjährig geänderter Plan ist gar nicht
abbildbar.

- `EconomicPlan` + `validFrom` / `validUntil DateTime?`; `year` bleibt als
  Bezeichner, das Unique wird gelockert.
- Fortschreibung: solange kein Nachfolgeplan beschlossen ist, erzeugt ein Job
  bzw. die Sollstellungs-Ansicht die Forderungen des fortgeltenden Plans weiter
  (§ 28 Abs. 1 Satz 2 WEG).
- Beim Beschluss des Nachfolgeplans: `validUntil` des Vorgängers setzen und
  bereits erzeugte Sollstellungen **abgleichen statt löschen** — das heutige
  `deleteMany` ist mit Zahlungen im Bestand nicht mehr tragbar.
- Geänderter Plan: Nachfolgeplan mit unterjährigem `validFrom`; bereits
  entstandene Sollstellungen bleiben, ab `validFrom` gilt der neue Betrag.
- Fälligkeitsregel je Objekt (Monatserster / 3. Werktag / freier Tag), die
  zugleich den Text der Beschlussvorlage steuert *(Befund B6)*.

### KP9 — Echte Zahlungszuordnung  *(Befund B2, dazu D3)*

`Booking.unitId` ordnet eine Zahlung pauschal einer Einheit zu; der Rückstand
ist „alle Sollstellungen minus alle Einnahmen dieser Einheit". Dadurch tilgt eine
Sonderumlagenzahlung Hausgeldrückstände, Vorauszahlungen verschleiern Rückstände,
Sammelüberweisungen sind nicht teilbar — und die Mahnung nennt einen falschen
Betrag nach außen.

- Neues Modell `PaymentAllocation` (n:m, Teilbeträge in Cent) zwischen
  `Booking` und `DuePosting`. `Booking.unitId` bleibt als Vorfilter erhalten.
- Automatische Vorschlagszuordnung nach **§§ 366/367 BGB**: älteste Forderung
  zuerst, innerhalb einer Forderung Kosten → Zinsen → Hauptforderung.
  Vorschlag, keine stille Buchung — der Verwalter bestätigt.
- Zuordnungshilfe verbessern: heute nur Label im Verwendungszweck
  (`suggestUnit`); zusätzlich über Eigentümername und IBAN aus dem vorhandenen
  `SepaMandate`.
- `currentArrears` und der Vermögensbericht rechnen auf den Zuordnungen statt
  auf Rohsummen.
- **OPOS mit Altersstruktur** (0–30 / 31–60 / 61–90 / > 90 Tage) als Grundlage
  für die nächste Mahnstufe.

---

## Ausdrücklich **nicht** in diesem Plan

Damit nichts „repariert" wird, was Absicht ist:

- **Keine Periodenabgrenzung.** Die WEG-Jahresabrechnung folgt dem
  Zufluss-/Abflussprinzip — die im Januar bezahlte Dezemberrechnung gehört ins
  Folgejahr. Heutiges Verhalten ist korrekt.
- **Keine doppelte Buchführung / kein Debitorenkonto.** Bewusste
  Architekturentscheidung; § 28 II verlangt sie nicht.
- **Keine automatischen Mahngebühren.** Rechtlich saubere Entscheidung, bleibt.
- Kein DATEV-/Kontenrahmen-Export, keine Barkasse, kein Immoware24-Sync.

### Block 4 — später, aus dem Bericht nicht verloren

**Assistent erweitern** (Finanzdaten der eigenen Einheiten, WEG-Recht als
Wissensquelle, Seitenkontext), **geführter Jahreslauf** als Schritt-für-Schritt-
Assistent, Bauabzugsteuer (§ 48 EStG, Freistellungsbescheinigung am Handwerker),
Vier-Augen-Prinzip über `isBoardMemberOf`, Eigentümer-Kontoauszug je Einheit,
Belegeinsicht für den Beirat (§ 18 IV WEG), Kreditoren
(`CraftsmanInvoice` → `Booking`), Verbindlichkeiten im Vermögensbericht,
Journal-/Kontoblatt-Export, Auswertung „Ausgaben ohne Beleg", Verzugszinsen
(§ 288 BGB), Ratenzahlung bei Sonderumlagen, Beschlussverknüpfung
(`EconomicPlan` → `Resolution`) samt Anfechtungsfrist, Kostenart-Merkregeln,
Aufbewahrungsfristen.

---

## Anpassung an PR #36 (vor Block 2 zu erledigen)

Parallel entstand **PR #36** („Geführter Erststart und Jahresfahrplan",
Branch `claude/program-analysis-tasks-au9wmc`). Er wird zuerst zusammengeführt;
dieser Branch setzt danach neu darauf auf. Der Fahrplan bleibt — er ist die
bessere Antwort auf „was steht an" als das, was ich dafür gebaut hatte.

### Was PR #36 mitbringt

- `lib/weg/roadmap.ts` — `loadRoadmap(propertyId)`, reine Ableitung ohne eigene
  Tabelle: Wirtschaftsplan, Jahresabrechnung, Versammlung, Prüfpflichten,
  Rückstände, je mit Frist, Status (`overdue`/`soon`/`ok`) und Klartext-Hinweis.
- `dashboard/Roadmap.tsx` („Was ansteht") und `dashboard/SetupGuide.tsx`
  (neun Einrichtungsschritte) — beides auf dem **Dashboard**.
- `verwaltung/weg/page.tsx`: bei selbstverwalteter Org **und** genau einem
  Objekt wird die Seite selbst zum Finanz-Einstieg dieses Objekts — bewusst
  **ohne** Weiterleitung, weil die Unterseiten über ihren „WEG-Finanzen"-Rückweg
  sonst im Kreis laufen.

### Was daraus folgt

**Der Fahrplan gewinnt, mein Arbeitsvorrat wird auf das reduziert, was er
allein weiß.** Vier meiner sechs Einträge (Wirtschaftsplan, Jahresabrechnung,
Prüfpflichten, Rückstände) deckt `loadRoadmap` bereits ab — sie fliegen raus.
Übrig bleiben die zwei buchhalterischen, die aus Block 1 stammen und in keinem
Fahrplan stehen können, weil sie keine Frist haben, aber den Jahresabschluss
blockieren:

- Buchungen ohne Kostenart
- Zahlungseingänge ohne Einheit

Dazu die Kontostände — die Frage „wie viel Geld haben wir" beantwortet weder
Fahrplan noch Einrichtung.

### Konkrete Schritte

1. **Objekt-Arbeitsbereich als Komponente** statt als Seite: den Inhalt von
   `weg/[propertyId]/page.tsx` in eine Komponente ziehen, die **beide** Routen
   rendern — `weg/page.tsx` inline für „selbstverwaltet + ein Objekt" (Muster
   von #36 übernehmen), `weg/[propertyId]/page.tsx` für alle anderen Fälle
   (B&W mit mehreren Objekten). Damit entfällt der Streit
   Weiterleitung gegen Inline-Rendering, und es gibt keine zwei Fassungen.
2. **Meine `redirect()`-Lösung in `weg/page.tsx` fällt weg** — die Variante aus
   #36 ist die zusammengeführte Grundlage.
3. **Arbeitsvorrat kürzen** auf die zwei buchhalterischen Einträge; statt der
   gestrichenen ein Verweis auf den Fahrplan („Was ansteht" auf der Übersicht).
4. **Bereitschaftsprüfung streichen** (MEA-Nenner, Konten, Kostenarten) — das
   macht der `SetupGuide` aus #36 gründlicher und an der richtigen Stelle.
   Der Hinweis auf einen fehlenden MEA-Nenner bleibt nur dort, wo er unmittelbar
   blockiert (Wirtschaftsplan, Jahresabrechnung).
5. **Rückwege der elf Unterseiten** gegen die Entscheidung von #36 prüfen: Zeigen
   sie auf `weg/[propertyId]` oder auf `weg`? Bei „ein Objekt" muss beides zum
   selben Ziel führen, ohne Schleife.
6. **Migrationen**: beide tragen `20260726120000`. Rein additiv, unterschiedliche
   Ordner, Prisma sortiert nach Namen — kein Handlungsbedarf, nur zu wissen.

### Umzug auf die Design-Bausteine (beim selben Rebase)

Die Bausteine aus Stufe 1 liegen auf `claude/admin-menu-reorganization-8o17fx`
(`components/data-display.tsx`, `components/fields.tsx`). Sie sind noch nicht
zusammengeführt — ein Import vorher bricht den Build. Der Umzug gehört deshalb in
denselben Rebase; danach greift die spätere ESLint-Stufe von Anfang an.

| Stelle | heute | künftig |
|---|---|---|
| `weg/[propertyId]/page.tsx` — Kontostände | 2× `<p className="text-3xl font-semibold">` in zwei Karten | `<KeyFigures>` mit zwei `<KeyFigure label value hint>` in **einer** Karte |
| `weg/[propertyId]/page.tsx` — „wichtig" | `<span className="rounded-full bg-amber-100 …">` | `<Badge tone="warning">` |
| `buchhaltung/page.tsx` — „storniert" | roter `<span>` | `<Badge tone="danger">` |
| `buchhaltung/page.tsx` — „fehlt" (Kostenart) | amberfarbener `<span>` | `<Badge tone="warning">` |
| 6 Dateien im WEG-Bereich | rohes `<input type="date">` | `<DateField>` + `toDateInputValue` |

`KeyFigure` bringt sein Etikett selbst mit — die beiden Karten „Laufendes Konto"
und „Erhaltungsrücklage" werden dabei zu einer Karte mit zwei Kennzahlen. Die
Klartextzeile („Das Gesparte für große Reparaturen") wandert in `hint`.

**Offen zu prüfen:** ob die Buchungstabelle auf `DataTable` passt. Sie trägt
Auswahlkästchen, die über das `form`-Attribut zu einem Formular außerhalb der
Tabelle gehören, und je Zeile ein eigenes Storno-Formular. Wenn `Column.render`
das trägt, umziehen; sonst als begründete Ausnahme notieren.

### Was von Block 1 unberührt bleibt

Die Substanz. KP1 (Kostenart nachtragen), KP2 (Storno, Import-Rücknahme),
`statement-lock.ts`, `booking-scope.ts` samt der neun `NOT_REVERSED`-Stellen,
Schema, Migration und Audit-Konstanten berührt #36 an keiner Stelle. Betroffen
ist allein die Einstiegsfläche.

---

## Baureihenfolge

| # | Paket | Abhängigkeit | Migration |
|---|---|---|---|
| KP1 | Kostenart nachtragen | — | nein |
| KP2 | Storno + Import-Korrektur | — | ja (klein) |
| KP3 | Rücklage: Entnahme + Zuführung | KP1 | nein |
| KP4 | Einnahmenseite Wirtschaftsplan | KP3 | ja |
| KP5 | Einzelwirtschaftsplan (PDF) | KP4 | nein |
| KP6 | § 35a Lohnanteil | KP1 | ja |
| KP7 | HeizkostenV-Schutz | — | ja (klein) |
| KP8 | Fortgeltung + geänderter Plan | KP4 | ja (groß) |
| KP9 | Zahlungszuordnung + OPOS | KP8 | ja (groß) |

Block 1 = KP1–KP2, Block 2 = KP3–KP7, Block 3 = KP8–KP9. Nach jedem Block ein
eigener Branch und ein eigener Pull Request.

## Definition of Done je Block

**Block 1:** Eine CSV-importierte Buchung lässt sich einzeln und im Bündel einer
Kostenart zuordnen; eine Jahresabrechnung ohne offene Kostenarten lässt sich
fertigstellen. Eine Fehlbuchung ist stornierbar, der Saldo danach unverändert
korrekt; ein Fehl-Import ist zurücknehmbar. Alles im Audit-Log.

**Block 2:** Eine aus der Rücklage bezahlte Maßnahme verändert die
Abrechnungsspitze nicht. Zuführung folgt dem Planschlüssel. Ein
Wirtschaftsplan mit Mieteinnahmen senkt das Hausgeld. Jeder Eigentümer kann
seinen Einzelwirtschaftsplan als PDF ziehen. § 35a weist Lohnanteile aus oder
sagt, dass keine erfasst sind. Die Zählerverteilung erzwingt die
HeizkostenV-Quote.

**Block 3:** Ohne neuen Beschluss laufen die Sollstellungen weiter; ein
unterjährig geänderter Plan ist abbildbar. Eine Teilzahlung wird gezielt einer
Sollstellung zugeordnet, die Mahnung nennt den korrekten Betrag, die OPOS-Liste
zeigt die Alterung.

Durchgehend: `prisma migrate`, `next build` und `npm test` grün; neue Logik in
`src/lib/weg/` mit Vitest abgedeckt; Selbstentscheidungen in `DECISIONS.md`.
