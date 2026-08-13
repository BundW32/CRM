# Fehleranalyse & Behebungsplan — Notiz vom 13.08.2026

Grundlage ist die Durchgangs-Notiz aus dem laufenden Betrieb. Jeder Punkt wurde
im Quelltext nachverfolgt; unten steht **was** kaputt ist, **warum**, und **wer
es repariert**. Die Arbeit ist auf sieben Chats aufgeteilt, die parallel laufen
können — die Dateizuständigkeiten überschneiden sich bewusst nicht.

---

## Teil A — Befund je Notizpunkt

### 1. CSV-Import: „Spalten konnten nicht automatisch erkannt werden"

**Wo:** `src/lib/weg/bank-import.ts` (`parseCsv`, `guessMapping`),
`…/buchhaltung/actions.ts` (`analyzeCsvAction`), `…/buchhaltung/ImportClient.tsx:147`.

**Ursache — belegt, nicht vermutet.** Am 13.08.2026 wurde die tatsächliche
Datei nachgereicht (`Konto_MO32_136866700_2023.numbers`, in Numbers geöffnete
Fassung von `Konto_MO32_136866700_2023.csv`). Das Numbers-Paket enthält die
Originaldatei byteweise; sie wurde entpackt und gegen den heutigen Parser
laufen gelassen. Ergebnis:

```
Trennzeichen erkannt: ";"
Kopfzeile (= in Wahrheit die erste DATENZEILE):
  ['412920230102U06030979746858737000', '02.01.2023', '+8880,46',
   '02.01.2023', '', 'MVZ RHR Augen<?>rzte GmbH', 'MO 32 Miete + NK …', '', '']
Datenzeilen danach: 390 (von 391)
guessMapping: { date: undefined, amount: undefined, purpose: undefined }
```

**Zwei Befunde, beide reproduziert:**

1. **Die Datei hat gar keine Kopfzeile.** Sie beginnt unmittelbar mit der ersten
   Buchung. `parseCsv` nimmt aber kompromisslos die erste Zeile als Header
   (`const [header, ...body] = rows`). Also wird eine *Buchung* zur Kopfzeile
   erklärt, `guessMapping` findet dort naturgemäß weder „Buchungstag" noch
   „Betrag" noch „Verwendungszweck" — und **die erste Buchung des Jahres wäre
   auch bei manueller Zuordnung still verloren** (390 statt 391). Das ist der
   schwerwiegendere Teil: Er fällt nicht auf.
2. **Die Datei ist Windows-1252-kodiert, nicht UTF-8.**
   `Buffer.from(await file.arrayBuffer()).toString("utf-8")` in
   `analyzeCsvAction:391` ist fest verdrahtet. Gezählt wurden `0xE4` (ä) 51 ×,
   `0xFC` (ü) 38 ×, `0xDF` (ß) 9 ×, `0xF6` (ö) 5 × und `0x80` 2 ×. Das `0x80`
   ist beweisend: In Windows-1252 ist es das **Euro-Zeichen**, in ISO-8859-1 ein
   Steuerzeichen, in UTF-8 überhaupt kein gültiges Byte. **73 von 391 Zeilen**
   tragen nach der UTF-8-Dekodierung Ersatzzeichen im Zahlungspartner oder
   Verwendungszweck — also in genau den Feldern, über die später die
   Einheiten-Zuordnung läuft.

**Das tatsächliche Format** (Volksbank Bochum-Witten, `GENODEM1BOC` — die
Vermutung „Sparkassenformat" beim Erzeugen der Musterdatei war der Grund, warum
das Muster funktionierte und die echte Datei nicht):

| Spalte | Inhalt | Anführungszeichen |
|---|---|---|
| 0 | Umsatzreferenz `412920230102U0603…` | ja |
| 1 | **Buchungstag** `02.01.2023` | nein |
| 2 | **Betrag** `+8880,46` / `-583,10` / `-1.234,56` | nein |
| 3 | Valutadatum `02.01.2023` | nein |
| 4 | leer | ja (`""`) |
| 5 | Zahlungspartner (auf ~27 Zeichen gekürzt) | ja |
| 6 | **Verwendungszweck** | ja |
| 7, 8 | leer | nein |

Alle 391 Zeilen haben exakt 9 Felder, Zeilenende CRLF, Trennzeichen `;`,
gemischte Anführungszeichen, Beträge mit **ausdrücklichem Vorzeichen** (`+`) und
Tausenderpunkt. Datum und Betrag parsen mit den vorhandenen Funktionen
fehlerfrei — `parseSignedEuroToCents` verkraftet das führende `+` bereits.
Gegenprobe über alle Zeilen: 578.891,11 € Einnahmen, 559.007,40 € Ausgaben,
**keine unlesbare Zeile**. Es fehlt also ausschließlich die Erkennung.

Dazu kommt: Der Bildschirm zeigt **nicht**, was erkannt wurde. Ein Blick auf die
gelesene Kopfzeile und die ersten Rohzeilen hätte beide Befunde in Sekunden
sichtbar gemacht.

**Weitere Varianten**, die derselbe Umbau mitnehmen sollte, weil sie im Bestand
deutscher Bankexporte häufig sind: eine Titel-/Zeitraumzeile **vor** der
Kopfzeile (Sparkassen-Internetbanking), UTF-16LE aus Excel-Umwegen,
Trennzeichen-Erkennung nur über die erste Zeile, und getrennte
**Soll-/Haben-Spalten** statt eines Feldes „Betrag".

> **Datenschutz:** Die Originaldatei enthält Klarnamen, IBANs und Beträge einer
> realen Gemeinschaft. Sie liegt **nicht** im Repository. Stattdessen wurde eine
> anonymisierte Fassung mit identischer Byte-Struktur (Windows-1252, ohne
> Kopfzeile, 9 Spalten, CRLF, `+`/`−`-Beträge, `€`-Zeichen als `0x80`) als
> Testdatei abgelegt: `portal/src/test/fixtures/vr-umsatz-ohne-kopfzeile.csv`.

---

### 2. Dateiablage nicht verfügbar / Uploads an einzelne Eigentümer gehen nicht

**Wo:** `src/lib/storage.ts`, `src/lib/weg/ablage-fehler.ts:30`,
`src/app/(portal)/dokumente/actions.ts:52`.

**Ursache:** Die Meldung „Die Dateiablage ist nicht verfügbar" wird genau dann
erzeugt, wenn der Fehlertext `Blob-Store|BLOB_READ_WRITE_TOKEN|Vercel Blob`
enthält. Das heißt in Produktion eines von zweien:

- `BLOB_READ_WRITE_TOKEN` fehlt in der Produktions-Umgebung. Dann greift
  `assertDataUrlFallbackAllowed()` und **jeder** Upload bricht hart ab —
  absichtlich, damit keine Base64-Dateien in Postgres wandern.
- Der Blob-Store ist als **öffentlich** angelegt. `putPrivate()` ruft
  `put(…, { access: "private" })`; ein öffentlicher Store weist das ab.

Das ist **keine Fehlfunktion im Programm, sondern eine Fehlkonfiguration** — und
deckt beide Notizzeilen ab: den Wirtschaftsplan („Dokumente konnten nicht
abgelegt werden") und „Dateien hochladen an einzelne Eigentümer geht generell
nicht". Beides läuft durch dieselbe `saveUpload`/`saveBuffer`-Schicht.

**Zweiter, echter Mangel:** Der Wirtschaftsplan-Weg nennt inzwischen seinen
Grund (`ablageFehlerText`). Die normalen Upload-Formulare tun das **nicht** —
`dokumente/actions.ts:52` fängt mit `catch {}` und leitet auf
`?fehler=datei` um. Der Nutzer sieht „Datei konnte nicht gespeichert werden"
und sucht bei sich. Genau der Fehler, der beim Wirtschaftsplan schon einmal
behoben wurde, steht an zwölf weiteren Stellen noch.

---

### 3. „Nach Vorschau, dann PDF öffnen — Absturz der ganzen Seite"

**Wo:** `src/components/file-preview.tsx`.

„Absturz der ganzen Seite" (nicht Fehlermeldung, nicht leeres Fenster) deutet auf
einen **Tab-Kill durch Speicher**. Der Bau der Vorschau begünstigt das:

- `Array.from({ length: doc.numPages }, …)` legt **für jede Seite** ein
  `PdfPageCanvas` an.
- `near` wird einmal auf `true` gesetzt und **nie zurückgenommen**. Wer einmal
  durchgescrollt hat, hält alle Seiten gleichzeitig als Canvas im Speicher.
- Gerendert wird mit `devicePixelRatio` bis 2 und Zoomstufen bis **3×**. Eine
  A4-Seite bei 800 px Breite × 2 dpr sind ~14 MB Bitmap; bei 3× Zoom das
  Neunfache. Ein Einzelwirtschaftsplan-PDF „alle Einheiten" hat eine Seite je
  Einheit — bei 30 Einheiten reicht das für den Abschuss des Tabs, auf dem
  iPhone deutlich früher.
- Jede Zoomänderung rendert **alle** bereits sichtbaren Seiten gleichzeitig neu
  (`render` hängt an `zoom`), es gibt keine Serialisierung und kein Abbrechen
  laufender Renderaufträge.

Zweitverdächtiger, unabhängig zu prüfen: die Worker-Auflösung
`new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url)` gegen
`pdfjs-dist ^6` (der Kommentar im Code spricht noch von pdf.js 5). Schlägt sie
fehl, rendert pdf.js im Hauptthread — was ebenfalls als „eingefroren/abgestürzt"
wahrgenommen wird.

Fehlt außerdem: eine **Error-Boundary**. Ein Ausnahmefehler in der Vorschau
reißt heute den ganzen React-Baum mit.

---

### 4. „Muster — ersetzt keine Rechtsberatung" unter Wirtschaftsplan und Erhaltungsplanung

**Wo:** 8 Seiten und 2 PDF-Erzeuger, u. a.
`…/wirtschaftsplan/[planId]/page.tsx:191`, `…/erhaltungsplanung/page.tsx:106`,
`src/lib/documents/wirtschaftsplan.ts:143`,
`src/lib/documents/einzelabrechnung.ts:198`.

**Bewertung:** Der Satz ist an der falschen Stelle. Bei einer *Beschlussvorlage*
oder einem *Vertragsmuster* ist er richtig. Unter einem **erzeugten
Wirtschaftsplan** oder einer **Einzelabrechnung** ist er sachlich falsch: Das ist
kein Muster, sondern das Dokument der Gemeinschaft mit deren echten Zahlen. Er
entwertet das Produkt genau dort, wo es liefert.

Trennlinie für die Bereinigung:
- **Entfernen** aus erzeugten Finanzdokumenten (Wirtschaftsplan-PDF,
  Einzelwirtschaftsplan, Einzelabrechnung) und aus den Seitenköpfen von
  Wirtschaftsplan und Erhaltungsplanung.
- **Bleiben** darf er an Textbausteinen, die tatsächlich Vorlagen sind:
  Beschlussvorschlag-Textfelder, `verwaltervertrag`, Musteragenda,
  KI-Transparenzseite.

---

### 5. Prüfpflichten: nur Standard, keine eigenen

**Wo:** `…/[propertyId]/pruefpflichten/page.tsx` + `actions.ts`.

**Bestätigt.** Die Seite kennt genau eine Schreib-Aktion zum Anlegen:
`adoptComplianceCatalog` — sie übernimmt den festen Katalog aus
`src/lib/weg/compliance-catalog.ts`. Ein Formular „eigene Prüfpflicht anlegen"
existiert nicht. Eigene Termine (`catalogKey: null`) entstehen ausschließlich
über den Jahresfahrplan auf der Objekt-Übersicht bzw. über
`verwaltung/wartung/actions.ts` — und werden auf der Prüfpflichten-Seite zwar
angezeigt, aber die Seite sagt nirgends, wo man sie anlegt.

Fehlend außerdem: das Datenmodell trägt keine Handwerker-/Objektzuordnung an
dieser Stelle, kein Turnus-Feld im Anlege-Weg, kein „nicht zutreffend"
(eine WEG ohne Aufzug soll die Aufzugsprüfung ausblenden können, nicht löschen).

---

### 6. Monatliches Hausgeld: Restcents

**Wo:** `src/lib/weg/economic-plan.ts:222` (`monthlyInstallments`),
`src/lib/weg/distribution.ts` (`distributeByWeight`),
`src/lib/weg/due-postings.ts:59`.

**Ist-Zustand:** Der Jahresvorschuss wird über `distributeByWeight` auf 12
gleiche Gewichte verteilt. Die Restcents landen nach Largest-Remainder auf den
**ersten** Monaten. Ergebnis in der Praxis: Januar 250,04 €, Februar–Dezember
250,03 €. Rechnerisch tadellos, im Alltag ein Ärgernis — der Dauerauftrag des
Eigentümers steht auf *einem* Betrag, und die Sollstellung des Januars passt
nie dazu.

**Das ist kein Fehler, sondern eine Entwurfsentscheidung, die revidiert gehört.**
Drei Wege, mit Empfehlung:

| Weg | Wirkung | Bewertung |
|---|---|---|
| (a) Restcents auf den **letzten** Monat statt die ersten | 11 Monate gleich, Dezember weicht ab | Minimaleingriff, löst das Dauerauftrag-Problem nur halb |
| (b) Monatsrate **aufrunden** (auf 10 Cent oder vollen Euro), 12 gleiche Raten | echter Dauerauftrag-Betrag; Überdeckung max. ~12 € p. a. | **Empfehlung** — Überdeckung ist ein Guthaben und fließt über die Abrechnungsspitze zurück |
| (c) Rate glatt, letzter Monat zieht die Überzahlung ab | Summe exakt, 11 Monate gleich | Sonderfall im Dezember; wenig verständlich |

Empfohlen ist **(b)** mit einer Einstellung je Objekt („Hausgeld runden auf:
Cent genau / 10 Cent / voller Euro", Vorgabe **10 Cent**). Der Wirtschaftsplan
weist die Überdeckung dann ausdrücklich aus („Jahresvorschuss 3.000,36 €,
gerundet 12 × 250,10 € = 3.001,20 €, Überdeckung 0,84 €"), und die
Jahresabrechnung verrechnet sie über die Abrechnungsspitze — dafür ist sie da.

**Achtung, Reichweite:** `monthlyInstallments` speist auch `due-postings.ts`
(die echten Sollstellungen), das Wirtschaftsplan-PDF und `plan-validity.ts`
(Fortgeltung über die Jahresgrenze). Der Umbau ist kein Einzeiler.

---

### 7. Buchungsimport: automatische Zuordnungsvorschläge

**Wo:** `…/hausgeld/page.tsx:93` (`suggestUnit`),
`src/lib/weg/payment-allocation.ts` (`schlageZuordnungVor`),
`…/buchhaltung/actions.ts` (`assignCostType`).

**Ist-Zustand — besser als die Notiz vermutet, aber unvollständig:**
- Es **gibt** bereits eine regelbasierte Einheiten-Erkennung für Zahlungseingänge
  (IBAN aus dem SEPA-Mandat → Kurzlabel „WE 01" im Verwendungszweck → eindeutiger
  Nachname). Sie steht aber auf der **Hausgeld**-Seite, nicht im Import — nach
  dem Import sieht man davon nichts.
- Die Anrechnung auf konkrete Sollstellungen (§ 366 BGB) ist mit
  `schlageZuordnungVor` sauber gelöst, wird aber erst ausgelöst, **nachdem** eine
  Einheit zugeordnet wurde.
- Für **Ausgaben** gibt es überhaupt keinen Vorschlag: importierte Bankumsätze
  kommen ohne Kostenart herein und blockieren später die Jahresabrechnung
  („Ausgaben ohne Kostenart" ist ein harter Prüflistenfehler, siehe Punkt 11).

**Der Hebel liegt also nicht bei „KI", sondern zuerst bei drei deterministischen
Regeln**, die kein Modell, keinen Schlüssel und keine Datenübermittlung
brauchen: Betrag trifft offene Sollstellung, Periode aus dem Verwendungszweck
(„Hausgeld 03/2026"), wiederkehrender Zahlungspartner → zuletzt verwendete
Kostenart. Ein KI-Vorschlag (Gemini, wie `src/lib/ai.ts` ihn schon opt-in
gekapselt hat) ist die **zweite** Stufe für den Rest — datenschutzrechtlich nur
mit ausdrücklicher Freigabe und ohne Namen/IBAN im Prompt.

---

### 8. Auswahllisten mit zu wenigen Optionen

**Wo:** exemplarisch `…/antraege/page.tsx:242` — genau zwei Optionen
(`BESCHLUSSANTRAG`, `VERSAMMLUNG`), kein „Sonstiges", kein Freitext.
Betroffen sind auch die Enums `TicketType`, `DocumentCategory`, `MeterType`,
`Trade`, `MaintenanceInterval`, `ContactKind` und ihre Formulare.

**Bewertung:** Teils ist die Beschränkung fachlich richtig (`MajorityType`,
`VoteChoice`, `ManagementType` — dort gibt es kein „Sonstiges"). Teils ist sie
schlicht zu eng. Das Portal hat die Bausteine dafür bereits
(`ComboField`, „Sonstiges" existiert in mehreren Enums) — es fehlt die
konsequente Anwendung plus ein Freitextfeld, das erscheint, sobald „Sonstiges"
gewählt ist.

---

### 9. Eingeloggter Eigentümer kann seine eigenen Daten nicht pflegen

**Wo:** `src/app/(portal)/konto/page.tsx:50–86`.

**Bestätigt.** Die Karte „Ihre Daten" ist eine reine `<dl>`-Anzeige, und darunter
steht wörtlich: *„Änderungen an Name oder E-Mail-Adresse übernimmt die Verwaltung
für Sie."* Die Aktionen in `konto/actions.ts` sind Passwort, Unterschrift,
Zertifikats-Mandat, Hinweis-Schalter — keine Stammdaten.

Das Datenmodell kann längst mehr, als die Oberfläche zeigt: `User` trägt
`firstName`, `lastName`, `salutation`, `phone`, `street`, `zip`, `city`,
`preferredContact`.

**Der einzige heikle Punkt ist die E-Mail-Adresse:** sie ist `@unique` und
zugleich der Anmeldename. Sie darf nicht ohne Bestätigung gesetzt werden, sonst
sperrt ein Tippfehler den Zugang aus oder kapert eine fremde Adresse. Nötig ist
ein Doppel-Opt-in (Token an die neue Adresse, Übernahme erst nach Klick,
Benachrichtigung an die alte Adresse).

---

### 10. Belegeinsicht: lange Liste, „nur nach Jahr" filterbar

**Wo:** `src/app/(portal)/finanzen/page.tsx:122–235` und `:514 ff.`

**Teilweise anders als notiert:** Es gibt bereits eine Freitextsuche (`bq`, über
Text/Verwendungszweck/Zahlungspartner) und Paginierung. Als **Filter** existiert
tatsächlich nur das Jahr (`belegFilters` enthält genau einen Eintrag).

Es fehlen: Kostenart, Konto (Giro/Rücklage), Art (Einnahme/Ausgabe/Umbuchung),
Zeitraum von–bis, „nur mit Beleg", Sortierung (`SortControl` ist im Haus und wird
hier nicht benutzt) und eine Summenzeile über das Filterergebnis. Dass die Suche
existiert, aber nicht als Filter wahrgenommen wird, ist selbst schon ein Befund.

---

### 11. Jahresabrechnung: Prüfliste, Erhaltungsrücklage, blockierter Abschluss

**Wo:** `…/jahresabrechnung/[statementId]/page.tsx:130`,
`…/jahresabrechnung/actions.ts:427–437`, `src/lib/weg/statement-service.ts:336`.

**Die Sperre ist Absicht und funktioniert wie gebaut:**

```ts
const checksOk = view.accounts.length > 0 &&
  view.accounts.every((a) => reportedByAccount.get(a.id) === a.endCents);
const readyToFinalize = view.errors.length === 0 && checksOk;
```

Für **jedes** Konto muss der von Hand eingetragene Endbestand laut Kontoauszug
**auf den Cent** dem gerechneten Endbestand entsprechen. Serverseitig noch
einmal in `finalizeStatement`. Stimmt das Rücklagenkonto nicht, gibt es keinen
Abschluss — und keinen Ausweg.

**„Fehler vom Programm oder von mir?" — sehr wahrscheinlich weder noch, sondern
die fehlende dritte Antwort.** Die Oberfläche zeigt an dieser Stelle ein `✗` und
sonst nichts: **keine Differenz, keine Richtung, keine Ursache.** Genau die drei
Angaben, aus denen man ablesen könnte, was fehlt.

Die typischen Ursachen einer Rücklagen-Abweichung sind auch alle benennbar:
- **Anfangsbestand** (`LedgerAccount.openingBalanceCents`) beim Anlegen des
  Kontos nicht oder falsch gesetzt — dann ist die Differenz über alle Jahre
  konstant.
- Zuführung zur Rücklage wurde als **Ausgabe/Einnahme** statt als **Umbuchung**
  gebucht; nur `UMBUCHUNG` mit `transferOut === false` zählt in
  `reserveTransferCents` (`statement-service.ts:239`).
- **Zinsen** auf dem Rücklagenkonto nicht gebucht.
- Ausgaben, die vom Rücklagenkonto bezahlt wurden, aufs Girokonto gebucht.
- Buchungen mit Datum knapp außerhalb des Wirtschaftsjahres.

Dazu ein zweiter, häufiger Blocker in derselben Prüfliste:
`errors.push("Ausgaben ohne Kostenart: …")` — jede importierte Bankausgabe ohne
Kostenart hält den Abschluss auf. Das ist richtig, aber die Meldung verlinkt
nicht auf die betroffenen Buchungen.

**Zu behalten ist die Härte der Prüfung** — eine Abrechnung, deren Konten nicht
mit dem Kontoauszug übereinstimmen, darf nicht fertig werden. Zu ändern ist,
dass sie ihre Diagnose herausgibt.

---

### 12. SEPA-Lastschrift vorerst entfernen

**Wo:** `…/[propertyId]/lastschrift/` (Seite, Aktionen, XML-Export),
`src/lib/weg/sepa.ts`, Menüeintrag in
`src/app/(portal)/verwaltung/weg/Arbeitsbereich.tsx:99`.

Erfreulich klein geschnitten: **genau ein** Menüeintrag verweist darauf,
zusätzlich ein Satz in `src/lib/assistant-help.ts:49`. Beworben wird die
Funktion allerdings auf den öffentlichen Seiten (`src/app/page.tsx`,
`src/app/funktionen/hausgeld/page.tsx`) — das muss mit, sonst verspricht die
Werbung eine Funktion, die im Portal nicht auffindbar ist.

**Weg:** ausblenden, nicht löschen. Datenmodell (`SepaMandate`,
`Property.sepaCreditorId`), Bibliothek und Tests bleiben; die Route wird
serverseitig gesperrt (nicht nur der Link entfernt).

---

## Teil B — Aufteilung auf sieben Chats

Jeder Chat arbeitet auf einem eigenen Branch, hält sich an `portal/AGENTS.md`
und lässt vor dem Push `npm run pruefung` durchlaufen.

### Dateizuständigkeit (verbindlich, verhindert Konflikte)

| Chat | Gehört exklusiv |
|---|---|
| 1 | `lib/weg/bank-import*`, `…/buchhaltung/**`, `lib/weg/payment-allocation*`, `…/hausgeld/page.tsx` |
| 2 | `lib/storage.ts`, `lib/weg/ablage-fehler*`, alle `saveUpload`-Aufrufstellen, `…/dokumente/**` |
| 3 | `components/file-preview*.tsx` |
| 4 | `…/jahresabrechnung/**`, `lib/weg/annual-statement*`, `lib/weg/statement-service.ts` |
| 5 | `lib/weg/economic-plan*`, `lib/weg/due-postings.ts`, `lib/weg/plan-validity*`, `…/wirtschaftsplan/**`, `lib/weg/wirtschaftsplan-pdf.ts`, `lib/documents/wirtschaftsplan.ts` |
| 6 | `…/konto/**`, `…/finanzen/page.tsx` |
| 7 | `…/pruefpflichten/**`, `…/lastschrift/**`, `weg/Arbeitsbereich.tsx`, `…/antraege/**`, öffentliche Seiten |

Die „Muster — ersetzt keine Rechtsberatung"-Bereinigung (Punkt 4) ist auf die
Besitzer der jeweiligen Datei verteilt: Chat 5 für Wirtschaftsplan, Chat 4 für
die Jahresabrechnung, Chat 7 für Erhaltungsplanung, Prüfpflichten, Lastschrift,
Betriebskosten und CO₂.

Alle sieben können gleichzeitig starten. Einzige Reihenfolge-Empfehlung:
**Chat 2 zuerst anstoßen** — solange die Dateiablage nicht läuft, lässt sich
nichts anderes im Betrieb gegenprüfen.

---

## Chat 1 — Bankimport: Spaltenerkennung und Zuordnungsvorschläge

**Branch:** `claude/bankimport-erkennung`
**Deckt ab:** Notizpunkte 1 und 7

> Im Portal (`/home/user/CRM/portal`) schlägt der CSV-Bankimport bei einer echten
> Bankdatei fehl: „Die Spalten für Buchungstag, Betrag und Verwendungszweck
> konnten nicht automatisch erkannt werden". Eine erzeugte Musterdatei im
> Sparkassenformat funktioniert.
>
> **Die Ursache ist bereits ermittelt und reproduziert** — du musst nicht mehr
> suchen. Die Originaldatei (Volksbank Bochum-Witten, Kontoumsätze 2023) hat
> **zwei** Eigenschaften, mit denen `src/lib/weg/bank-import.ts` nicht umgeht:
>
> 1. **Sie hat überhaupt keine Kopfzeile.** Die Datei beginnt unmittelbar mit der
>    ersten Buchung. `parseCsv` nimmt aber kompromisslos die erste Zeile als
>    Header (`const [header, ...body] = rows`). Deshalb findet `guessMapping`
>    nichts — und, schwerwiegender, **die erste Buchung des Jahres geht still
>    verloren** (390 statt 391 Zeilen), auch wenn der Verwalter die Spalten von
>    Hand zuordnet. Das fällt niemandem auf.
> 2. **Sie ist Windows-1252-kodiert.** `analyzeCsvAction:391` dekodiert fest als
>    UTF-8. Gezählt wurden `0xE4` (ä) 51 ×, `0xFC` (ü) 38 ×, `0xDF` (ß) 9 ×,
>    `0xF6` (ö) 5 × und zweimal `0x80` — das Euro-Zeichen in Windows-1252 und in
>    UTF-8 überhaupt kein gültiges Byte. **73 von 391 Zeilen** tragen danach
>    Ersatzzeichen in Zahlungspartner und Verwendungszweck, also genau in den
>    Feldern, über die später die Einheiten-Zuordnung läuft.
>
> Das tatsächliche Format, 391 Zeilen mit je exakt 9 Feldern, CRLF, Trennzeichen
> `;`, gemischte Anführungszeichen:
>
> | Spalte | Inhalt | in Anführungszeichen |
> |---|---|---|
> | 0 | Umsatzreferenz `412920230102U0603…` | ja |
> | 1 | **Buchungstag** `02.01.2023` | nein |
> | 2 | **Betrag** `+8880,46` / `-583,10` / `-1.234,56` | nein |
> | 3 | Valutadatum | nein |
> | 4 | leer | ja (`""`) |
> | 5 | Zahlungspartner (auf ~27 Zeichen gekürzt) | ja |
> | 6 | **Verwendungszweck** | ja |
> | 7, 8 | leer | nein |
>
> Datum und Betrag parsen mit den vorhandenen Funktionen bereits fehlerfrei —
> `parseSignedEuroToCents` verkraftet das führende `+`. Es fehlt ausschließlich
> die Erkennung.
>
> **Eine anonymisierte Testdatei mit identischer Byte-Struktur liegt bereit:**
> `src/test/fixtures/vr-umsatz-ohne-kopfzeile.csv` — Windows-1252, ohne
> Kopfzeile, 9 Spalten, CRLF, `+`/`−`-Beträge, Tausenderpunkt, `€` als `0x80`,
> Umlaute und ß. Die Originaldatei enthält Klarnamen und IBANs einer realen
> Gemeinschaft und liegt bewusst **nicht** im Repository; lade keine echten
> Kontodaten dorthin nach.
>
> Bau den Import robust, statt nur diese eine Bank zu flicken:
>
> 1. **Zeichensatz erkennen** statt fest UTF-8 (`buchhaltung/actions.ts:391`):
>    BOM für UTF-8/UTF-16LE/BE auswerten; sonst als UTF-8 versuchen und bei
>    Ersetzungszeichen (U+FFFD) oder ungültigen Sequenzen auf **Windows-1252**
>    zurückfallen (nicht ISO-8859-1 — nur CP1252 kennt `0x80` als `€`). Achtung:
>    Der Inhalt reist zwischen den beiden Schritten als Base64 durch das Formular
>    (`contentBase64`); dekodier **einmal** beim Einlesen und reich danach den
>    schon dekodierten Text weiter, sonst wird beim zweiten Durchlauf erneut
>    UTF-8 angenommen und die Korrektur ist wieder weg.
> 2. **Erkennen, dass eine Kopfzeile fehlt.** Trifft die erste Zeile keinen
>    einzigen bekannten Spaltennamen und lässt sie sich zugleich als Datensatz
>    lesen (Datum und Betrag parsen), dann ist sie **keine** Kopfzeile: Alle
>    Zeilen sind Daten, die Spalten heißen „Spalte 1…n". `parseCsv` muss das
>    zurückgeben können — heute kann seine Signatur „ohne Kopfzeile" gar nicht
>    ausdrücken. **Kein Datensatz darf dabei verloren gehen**; sichere das mit
>    einem Test ab, der die Zeilenzahl prüft.
> 3. **Kopfzeile suchen statt annehmen.** Gibt es eine, steht sie nicht immer in
>    Zeile 1: Sparkassen-Internetbanking stellt Titel- und Zeitraumzeilen voran.
>    Die ersten ~15 Zeilen durchsehen und die nehmen, die die meisten bekannten
>    Spaltennamen trifft.
> 4. **Trennzeichen über mehrere Zeilen** bestimmen (häufigste Feldanzahl), nicht
>    nur über die erste — sonst kippt eine Titelzeile die Erkennung auf `,`.
> 5. **Inhaltsbasierte Zuordnung** als vollwertiger Weg, nicht als Notnagel: Über
>    die ersten ~20 Datenzeilen abtasten, welche Spalte durchgängig als Datum
>    parst (bei zweien ist die frühere der Buchungstag, die zweite Valuta),
>    welche durchgängig als vorzeichenbehafteter Betrag, und welche die längste
>    Textspalte ist (Verwendungszweck). Für die vorliegende Datei muss dabei
>    `{ date: 1, amount: 2, purpose: 6, counterparty: 5 }` herauskommen — **das
>    ist dein Abnahmetest.**
> 6. **Synonyme erweitern** für Dateien, die doch eine Kopfzeile haben:
>    „Umsatz in EUR", „Betrag in EUR", „Wert", „Vorgang/Verwendungszweck",
>    „Zahlungsempfänger", „Auftraggeber/Empfänger", „Wertstellung";
>    Umlaut-Varianten normalisieren (ä/ae, ü/ue, ö/oe, ß/ss).
> 7. **Getrennte Soll-/Haben-Spalten** unterstützen: kein Feld „Betrag", aber
>    „Soll" und „Haben" → beide zu einem vorzeichenbehafteten Betrag
>    zusammenführen. `ColumnMapping` entsprechend erweitern.
> 8. **Sichtbar machen, was gelesen wurde.** In `ImportClient.tsx` immer (nicht
>    nur im Fehlerfall) anzeigen: erkannter Zeichensatz, Trennzeichen, „Kopfzeile
>    vorhanden: ja/nein", die ersten drei Rohzeilen. Bei fehlender Erkennung ist
>    das der Unterschied zwischen „ich sehe das Problem" und „es geht nicht".
> 9. **Zuordnung merken:** Das bestätigte Mapping je `LedgerAccount` speichern
>    (samt Zeichensatz und „ohne Kopfzeile") und beim nächsten Import derselben
>    Bank vorbelegen. Neues Feld auf `LedgerAccount` oder eine kleine Tabelle;
>    Migration nicht vergessen. Ein Verwalter importiert monatlich aus derselben
>    Quelle — er soll das genau einmal zuordnen.
>
> **Zweiter Teil — Zuordnungsvorschläge nach dem Import.** Heute liegt die
> Einheiten-Erkennung (`suggestUnit`) auf der Hausgeld-Seite und greift erst
> lange nach dem Import; Ausgaben bekommen gar keinen Vorschlag und blockieren
> später die Jahresabrechnung („Ausgaben ohne Kostenart").
>
> - Zieh `suggestUnit` aus `hausgeld/page.tsx` in ein eigenes Modul
>   (`lib/weg/zuordnung-vorschlag.ts`) mit Unit-Tests.
> - Erweitere es um **Betragstreffer gegen offene Sollstellungen** (`DuePosting`)
>   und um **Periodenerkennung** aus dem Verwendungszweck („Hausgeld 03/2026",
>   „HG März 26"). Nutze `schlageZuordnungVor` aus
>   `lib/weg/payment-allocation.ts` weiter — die Tilgungsreihenfolge ist gelöst.
> - Für **Ausgaben**: Kostenart aus der Historie vorschlagen (gleicher
>   Zahlungspartner/ähnlicher Verwendungszweck → zuletzt verwendete Kostenart).
> - Zeig die Vorschläge direkt in der Import-Vorschau mit einem Gütegrad
>   (sicher/wahrscheinlich/unsicher) und übernimm sie **nur nach Bestätigung**.
>   Nie automatisch buchen.
> - KI ist die **zweite** Stufe, nicht die erste: erst wenn die Regeln nichts
>   finden. Kapsle sie wie `src/lib/ai.ts` (opt-in über eine eigene
>   Umgebungsvariable, ohne Schlüssel passiert nichts), und schick **keine**
>   Namen, IBANs oder Beträge im Klartext — nur den normalisierten
>   Verwendungszweck gegen die Liste der Kostenarten. Wenn du sie einbaust:
>   Datenschutzerklärung und `/ki-transparenz` mitziehen (siehe Skill
>   `wegportal24-datenschutz`).
>
> **Tests.** `src/lib/weg/bank-import.test.ts` erweitern, mit der bereitgelegten
> Testdatei als Kern:
> - Datei ohne Kopfzeile → Mapping `{ date: 1, amount: 2, purpose: 6,
>   counterparty: 5 }`, und **alle** Zeilen kommen als Buchung an (keine geht als
>   vermeintliche Kopfzeile verloren).
> - Windows-1252 → „Augenärzte", „Schließgesellschaft", „€" kommen unversehrt
>   an; kein U+FFFD im Ergebnis.
> - Beträge mit führendem `+`, mit Tausenderpunkt, mit Unicode-Minus.
> - Weiter abzudecken: Titel-/Zeitraumzeile vor der Kopfzeile, UTF-16LE mit BOM,
>   Soll/Haben-Spalten, Komma-Dezimaltrenner bei Semikolon-Feldtrenner.
>
> Zum Nachvollziehen der Diagnose: Das Numbers-Paket ist ein ZIP; die
> Originaldatei liegt byteweise in `Index/CalculationEngine-*.iwa`
> (Snappy-komprimiertes Protobuf). Du brauchst das für die Umsetzung nicht — die
> Befunde oben sind vollständig.
>
> **Melde am Ende zurück, welche Varianten du abdeckst.** Der Betrieb kann dann
> gegen die Originaldatei gegenprüfen.

---

## Chat 2 — Dateiablage reparieren und Upload-Fehler sichtbar machen

**Branch:** `claude/dateiablage`
**Deckt ab:** Notizpunkt 2

> Im Portal (`/home/user/CRM/portal`) schlagen in Produktion **alle** Uploads
> fehl: „Die Dateiablage ist nicht verfügbar" beim Beschließen eines
> Wirtschaftsplans, und Dokumente an einzelne Eigentümer lassen sich generell
> nicht hochladen.
>
> Der Text stammt aus `src/lib/weg/ablage-fehler.ts:30` und wird genau dann
> erzeugt, wenn der zugrundeliegende Fehler `Blob-Store`,
> `BLOB_READ_WRITE_TOKEN` oder `Vercel Blob` enthält. Ursache ist damit die
> Ablage-Konfiguration, nicht die Fachlogik: entweder fehlt
> `BLOB_READ_WRITE_TOKEN` in der Produktionsumgebung (dann greift
> `assertDataUrlFallbackAllowed()` in `src/lib/storage.ts` und bricht bewusst
> hart ab), oder der Vercel-Blob-Store ist **öffentlich** angelegt, während
> `putPrivate()` mit `access: "private"` schreibt.
>
> Deine Aufgaben:
>
> 1. **Diagnose statt Raten.** Bau eine Selbstprüfung der Ablage, erreichbar für
>    Betreiber-Konten (`isPlatformAdminUser`) unter den Einstellungen: prüft, ob
>    ein Token gesetzt ist, ob ein Testupload gelingt, ob der Store privat ist,
>    und nennt bei Fehlschlag die konkrete Ursache samt Behebungsschritt. Ohne
>    Geheimnisse auszugeben — nur „gesetzt/nicht gesetzt".
> 2. **Startprüfung.** In `src/instrumentation.ts` beim Start in Produktion
>    warnen, wenn `VERCEL_ENV === "production"` und kein
>    `BLOB_READ_WRITE_TOKEN` gesetzt ist. Eine Fehlkonfiguration, die erst beim
>    ersten Upload eines Kunden auffällt, ist zu spät.
> 3. **Jeder Upload nennt seinen Grund.** Heute tut das nur der
>    Wirtschaftsplan-Weg (`ablageFehlerText`). Die normalen Formulare fangen
>    stumm — z. B. `src/app/(portal)/dokumente/actions.ts:52` mit `catch {}`
>    und `?fehler=datei`. Zieh `ablageFehlerText` durch **alle**
>    `saveUpload`/`saveBuffer`-Aufrufstellen (`grep -rn "saveUpload" src` findet
>    sie: dokumente, beschluesse, objekte, kontakte, buchhaltung, branding,
>    uebergabe) und zeig den Grund als `<Alert>` am Formular. Halte dich an die
>    Regeln in `portal/AGENTS.md` (Fehler bleiben Banner, nie Toast).
> 4. **Fehlermeldungen verständlich staffeln:** Konfigurationsfehler („liegt am
>    System, nicht an Ihrer Datei"), Dateityp/Größe („diese Datei geht nicht"),
>    Netzwerk („bitte erneut versuchen") — für den Nutzer klar unterscheidbar.
> 5. **Nachtragen ermöglichen.** Wo eine Ablage fehlgeschlagen ist, muss es
>    einen Wiederholen-Weg geben. Für den Wirtschaftsplan gibt es
>    `wiederholeAblage` — prüf, ob die Jahresabrechnung und die
>    Dokumenten-Uploads einen gleichwertigen Weg haben, und ergänze ihn, wo er
>    fehlt.
> 6. **Dokumentieren.** Leg unter `docs/` eine kurze Betriebsanleitung ab: welche
>    Umgebungsvariablen die Ablage braucht, wie ein privater Blob-Store angelegt
>    wird, und woran man die Fehlkonfiguration erkennt.
>
> Wenn du auf die tatsächliche Produktionskonfiguration nicht zugreifen kannst:
> Bau alles Übrige fertig und schreib am Ende genau auf, was der Betreiber im
> Vercel-Dashboard prüfen bzw. setzen muss.
>
> Tests: `src/lib/weg/ablage-fehler.test.ts` erweitern; für die Selbstprüfung
> eigene Tests.

---

## Chat 3 — PDF-Vorschau stabilisieren

**Branch:** `claude/pdf-vorschau`
**Deckt ab:** Notizpunkt 3

> Im Portal (`/home/user/CRM/portal`) stürzt beim Öffnen eines PDFs in der
> Vorschau die ganze Seite ab (Tab weg, nicht nur eine Fehlermeldung). Betroffen
> ist `src/components/file-preview.tsx`, die pdf.js auf Canvas rendert.
>
> Der Bau begünstigt einen Speicher-Abschuss:
>
> - Es wird **für jede Seite** des Dokuments ein `PdfPageCanvas` angelegt
>   (`Array.from({ length: doc.numPages }, …)`).
> - `near` wird einmal auf `true` gesetzt und **nie zurückgenommen** — nach
>   einmaligem Durchscrollen liegen alle Seiten gleichzeitig als Bitmap im
>   Speicher.
> - Gerendert wird mit `devicePixelRatio` bis 2 und Zoom bis **3×**. Eine
>   A4-Seite sind so schnell 14 MB, bei 3× das Neunfache. Ein
>   Einzelwirtschaftsplan „alle Einheiten" hat eine Seite je Einheit.
> - Jede Zoomänderung rendert **alle** sichtbaren Seiten gleichzeitig neu; es
>   gibt keine Serialisierung und keinen Abbruch laufender Renderaufträge
>   (`page.render(...)` liefert ein `cancel()`, das nie benutzt wird).
>
> Zu tun:
>
> 1. **Canvas-Fenster begrenzen.** Nur Seiten in Sichtweite halten; verlässt eine
>    Seite den Bereich, Canvas auf 0×0 setzen und den Platzhalter über
>    `aspect-ratio` stehen lassen. `near` muss auch wieder `false` werden können.
> 2. **Gesamtpixel deckeln.** Ein Budget (z. B. ~80 Megapixel gleichzeitig)
>    einführen; `devicePixelRatio` und Zoom so begrenzen, dass es eingehalten
>    wird — auf dem Telefon strenger als am Schreibtisch.
> 3. **Renderaufträge abbrechen.** Beim Wechsel von Zoom/Sichtbarkeit den
>    laufenden `RenderTask` per `cancel()` beenden, statt einen zweiten daneben
>    zu starten. Rendering serialisieren (höchstens 1–2 gleichzeitig).
> 4. **Error-Boundary.** Die Vorschau in eine React-Error-Boundary setzen, damit
>    ein Fehler dort nie die ganze Seite mitreißt — Rückfall auf
>    „Herunterladen" statt weißer Bildschirm.
> 5. **Sehr große Dokumente behandeln.** Ab einer Schwelle (Seitenzahl oder
>    Dateigröße) nicht automatisch rendern, sondern fragen: „38 Seiten —
>    anzeigen oder herunterladen?"
> 6. **Worker-Auflösung prüfen.** Der Kommentar spricht von pdf.js 5, installiert
>    ist `pdfjs-dist ^6.2.108`. Prüf, ob `pdfjs-dist/legacy/build/pdf.mjs` und
>    der Worker unter Next 16/Turbopack tatsächlich aufgelöst werden und der
>    Worker wirklich startet (`GlobalWorkerOptions.workerSrc`). Läuft er nicht,
>    rendert pdf.js im Hauptthread — das fühlt sich ebenfalls wie ein Absturz an.
>    Falls der Legacy-Build in v6 nicht mehr existiert oder nicht mehr nötig ist:
>    umstellen und den Kommentar richtigstellen.
> 7. **Nachweis.** Reproduziere zuerst mit einem großen erzeugten PDF (z. B.
>    Einzelwirtschaftspläne über viele Einheiten) und dokumentiere im
>    Commit, was tatsächlich abgestürzt ist. Der Skill `run` hilft beim Starten
>    der App; Chromium mit Playwright ist vorhanden.
>
> Achte darauf, dass die Vorschau auf dem Telefon weiter funktioniert — sie ist
> genau dafür gebaut (siehe Kopfkommentar der Datei).

---

## Chat 4 — Jahresabrechnung: Prüfliste, Erhaltungsrücklage, Abschluss

**Branch:** `claude/jahresabrechnung-pruefliste`
**Deckt ab:** Notizpunkt 11 (und der „Muster"-Hinweis in dieser Seite)

> Im Portal (`/home/user/CRM/portal`) lässt sich eine Jahresabrechnung nicht
> fertigstellen. Der Verwalter meldet, die Erhaltungsrücklage sei „falsch", und
> weiß nicht, ob der Fehler beim Programm oder bei ihm liegt.
>
> Die Sperre ist Absicht und arbeitet korrekt
> (`…/jahresabrechnung/[statementId]/page.tsx:130` und
> `…/jahresabrechnung/actions.ts:427`): Für jedes Konto muss der von Hand
> eingetragene Endbestand laut Kontoauszug **auf den Cent** dem gerechneten
> Endbestand entsprechen, sonst kein Abschluss. **Diese Härte bleibt** — eine
> Abrechnung, deren Konten nicht mit dem Kontoauszug übereinstimmen, darf nicht
> fertig werden.
>
> Das Problem ist, dass die Prüfung ihre Diagnose nicht herausgibt: In der
> Kontentabelle steht ein `✗` und sonst nichts. Keine Differenz, keine Richtung,
> keine Ursache, kein Weg zur betroffenen Buchung.
>
> Zu tun:
>
> 1. **Differenz zeigen.** Spalte „Abweichung" mit Betrag und Vorzeichen, dazu
>    ein Satz in Klartext („Der Kontoauszug weist 1.240,00 € mehr aus als die
>    Buchungen ergeben.").
> 2. **Ursachen benennen und prüfen.** Bau eine Diagnose, die die üblichen
>    Verdächtigen aktiv abprüft und nur die nennt, die zutreffen könnten:
>    - Anfangsbestand (`LedgerAccount.openingBalanceCents`) nicht gesetzt —
>      erkennbar daran, dass die Abweichung über mehrere Jahre konstant ist.
>    - Zuführung zur Rücklage als Ausgabe/Einnahme statt als **Umbuchung**
>      gebucht: In `statement-service.ts:239` zählt nur `UMBUCHUNG` mit
>      `transferOut === false` in `reserveTransferCents`. Such nach Buchungen auf
>      dem Rücklagenkonto, die wie eine Zuführung aussehen, aber die falsche Art
>      haben, und nenn sie beim Namen.
>    - Zinsen auf dem Rücklagenkonto nicht gebucht.
>    - Ausgaben, die vom Rücklagenkonto bezahlt wurden, aufs Girokonto gebucht.
>    - Buchungen knapp außerhalb des Wirtschaftsjahres (± 10 Tage), deren Betrag
>      genau die Differenz erklärt — das ist der häufigste Einzeltreffer.
> 3. **Vom Fehler zur Buchung.** Jeder Prüflistenpunkt bekommt einen Link, der
>    die Buchhaltung passend gefiltert öffnet. Das gilt besonders für
>    „Ausgaben ohne Kostenart: …" (`lib/weg/annual-statement.ts:273`) — heute
>    nennt die Meldung eine Summe und lässt den Verwalter suchen.
> 4. **Prüfliste neu gliedern.** Trenn sichtbar: *blockierend* (verhindert den
>    Abschluss), *zu klären* (Hinweis), *erledigt*. Über der Liste eine
>    Fortschrittsanzeige „3 von 5 Punkten offen". Heute stehen Fehler und
>    Hinweise in zwei unverbundenen Alerts.
> 5. **Die Frage beantworten, die der Verwalter stellt.** Über der Prüfliste ein
>    Satz, der ausdrücklich sagt, ob gerade das Programm etwas vermisst oder der
>    Bestand etwas nicht hergibt — und was der nächste Handgriff ist.
> 6. **Erhaltungsrücklage nachvollziehbar machen.** Eine kleine
>    Entwicklungsrechnung im Abschnitt Rücklage: Anfangsbestand + Zuführung (Ist)
>    + Zinsen − Entnahmen = Endbestand, jede Zeile mit der Zahl, aus der sie
>    stammt. Vergleiche `lib/weg/vermoegensbericht.ts`, das die Endbestände schon
>    zusammenzieht.
> 7. **Nebenbei:** In `…/[statementId]/page.tsx:147` steht am
>    Beschlussvorlage-Text „Muster — ersetzt keine Rechtsberatung". Das darf am
>    *Beschlussvorschlag* stehen bleiben, aber prüf, dass es nicht an der
>    Abrechnung selbst oder ihrem PDF klebt — dort ist es sachlich falsch.
>
> Änderungen an der Rechenlogik brauchen Tests in
> `src/lib/weg/annual-statement.test.ts`; für Zugriffs- oder Abfragefragen gilt
> die Regel aus `portal/AGENTS.md` (`*.dbtest.ts` gegen echte Datenbank, keine
> Attrappen für die Zugriffsschicht).

---

## Chat 5 — Hausgeld: Rundung der Monatsraten und Überzahlung

**Branch:** `claude/hausgeld-rundung`
**Deckt ab:** Notizpunkt 6 (und der „Muster"-Hinweis im Wirtschaftsplan)

> Im Portal (`/home/user/CRM/portal`) verteilt `monthlyInstallments`
> (`src/lib/weg/economic-plan.ts:222`) den Jahresvorschuss über
> `distributeByWeight` auf zwölf gleiche Gewichte. Die Restcents landen auf den
> **ersten** Monaten — in der Praxis also Januar 250,04 €, Februar bis Dezember
> 250,03 €. Rechnerisch korrekt, im Alltag störend: Der Dauerauftrag des
> Eigentümers steht auf einem Betrag und passt im Januar nie.
>
> Gewünscht ist eine glatte, gleichbleibende Monatsrate. Setz das so um:
>
> 1. **Einstellung je Objekt**: „Hausgeld runden auf" mit den Werten *Cent genau*
>    (heutiges Verhalten), *10 Cent*, *voller Euro*. **Vorgabe: 10 Cent.**
>    Feld auf `Property`, Migration, Pflege in
>    `…/weg/[propertyId]/stammdaten`.
> 2. **Aufrunden, nie abrunden.** Die Monatsrate wird auf die nächste Stufe
>    **aufgerundet**, damit die Gemeinschaft im Jahr nicht unterdeckt ist. Alle
>    zwölf Raten sind dann gleich; die Überdeckung beträgt höchstens ~12 € im
>    Jahr.
> 3. **Die Überdeckung offen ausweisen**, nicht verstecken. Im Wirtschaftsplan
>    und im Einzelwirtschaftsplan-PDF: „Jahresvorschuss 3.000,36 €, monatlich
>    gerundet 12 × 250,10 € = 3.001,20 €, Überdeckung 0,84 € — wird mit der
>    Jahresabrechnung verrechnet." Wer das liest, muss nicht nachrechnen.
> 4. **Verrechnung.** Die Überzahlung ist ein Guthaben und läuft über die
>    Abrechnungsspitze zurück (§ 28 Abs. 2 WEG) — dafür braucht es keine neue
>    Mechanik, aber prüf, dass `computePeakAmounts` gegen das **tatsächlich
>    gestellte Soll** rechnet und nicht gegen den ungerundeten Jahresbetrag.
>    Das ist der Punkt, an dem ein Fehler hier still ins Ergebnis liefe.
>
> **Reichweite beachten** — `monthlyInstallments` speist mehr als die Anzeige:
> - `src/lib/weg/due-postings.ts:59` erzeugt daraus die echten Sollstellungen,
> - `src/lib/weg/wirtschaftsplan-pdf.ts:40,129` und
>   `src/lib/documents/wirtschaftsplan.ts` die PDFs,
> - `src/lib/weg/plan-validity.ts` trägt die Raten über die Jahresgrenze fort
>   (`rateIndex` beginnt je Wirtschaftsjahr wieder bei 0 — bei zwölf gleichen
>   Raten wird dieser Kommentar hinfällig, prüf ihn mit).
>
> **Bestandsschutz:** Bereits beschlossene Pläne und erzeugte Sollstellungen
> dürfen sich **nicht** rückwirkend ändern. Die Rundung greift ab dem nächsten
> Beschluss; laufende Pläne behalten ihre Raten. Beschreib im Commit, wie du das
> sicherstellst.
>
> **Nebenbei:** Unter dem Wirtschaftsplan
> (`…/wirtschaftsplan/[planId]/page.tsx:191`) und im erzeugten PDF
> (`src/lib/documents/wirtschaftsplan.ts:143`) steht „Muster — ersetzt keine
> Rechtsberatung". An einem erzeugten Wirtschaftsplan mit den echten Zahlen der
> Gemeinschaft ist das sachlich falsch und entwertet das Dokument. Entfern es
> dort. Am *Beschlussvorschlag*-Textbaustein darf es stehen bleiben — das ist
> tatsächlich eine Vorlage.
>
> Tests: `src/lib/weg/economic-plan.test.ts` und `plan-validity.test.ts`
> erweitern; besonders die Zusicherung „Σ Raten = Jahresbetrag" muss sauber durch
> „Σ Raten = gerundeter Jahresbetrag, Differenz ausgewiesen" ersetzt werden.

---

## Chat 6 — Eigentümer: eigene Daten pflegen und Belegeinsicht filtern

**Branch:** `claude/eigentuemer-selbstbedienung`
**Deckt ab:** Notizpunkte 9 und 10

> Zwei Lücken in der Eigentümer-Ansicht des Portals (`/home/user/CRM/portal`).
>
> **Teil 1 — eigene Daten pflegen.** `src/app/(portal)/konto/page.tsx:50–86`
> zeigt Name und E-Mail nur an; darunter steht „Änderungen an Name oder
> E-Mail-Adresse übernimmt die Verwaltung für Sie". Ein Eigentümer kann seine
> E-Mail-Adresse also nicht selbst nachtragen — auch dann nicht, wenn er über ein
> Zugangsschreiben ohne Adresse angelegt wurde. Das Datenmodell kann längst mehr:
> `User` trägt `firstName`, `lastName`, `salutation`, `phone`, `street`, `zip`,
> `city`, `preferredContact`.
>
> - Bau eine Karte „Kontaktdaten" mit Formular für Telefon, Anschrift und
>   bevorzugten Kontaktweg — direkt speicherbar, ohne Umweg über die Verwaltung.
> - Die **E-Mail-Adresse** braucht einen eigenen, sicheren Weg: Sie ist
>   `@unique` und zugleich der Anmeldename. Ein Tippfehler sperrt sonst den
>   Zugang aus, und ohne Bestätigung ließe sich eine fremde Adresse eintragen.
>   Also: Doppel-Opt-in — Token an die neue Adresse, Übernahme erst nach Klick,
>   Ablauf nach 24 h, Benachrichtigung an die bisherige Adresse, Eintrag ins
>   Audit-Log. Orientier dich an den vorhandenen Token-Wegen
>   (`passwort-festlegen`, `lib/mfa.ts`) und benutz `lib/mailer.ts`.
>   Ist kein SMTP eingerichtet (`isMailEnabled()`), sag das ehrlich, statt einen
>   Weg anzubieten, der nicht ans Ziel führt.
> - Der **Name** bleibt bei der Verwaltung — er hängt an Eigentumsverhältnissen
>   und Dokumenten. Sag das an Ort und Stelle, statt es nur wegzulassen.
> - Prüf, dass ein Eigentümer damit **nur seine eigenen** Daten ändern kann; die
>   Zugriffsfrage gehört in einen `*.dbtest.ts` (siehe `portal/AGENTS.md`).
>
> **Teil 2 — Belegeinsicht.** In `src/app/(portal)/finanzen/page.tsx` (Karte
> „Belegeinsicht — Buchhaltung der Gemeinschaft", ab Zeile 514) ist die Liste
> lang und praktisch nur nach Jahr filterbar: `belegFilters` (Zeile 210) enthält
> genau einen Eintrag. Eine Freitextsuche gibt es zwar (`bq`), sie wird aber
> offenbar nicht als Filter wahrgenommen.
>
> - Ergänze Filter über die vorhandene `FilterBar`: **Kostenart**, **Konto**
>   (Giro/Rücklage), **Art** (Einnahme/Ausgabe/Umbuchung), **Zeitraum von–bis**,
>   **nur mit Beleg**.
> - Setz `SortControl` ein (Datum, Betrag) — die Komponente ist im Haus und wird
>   hier nicht benutzt; sie blendet sich unter fünf Treffern selbst aus.
> - Zeig eine **Summenzeile über das Filterergebnis** (Einnahmen, Ausgaben,
>   Saldo). Ohne sie ist eine gefilterte Liste nur eine kürzere Liste.
> - Optional, aber wertvoll: eine Ansicht „nach Kostenart gruppiert" mit
>   Jahressumme je Kostenart und Aufklappen der Einzelbuchungen. Das ist die
>   Frage, die ein Eigentümer wirklich hat.
>
> **Zwei harte Regeln** aus `portal/AGENTS.md`: Filter dürfen das Access-`where`
> nur **verengen** (Ausgangspunkt bleibt der Objekt-Scope des Eigentümers), und
> Sortierfelder laufen über die Whitelist in `resolveSort` — niemals ein Feld aus
> der URL direkt in `orderBy`. Der Seiten-Param dieser Liste heißt bereits
> `page`; wenn du eine zweite blätterbare Liste ergänzt, gib ihr einen eigenen
> Namen und reich ihn über `pageParam` an die Filterleiste.
>
> Stornierte Buchungen bleiben sichtbar (§ 18 Abs. 4 WEG) — der Kommentar an der
> Abfrage erklärt warum. Ein Filter darf sie ausblenden, die Vorgabe nicht.

---

## Chat 7 — Prüfpflichten, SEPA ausblenden, Auswahllisten, Muster-Hinweise

**Branch:** `claude/pruefpflichten-und-aufraeumen`
**Deckt ab:** Notizpunkte 5, 12, 8 und der Rest von 4

> Vier abgegrenzte Aufgaben im Portal (`/home/user/CRM/portal`). Sie berühren
> unterschiedliche Dateien und können in dieser Reihenfolge abgearbeitet werden.
>
> **(1) Eigene Prüfpflichten anlegen.** Unter „Finanzen & Buchhaltung → WEG →
> Prüfpflichten" (`…/weg/[propertyId]/pruefpflichten/`) lässt sich nur der
> Standardkatalog übernehmen. Die einzige Anlege-Aktion ist
> `adoptComplianceCatalog`; sie schreibt den festen Katalog aus
> `src/lib/weg/compliance-catalog.ts`. Eigene Einträge (`catalogKey: null`)
> entstehen ausschließlich über den Jahresfahrplan auf der Objekt-Übersicht und
> werden hier zwar angezeigt, aber die Seite sagt nirgends, wo man sie anlegt.
> - Ergänze ein Formular „Eigene Prüfpflicht anlegen" direkt auf dieser Seite:
>   Titel, Beschreibung, Turnus (`MaintenanceInterval`), erste Fälligkeit.
>   Kurzes Formular → `CollapsibleCard` unter der Liste ist zulässig (siehe
>   „Anlegen gehört nicht neben die Liste" in `portal/AGENTS.md`).
> - Mach vorhandene Einträge **bearbeitbar**, nicht nur verschiebbar/löschbar:
>   Titel und Turnus sollten änderbar sein. Heute gibt es nur
>   `updateComplianceDue`.
> - Ergänze „trifft auf dieses Objekt nicht zu" (deaktivieren statt löschen) —
>   eine WEG ohne Aufzug soll die Aufzugsprüfung ausblenden können, ohne sie
>   dauerhaft zu verlieren. `MaintenanceTask.active` gibt es bereits.
>
> **(2) SEPA-Lastschrift vorerst abschalten.** Die Funktion soll fürs Erste nicht
> verwendet werden. **Ausblenden, nicht löschen:** Datenmodell (`SepaMandate`,
> `Property.sepaCreditorId`), `src/lib/weg/sepa.ts` und dessen Tests bleiben
> unangetastet.
> - Menüeintrag entfernen: `…/verwaltung/weg/Arbeitsbereich.tsx:99`.
> - Die Routen `…/[propertyId]/lastschrift` und `…/lastschrift/export`
>   **serverseitig** sperren (Weiterleitung), nicht nur den Link entfernen — eine
>   gespeicherte URL darf nicht ins Nichts führen.
> - Satz in `src/lib/assistant-help.ts:49` anpassen (nennt „SEPA" in der
>   Bereichsübersicht).
> - **Werbung mitziehen:** `src/app/page.tsx` und
>   `src/app/funktionen/hausgeld/page.tsx` bewerben die Lastschrift. Eine
>   Funktion zu versprechen, die im Portal nicht auffindbar ist, ist schlimmer
>   als sie wegzulassen. Beachte dabei den Skill `marken-seiten` — die
>   öffentlichen Seiten haben einen verbindlichen Aufbau und einen Prüfbefehl.
> - Setz die Abschaltung über einen Schalter um (Umgebungsvariable oder
>   Objekt-Einstellung), damit das Wiedereinschalten eine Zeile ist und kein
>   Rückbau.
>
> **(3) Auswahllisten: „Sonstiges" und Freitext.** Mehrere Dropdowns bieten zu
> wenige Möglichkeiten und keinen Ausweg. Beispiel: `…/antraege/page.tsx:242`
> kennt genau zwei Antragsarten (`BESCHLUSSANTRAG`, `VERSAMMLUNG`).
> - Erstell zuerst eine **Bestandsaufnahme** aller `<select>`/`SelectField` mit
>   fachlichem Enum und beurteile jedes: fachlich abschließend (dann bleibt es —
>   `MajorityType`, `VoteChoice`, `ManagementType`, `Role`) oder zu eng.
> - Wo zu eng: Werte ergänzen **und** ein „Sonstiges" mit Freitextfeld, das
>   erscheint, sobald „Sonstiges" gewählt ist. Bau das **einmal** als
>   wiederverwendbare Komponente, nicht siebenmal einzeln — sonst driftet es
>   wieder auseinander.
> - Enum-Werte in Postgres zu ergänzen ist unproblematisch (siehe Kommentar bei
>   `ContactKind` in `prisma/schema.prisma`); Migration nicht vergessen.
> - Wo eine Liste **mit dem Bestand wächst** (Objekte, Einheiten, Personen,
>   Handwerker), gehört ohnehin `ComboField` hin — siehe „Auswahllisten: ab wann
>   tippbar" in `portal/AGENTS.md`, samt der drei dort beschriebenen Fallen.
>
> **(4) „Muster — ersetzt keine Rechtsberatung" dort entfernen, wo es falsch
> steht.** Der Satz gehört an Vorlagen, nicht an fertige Dokumente mit den echten
> Zahlen einer Gemeinschaft. **Entfernen** in:
> `…/erhaltungsplanung/page.tsx:106`, `…/pruefpflichten/page.tsx:78`,
> `…/betriebskosten/page.tsx:74`, `…/co2/page.tsx:70`,
> `…/lastschrift/page.tsx:92` (die Seite wird ohnehin abgeschaltet).
> Wo ein Hinweis fachlich sinnvoll ist (Turnusse sind Richtwerte), schreib das
> **konkret** hin — „Turnusse sind Richtwerte; maßgeblich sind
> Gemeinschaftsordnung, Herstellervorgabe und Gefährdungsbeurteilung" sagt etwas,
> „Muster, ersetzt keine Rechtsberatung" sagt nichts.
> **Stehen bleiben** darf er an echten Vorlagen: `verwaltervertrag`,
> `meeting-agenda-templates`, Beschlussvorschlag-Textbausteine,
> `/ki-transparenz`, `/so-funktionierts`.
> *Nicht anfassen:* `…/wirtschaftsplan/**`, `lib/documents/wirtschaftsplan.ts`
> (Chat 5) und `…/jahresabrechnung/**` (Chat 4).

---

## Teil C — Was in dieser Analyse offen bleibt

- ~~**Die echte CSV-Datei** würde Chat 1 von „robust bauen" auf „gezielt
  beheben" verkürzen.~~ **Erledigt am 13.08.2026:** Datei nachgereicht, Ursache
  reproduziert (keine Kopfzeile + Windows-1252), anonymisierte Testdatei unter
  `portal/src/test/fixtures/vr-umsatz-ohne-kopfzeile.csv` abgelegt. Offen bleibt
  nur, ob im Bestand weitere Bankformate vorkommen — die Umsetzung deckt die
  gängigen mit ab.
- **Die Produktions-Konfiguration der Dateiablage** kann von hier aus nicht
  eingesehen werden. Chat 2 baut die Diagnose; das Setzen von
  `BLOB_READ_WRITE_TOKEN` bzw. das Anlegen eines privaten Blob-Stores bleibt ein
  Handgriff im Vercel-Dashboard.
- **Die Rundungsstufe des Hausgelds** (10 Cent oder voller Euro) ist eine
  fachliche Entscheidung. Der Plan schlägt 10 Cent als Vorgabe vor und macht sie
  je Objekt einstellbar — Widerspruch bitte vor dem Start von Chat 5.
- **Punkt 11 ist nicht abschließend geklärt.** Dass die Prüfung ihre Diagnose
  nicht herausgibt, ist gesichert. Ob darüber hinaus ein Rechenfehler bei der
  Erhaltungsrücklage vorliegt, lässt sich ohne die konkreten Zahlen der
  betroffenen Gemeinschaft nicht sagen. Chat 4 baut deshalb zuerst die Diagnose
  — sie beantwortet die Frage dann von selbst.
