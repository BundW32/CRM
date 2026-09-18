# Umsetzungsplan — Rückmeldung Haneklaus (Produkttest September 2026)

Stand: 18.09.2026 · Basis: Fragen von Herrn Haneklaus vom 16.09.2026 und die
dazu versendete Antwort (zehn Zusagen, zwei Prüfpunkte). Alle Befunde sind gegen
den Code vom 14.09.2026 (PR #117) geprüft. Format und Konventionen wie in
[`PLAN-WEG-Finanzkorrekturen.md`](./PLAN-WEG-Finanzkorrekturen.md).

Kein Neubau — jedes Paket erweitert Bestehendes. Was die Antwort dem Kunden
zugesagt hat, steht hier je Paket unter „Zusage".

---

## 0. Was der Test ergeben hat

Der Kunde hat mit einer echten Kostenart („Ista Einzelabrechnung"), echten
Buchungen und den Abrechnungs-PDFs gearbeitet. Seine Befunde sind alle im Code
nachvollziehbar; keiner ist ein Bedienfehler.

| Nr. | Befund des Kunden | Ursache im Code |
|---|---|---|
| 1 | Beleg lässt sich nicht an eine importierte Buchung hängen | `name="beleg"` gibt es nur in `BuchungForm.tsx`; `belegStoredName` wird ausschließlich in `createBooking` geschrieben |
| 2 | Leer gelassene Einheiten bekommen 0,00 € und die Zeile steht auf jeder Einzelabrechnung | `saveManualAmounts` schreibt `raw === "" ? 0` für **jede** Einheit; `einzelabrechnung-pdf.ts` filtert `costRows` nicht nach `shareCents > 0` |
| 3 | Kein Weg, eine Ausgabe nur einer Einheit zuzuordnen | `Booking.unitId` ist nur Zahlungszuordnung (Hausgeld); `statement-service.ts` gruppiert Ausgaben ausschließlich nach `costTypeId`/`accountId` |
| 4 | „Festbetrag" und „Individuell je Einheit" nicht unterscheidbar | Beide stehen in `MANUAL_KEYS`, in `advanceWeightsForKey` und in `anteilVon` im selben Zweig — funktional identisch |
| 5 | § 35a-Anteil wird bei Festbetrag/Individuell nicht verteilt | `computeLaborShares` überspringt Zeilen mit `!row.perUnit` oder `laborShareType === "KEINE"` stumm; `perUnit` ist bei manuellen Schlüsseln `null`, bis die Summe stimmt |
| 6 | Keine Trennung umlagefähig / nicht umlagefähig, kein § 35a je Kostenart | `CostType.recoverableBetrKV` wird nur in `operating-costs.ts` gelesen; `einzelabrechnung.ts` kennt nur zwei § 35a-Summen |
| 7 | Einzelwirtschaftsplan ohne Umlageschlüssel-Kopf und ohne IBAN | `wirtschaftsplan-pdf.ts` gibt nur `distributionKeyLabels[...]`; `umlagebasisZeilen` wird dort nicht aufgerufen; IBAN nur in `mahnung.ts` |
| 8 | Zahlung doppelt nach „Als bezahlt buchen" + Import | Import dedupliziert nur über `dedupeHash`; manuelle Buchungen haben `dedupeHash = null` |
| 9 | Kein Inaktivitäts-Timeout | `session.ts`: JWT mit fester Laufzeit `SESSION_DAYS = 7`, kein Renewal, kein Idle-Fenster |
| 10 | Kein Handbuch | Nur `<Tipp>`, Glossar, Tour, Hilfe-Lasche; keine `/hilfe`-Seite |

## Harte Prinzipien

- **Keine Zahl aus dem Nichts.** Wo ein Anteil nicht berechenbar ist (fehlende
  Verteilung, fehlendes § 35a-Kennzeichen), sagt die Oberfläche warum — sie
  rechnet nicht mit 0 weiter.
- **Snapshot-Treue.** Fertige Jahresabrechnungen (`AnnualStatement.snapshot`)
  werden nicht rückwirkend anders gerendert. Jede Änderung am PDF-Layout muss
  mit alten Snapshots umgehen (fehlende Felder = altes Verhalten).
- **Zero-Key bleibt.** Kein Paket führt eine Bankanbindung oder einen neuen
  Drittdienst ein.
- **Migrationen handgeschrieben** im Ordner `prisma/migrations/<timestamp>_<name>`
  (Repo-Konvention, DECISIONS Nr. 8), additiv, nie destruktiv.
- **`npm run pruefung`** (tsc, eslint, vitest) muss vor jedem Push grün sein.
  Reine Rechenlogik bekommt Unit-Tests neben der bestehenden Testdatei.

---

## Block A — Buchhaltung: Belege und Abgleich

### A1 — Beleg nachträglich an jede Buchung anhängen

**Zusage:** „Beleg an jede vorhandene Buchung anhängen, auch an importierte,
mit Belegerkennung." Das ist der Punkt, der den Rechnungs-Workflow des Kunden
(Varianten 1 und 2b) überhaupt erst rund macht.

Dateien:
- `src/app/(portal)/verwaltung/weg/[propertyId]/buchhaltung/actions.ts` — neue
  Server-Action `attachBeleg(formData)`: lädt die Buchung über
  `requireWegProperty`-Scope, prüft `belegStoredName == null` (kein stilles
  Überschreiben; Ersetzen nur mit ausdrücklichem `ersetzen=ja`), speichert per
  `saveUpload(file, DOCUMENT_TYPES)` wie in `createBooking` (Z. 177–188) und
  schreibt die drei `beleg*`-Felder. Audit `WEG_BOOKING_BELEG_ATTACHED` (neu in
  `AUDIT`).
- `src/app/(portal)/verwaltung/weg/[propertyId]/buchhaltung/page.tsx` — in der
  Spalte „Beleg" (Z. 838–848) statt „—" ein Knopf „Beleg anhängen", der ein
  kleines Formular (Datei + Senden) einblendet. Gesperrt für Stornopaare,
  Umbuchungen und abgeschlossene Wirtschaftsjahre, dieselbe Sperrlogik wie
  `assignCostType`.
- `src/components/beleg-erkennung-block.tsx` — wiederverwenden: Nach dem Lesen
  der Datei werden Betrag und Datum mit der Buchung verglichen; bei Abweichung
  erscheint ein Hinweis („Rechnung über 1.240,00 €, Buchung über 1.200,00 €"),
  angehängt wird trotzdem. Ist an der Buchung noch kein Lohnanteil § 35a
  erfasst und die Erkennung liefert einen, wird er vorgeschlagen (`setLaborShare`
  bleibt der Schreibweg).
- Belegeinsicht der Eigentümer (`(portal)/finanzen/page.tsx`) und Export
  (`buchhaltung/export/route.ts`, Spalte `hatBeleg`) brauchen keine Änderung.

Dazu die Auswertung, die in `REVIEW-WEG-Buchhaltung.md` D6 offen ist: ein
Filter „Ausgaben ohne Beleg" in der Buchungsliste (URL-getrieben über die
`FilterBar`, wie alle Filter). Er macht den neuen Knopf auffindbar.

Marketing: `src/app/funktionen/finanzen/page.tsx` Z. 100 („Belege direkt an die
Buchung anhängen") wird damit wahr — Text unverändert lassen.

Kein Schema-Delta. Tests: eine Aktion-Prüfung im vorhandenen Muster für
`assignCostType` (Scope, Sperren, Doppel-Anhängen).

### A2 — Abgleich Bankimport gegen manuell gebuchte Zahlungen

**Zusage:** „Der Abgleich zwischen Import und manuell gebuchter Zahlung kommt
zusammen mit dem Beleg-Nachtrag."

Zwei Stufen, beide in `buchhaltung/actions.ts` und `ImportClient.tsx`:

1. **Erkennen.** In `importCsvAction` nach der `dedupeHash`-Deduplizierung
   (Z. 736–747) ein zweiter Durchgang: Für jede zu importierende Zeile werden
   manuelle Buchungen (`dedupeHash: null`) desselben Kontos gesucht mit
   gleichem Betrag, gleicher Richtung und Buchungstag ±5 Tage, die noch
   keinen Importtreffer haben. Reine, getestete Funktion
   `findeManuelleZwillinge(parsedRows, manuelleBuchungen)` in einer neuen
   Datei `src/lib/weg/import-abgleich.ts`. Treffer werden in der Vorschau
   (Schritt 2) als eigene Gruppe gezeigt: „3 Umsätze passen zu Buchungen,
   die Sie schon von Hand erfasst haben."
2. **Entscheiden.** Je Treffer ein Radio: **„Zusammenführen"** (Standard:
   der Import schreibt `dedupeHash`, `reference`, `counterparty` und
   `importBatchId` **auf die vorhandene manuelle Buchung** statt eine neue
   anzulegen — Beleg, Kostenart, Lohnanteil und Verbindlichkeits-Bezug
   bleiben erhalten) oder **„Trotzdem neu anlegen"** (echte zweite Zahlung).
   Die Entscheidung geht als `zwilling_<dedupeHash>=merge|neu` mit, der
   Server rechnet den Treffer neu (dasselbe Prinzip wie bei den
   Zuordnungsvorschlägen: nichts aus dem Browser ungeprüft übernehmen).

Zusätzlich in `src/lib/weg/kontenabstimmung.ts` eine sechste `VerdachtArt`
`doppelt-erfasst`: zwei Ausgaben gleicher Höhe innerhalb von fünf Tagen, eine
davon manuell, eine importiert. Damit nennt die Kontendiagnose am Jahresende
die wahrscheinlichste Ursache, statt nur die Abweichung.

Kein Schema-Delta (`dedupeHash` ist bereits nullable und unique je Konto).
Tests: `import-abgleich.test.ts` (Toleranzfenster, Richtung, mehrere
Kandidaten, kein Doppeltreffer).

### A3 — Verbindlichkeit kennt ihre Zahlung

Kleiner Vorgriff, den A1 und A2 brauchen: `Verbindlichkeit.bookingId String?`
(Relation auf `Booking`, `onDelete: SetNull`). `createBooking` setzt es beim
„Als bezahlt buchen"-Pfad (Z. 238–251) statt nur den Audit-`meta.bookingId`
zu schreiben; `toggleBeglichen` lässt es leer. Die Verbindlichkeiten-Liste
verlinkt auf die Buchung. Migration `20260918…_verbindlichkeit_booking`.

---

## Block B — Verteilung je Einheit

### B1 — Leer heißt „nicht beteiligt"

**Zusage:** „Ein leeres Feld heißt künftig ‚nicht beteiligt', und eine
Einheit ohne Anteil sieht die Position in ihrer Einzelabrechnung nicht mehr."

- `jahresabrechnung/actions.ts` `saveManualAmounts` (Z. 105–127): Leerfeld
  → **kein** `upsert`, sondern `deleteMany` für diese Einheit; nur gefüllte
  Felder (auch „0,00") schreiben einen `StatementUnitAmount`. Die
  Summenprüfung in `annual-statement.ts` (Z. 286–293) bleibt unverändert —
  sie rechnet ohnehin nur über vorhandene Datensätze.
- `jahresabrechnung/[statementId]/page.tsx` (Z. 703–716): Platzhalter von
  „0,00" auf „nicht beteiligt", Hinweistext ergänzen: „Leer = nicht
  beteiligt. 0,00 = beteiligt mit null Euro."
- `src/lib/weg/einzelabrechnung-pdf.ts` (Z. 62–71): `costRows` filtern auf
  `r.perUnit!.has(u.id)` — nicht auf `shareCents > 0`, denn eine bewusst
  mit 0,00 beteiligte Einheit soll die Zeile sehen. Damit `perUnit` diese
  Unterscheidung tragen kann, legt `computeStatement` bei manuellen
  Schlüsseln die Map nur mit den vorhandenen Einheiten an (`new Map(manual)`
  tut das bereits); bei strikten Schlüsseln bleibt sie vollständig.
- Bildschirmtabelle „Einzelabrechnungen" (`page.tsx` Z. 824 ff.): zeigt für
  nicht beteiligte Einheiten „—" statt „0,00 €".
- `einzelabrechnung.ts`: Wenn eine Einheit dadurch weniger Positionen hat
  als die Gemeinschaft, ein Satz unter der Tabelle: „Positionen, an denen
  Ihre Einheit nicht beteiligt ist, sind nicht aufgeführt."

Snapshot-Treue: alte Snapshots haben für jede Einheit einen Eintrag (auch
0) — sie rendern unverändert.

Dazu der Hinweis aus `REVIEW-WEG-Buchhaltung.md` Z. 465–468: Die Prüfliste
sagt bei unvollständiger Verteilung künftig „erfasst X von Y — Y bis Z fehlen
noch" mit Link zur Verteilmaske, statt nur „Verteilung offen".

### B2 — Direktzuordnung einer Ausgabe an eine Einheit

**Zusage:** „Beim Buchen wählen Sie die Einheit, und nur diese Einheit sieht
die Position."

Datenmodell: `Booking.unitId` bleibt die Zahlungszuordnung — es wird **nicht**
überladen. Neu: `Booking.directUnitId String?` (Relation auf `Unit`,
`onDelete: SetNull`, Index). Migration `20260918…_booking_direct_unit`.

- `BuchungForm.tsx`: bei Art = Ausgabe ein optionales Select „Nur für eine
  Einheit" (Einheiten des Objekts). Hinweis darunter: „Die Ausgabe wird
  nicht umgelegt, sondern dieser Einheit vollständig in Rechnung gestellt."
  `createBooking` validiert, dass die Einheit zum Objekt gehört.
- `assignCostType` (Massenzuordnung) bekommt dasselbe Select, damit auch
  importierte Buchungen direkt zugeordnet werden können.
- `src/lib/weg/statement-service.ts` (Z. 167–179): das `groupBy` nimmt
  `directUnitId` mit auf. Für Buchungen mit `directUnitId` entsteht je
  Kostenart eine zusätzliche `StatementCostRow` mit `distributionKey:
  "DIREKT"` und `perUnit = Map([[unitId, betrag]])`. `DistributionKey` wird
  um `DIREKT` erweitert (nur Anzeige/Verteilung, **nicht** an `CostType`
  wählbar — die Stammdaten-Selects filtern ihn aus).
- `annual-statement.ts`: `DIREKT`-Zeilen werden nicht geprüft und nicht
  gewichtet; `computeLaborShares` verteilt den Lohnanteil entlang `perUnit`
  wie bisher — landet also vollständig bei der Einheit.
- `umlagebasis.ts` `anteilVon`: `DIREKT` → `null` (kein Kopfblock-Eintrag);
  `labels.ts`: „Direkt zugeordnet".
- Einzelabrechnung: Zeile erscheint nur bei der betroffenen Einheit (folgt
  aus B1), Schlüsselspalte „Direkt zugeordnet", Gesamtkosten = Ihr Anteil.
- Wirtschaftsplan: Direktbuchungen fließen nicht in die Vorjahres-Istwerte
  (`economic-plan.ts`, Istwerte je Kostenart) — sie sind kein
  Gemeinschaftsaufwand.
- Betriebskostenabrechnung (`operating-costs.ts`) übernimmt den
  Einheitsanteil wie jede andere Zeile.

Tests: `annual-statement.test.ts` um den Fall „eine Direktbuchung + eine
Gemeinschaftsbuchung auf derselben Kostenart" erweitern.

### B3 — Festbetrag und Individuell zusammenführen

**Zusage:** „Wir fassen die beiden zu einem Schlüssel zusammen."

Kein Enum-Wert wird gelöscht (Bestandsdaten, Snapshots). Stattdessen:

- `labels.ts`: `INDIVIDUELL` → „Betrag je Einheit (manuell erfassen)";
  `FESTBETRAG` behält sein Label, wird aber in beiden Stammdaten-Selects
  (`stammdaten/page.tsx` Z. 711–718 und 814–818) **nicht mehr angeboten**.
- `stammdaten/actions.ts`: eingehendes `FESTBETRAG` wird auf `INDIVIDUELL`
  gemappt; eine einmalige Daten-Migration (SQL in der Migration von B2)
  setzt `CostType.distributionKey = 'INDIVIDUELL' WHERE = 'FESTBETRAG'`.
- `cost-catalog.ts`: Katalogeinträge prüfen, keiner darf `FESTBETRAG`
  vorbelegen.
- Alle Codestellen, die beide nennen (`MANUAL_KEYS`, `advanceWeightsForKey`,
  `anteilVon`, `sonderumlagen/keys.ts`), bleiben — sie behandeln den alten
  Wert weiter korrekt.
- Erklärtext am Select: „Für Beträge, die nicht nach Schlüssel verteilt
  werden, sondern die Sie je Einheit eintragen (z. B. aus der
  Messdienst-Abrechnung). Für Kosten einer einzelnen Einheit: Direktzuordnung
  beim Buchen."

### B4 — § 35a: sagen, warum der Anteil fehlt

**Zusage:** „Das Portal wird künftig direkt an der Kostenart sagen, warum der
Lohnanteil noch fehlt, und das § 35a-Kennzeichen beim Anlegen der Kostenart
abfragen."

- `annual-statement.ts` `computeLaborShares` (Z. 602): der stumme `continue`
  wird zu einem Befund. Neue Rückgabe `laborHinweise: Map<costTypeId,
  "verteilung-offen" | "kennzeichen-fehlt">`: Zeile hat Lohnanteil
  (`laborBaseCents > 0` oder `laborShareCents` an Buchungen) **und**
  (`!perUnit` oder `laborShareType === "KEINE"`). Die Prüfliste zeigt sie
  als nicht-blockierende Warnung: „Handwerkerrechnung Dach: 1.200 €
  Lohnanteil erfasst, aber die Kostenart ist nicht als Handwerkerleistung
  gekennzeichnet — der Anteil erscheint nicht auf der Steuerbescheinigung."
  mit Link zu den Stammdaten bzw. zur Verteilmaske.
- `stammdaten/page.tsx` Anlegen-Formular (Z. 832): das Select
  `laborShareType` bekommt eine Erklärung und steht direkt neben dem
  Schlüssel; beim Katalog-Import (`adoptCostCatalog`) ist es bereits
  vorbelegt — prüfen, dass Handwerker-/Hausmeister-Einträge nicht auf
  `KEINE` stehen.
- `BuchungForm.tsx`: wählt der Verwalter eine Kostenart mit `laborShareType
  === "KEINE"` und trägt einen Lohnanteil ein, erscheint sofort der Hinweis
  „Diese Kostenart ist nicht als § 35a-Leistung gekennzeichnet" (Client,
  über die schon geladene Kostenartenliste).

Tests: `computeLaborShares` mit `perUnit = null` und mit `KEINE` liefert
jeweils den Hinweis statt nichts.

---

## Block C — Dokumente

### C1 — Einzelabrechnung: umlagefähig / nicht umlagefähig, § 35a je Kostenart

**Zusage:** „Zwei Blöcke mit Zwischensummen, Ihre Screenshots der bisherigen
Abrechnung sind die Vorlage" und „§ 35a je Kostenart mit Gesamtbetrag und
Schlüssel; eigenes Blatt für den Steuerberater."

- `statement-service.ts` `StatementCostRow` bekommt `recoverableBetrKV:
  boolean` (aus `CostType`, beim Fertigstellen im Snapshot eingefroren; alte
  Snapshots ohne Feld → ein Block wie bisher).
- `src/lib/weg/einzelabrechnung-pdf.ts`: `costRows` in `umlagefaehig` und
  `nichtUmlagefaehig` teilen, je Block `summeGesamtCents` / `summeAnteilCents`.
- `src/lib/documents/einzelabrechnung.ts` (Z. 118–135): zwei Tabellen mit
  Überschriften „Umlagefähige Kosten (BetrKV)" und „Nicht umlagefähige
  Kosten" und je einer Zwischensummenzeile, danach „Ihr Kostenanteil
  gesamt". Schlüsselspalte nur noch das Label (Kundenwunsch: kein
  Zähler/Nenner mehr in den Positionen; `schluesselMitAnteil` bleibt für den
  Kopfblock). Heizkosten behalten den HeizkostenV-Text.
- § 35a-Abschnitt (Z. 153–207) wird zur Tabelle: je Kostenart mit
  `laborShareType ≠ KEINE` eine Zeile „Kostenart · Umlageschlüssel ·
  Gesamtbetrag der Gemeinschaft · begünstigter Lohnanteil gesamt · Ihr
  Anteil", Zwischensummen haushaltsnah / Handwerker, Zeile „davon Lohnanteil
  nicht erfasst" wie bisher. Dafür liefert `computeLaborShares` zusätzlich
  eine Aufschlüsselung je Kostenart (`laborByCostType`).
- Neues PDF `src/lib/documents/steuerbescheinigung.ts` + Route
  `…/jahresabrechnung/[statementId]/steuerbescheinigung/pdf?unit=…` (Verwalter)
  und unter `/finanzen` (Eigentümer, nur FERTIG): ein Blatt je Einheit mit
  derselben Tabelle, Absender, Wirtschaftsjahr, Hinweis „ersetzt keine
  Steuerberatung; maßgeblich ist die Rechnung". Schließt
  `REVIEW-WEG-Buchhaltung.md` C2.

Tests: PDF-Satzspiegel-Test nach dem Muster der vorhandenen
`einzelabrechnung`-Prüfung (Seitenumbruch bei 30 Kostenarten).

### C2 — Einzelwirtschaftsplan: Umlageschlüssel im Kopf, Bankverbindung

**Zusage:** „Den Block ‚Grundlage der Verteilung' übernehmen wir in den
Einzelwirtschaftsplan" und „Bankverbindung, Verwendungszweck und Fälligkeit".

- `src/lib/weg/wirtschaftsplan-pdf.ts` `buildEinzelwirtschaftsplanPdf`:
  `Umlagebasis` laden (dieselbe Quelle wie `statement-service.ts`, Funktion
  dort in `umlagebasis.ts` herausziehen, falls noch nicht exportiert) und je
  Einheit `umlagebasisZeilen(positionen, basis, u.id)` mitgeben. Positionen
  mit `VERBRAUCH`/`INDIVIDUELL`/`FESTBETRAG` bekommen im Kopf eine eigene
  Zeile „Vorschuss nach Miteigentumsanteilen — die Jahresabrechnung
  korrigiert centgenau" (der Satz aus `wirtschaftsplan/[planId]/page.tsx`
  Z. 386–392).
- `src/lib/documents/einzelwirtschaftsplan.ts`: Block „Grundlage der
  Verteilung" vor der Tabelle, gleiche Zeichenroutine wie in
  `einzelabrechnung.ts` Z. 95–116 (in `documents/umlagebasis-block.ts`
  auslagern, damit es eine Quelle bleibt).
- IBAN: `EinzelwirtschaftsplanInput` bekommt `bank?: { inhaber, iban }` aus
  dem ersten aktiven GIRO-`LedgerAccount` des Objekts (Leseweg wie
  `hausgeld/mahnung/[mahnungId]/pdf/route.ts` Z. 38, 74–75; Lesen beim
  Rendern, nicht speichern — DECISIONS Nr. 32). Unter dem Panel „Monatliches
  Hausgeld" (Z. 161–163): „Bankverbindung der Gemeinschaft: <Inhaber>,
  IBAN …, Verwendungszweck: Hausgeld <Einheit>". Ohne IBAN entfällt der
  Block, und die Bildschirmseite zeigt den Hinweis „IBAN in den Stammdaten
  hinterlegen, damit sie auf dem Wirtschaftsplan steht".
- Gesamtwirtschaftsplan (`wirtschaftsplan.ts`) bekommt den Kopfblock nicht —
  dort steht die Verteilung je Einheit ohnehin in der Tabelle.

Kein Schema-Delta.

---

## Block D — Zugang und Hilfe

### D1 — Inaktivitäts-Timeout je Konto

**Zusage:** „Einen einstellbaren Inaktivitäts-Timeout je Konto nehmen wir auf."

- Schema: `User.idleTimeoutMinutes Int?` (null = aus). Migration
  `20260918…_user_idle_timeout`. Auswahl unter „Konto"
  (`(portal)/konto/page.tsx`, neben der MFA-Karte): aus / 15 / 30 / 60 Minuten.
- `src/lib/session.ts`: das JWT bekommt zusätzlich `lat` (last activity).
  `getSession` prüft: ist `idleTimeoutMinutes` gesetzt und `now − lat` größer,
  wird die Session verworfen (wie `tokenWiderrufen`). Liegt die letzte
  Aktivität mehr als 60 s zurück, wird das Cookie mit frischem `lat` neu
  gesetzt (gleitend, ohne die 7-Tage-Obergrenze zu verlängern — `exp` bleibt).
  Das Neusetzen passiert nur in Server-Actions/Route-Handlern, nicht beim
  Rendern (Next erlaubt `cookies().set` nicht in Server Components): dafür
  ein kleiner `proxy.ts`-Zweig, der auf Anfragen an `/(portal)`-Pfade das
  Cookie erneuert.
- Nach Ablauf: Redirect auf `/login?grund=inaktiv` mit Hinweis „Sie wurden
  nach X Minuten ohne Aktivität abgemeldet."

Tests: reine Prüffunktion `istInaktiv(lat, minutes, now)` in
`session.test.ts`.

### D2 — Handbuch, Kapitel „Rechnungen" zuerst

**Zusage:** „Das Kapitel ‚Rechnungen' schreiben wir als Erstes, und Ihre drei
Varianten sind die Gliederung."

- Neue Route `src/app/(portal)/hilfe/page.tsx` (der Ordner existiert mit
  `actions.ts`) + Unterseiten `hilfe/[kapitel]/page.tsx`. Inhalt als
  Markdown-Dateien unter `src/content/hilfe/*.md`, gerendert über eine kleine
  Server-Komponente (kein CMS, kein Drittdienst). Menüpunkt „Hilfe" in
  `app-nav.ts` für alle Rollen (Konvention: ein Eintrag dort, damit er auch in
  der ⌘K-Palette erscheint).
- Erstes Kapitel `rechnungen.md` mit den drei Fällen aus der Kundenmail:
  1. Lastschrift/schon überwiesen → Kontoauszug importieren → Kostenart →
     Beleg anhängen (A1).
  2. Rechnung liegt vor, wird jetzt überwiesen → „Buchung erfassen" mit
     Rechnung, Buchungstag = Überweisungstag.
  3. Rechnung liegt vor, wird später bezahlt → Verbindlichkeit → „Als bezahlt
     buchen" oder nach Import „als beglichen markieren"; Hinweis auf den
     Abgleich (A2).
  Je Fall Screenshots aus der laufenden App (Playwright-Aufnahme wie im
  `werbevideo`-Skill, aber Standbilder).
- Die `<Tipp>`-Texte auf `verbindlichkeiten/page.tsx` und
  `verbindlichkeiten/import/page.tsx` verlinken auf das Kapitel; damit ist
  die Erklärung auch für Nutzer mit `showHints = false` erreichbar.
- Folgekapitel (nicht in diesem Plan): Jahresabrechnung, Wirtschaftsplan,
  Versammlung.

---

## Ausdrücklich **nicht** in diesem Plan

- **Passkeys (WebAuthn)** — dem Kunden als „in Prüfung" genannt. Braucht eine
  Bibliothek (`@simplewebauthn/server`), ein neues Credential-Modell und eine
  Entscheidung zum Verhältnis zur bestehenden TOTP-MFA. Eigener Plan.
- **Überweisungsdatei pain.001** — ebenfalls „in Prüfung". Technisch das
  Gegenstück zu `weg/sepa.ts` (pain.008); braucht die Gläubiger-IBAN aus der
  Rechnung, die die Belegerkennung heute bewusst **nicht** liest („Keine
  IBAN"). Erst nach A1/A3 sinnvoll, dann eigener Plan inkl.
  Datenschutzprüfung.
- Backup-Runbook, Sentry, Cookie-Hinweis in der Datenschutzerklärung — das
  sind Betreiber-Aufgaben aus `CHECKLISTE-Werbestart.md`, keine Codepakete.

## Reihenfolge und Aufwand

| Reihenfolge | Paket | Warum zuerst | Aufwand |
|---|---|---|---|
| 1 | A3 Verbindlichkeit ↔ Buchung | kleine Migration, Voraussetzung für A1/A2 | ½ Tag |
| 2 | A1 Beleg nachträglich | größte Lücke im Kundenworkflow, unabhängig von B | 1 Tag |
| 3 | B1 Leer = nicht beteiligt | kleiner Eingriff, große Wirkung auf die PDFs | 1 Tag |
| 4 | B4 § 35a-Hinweise | rein additiv, macht B2/C1 prüfbar | ½ Tag |
| 5 | B2 Direktzuordnung | Schema + Rechenkern, baut auf B1 auf | 2 Tage |
| 6 | B3 Schlüssel zusammenführen | Datenmigration in derselben Migration wie B2 | ½ Tag |
| 7 | C1 Einzelabrechnung + Steuerbescheinigung | braucht B1/B2/B4 im Rechenkern | 2 Tage |
| 8 | C2 Einzelwirtschaftsplan | unabhängig, teilt sich den Kopfblock mit C1 | 1 Tag |
| 9 | A2 Import-Abgleich | eigene Logik, unabhängig testbar | 1½ Tage |
| 10 | D1 Inaktivitäts-Timeout | unabhängig | 1 Tag |
| 11 | D2 Hilfe/Handbuch | nach A1/A2, damit die Anleitung den neuen Stand zeigt | 1½ Tage |

Gesamt rund 12½ Arbeitstage. Jedes Paket ist ein eigener PR mit grünem
`npm run pruefung`; A1 und B1 zuerst ausliefern, damit der Kunde sie in seiner
Testphase noch ausprobieren kann.

Nach jedem Paket: Eintrag in `portal/DECISIONS.md` (fortlaufende Nummer) und
Abgleich mit den Zusagen in der Kundenantwort vom 17.09.2026.
