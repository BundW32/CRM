# Umsetzungsplan — Korrekturen aus dem Selbstverwalter-Test

Stand: 03.08.2026 · Basis: Testbericht „WEG Lindenhof 12" und
„Laientauglichkeit WEG-Portal" · Ergänzung zu
[`PLAN-Laientauglichkeit.md`](./PLAN-Laientauglichkeit.md)

> **Umsetzungsstand.** **Block 1** (SK1–SK4) und **Block 2** (SK5–SK7) sind
> gebaut und geprüft. Offen: Block 3 (Status aus Daten), Block 4 (Glossar
> ausrollen, Kleinkram) und Block 5 (Passwort aus der URL).
>
> Zwei Entscheidungen sind unterwegs gefallen: Der Fahrplan **fasst** mehrere
> Objekte zusammen, statt umschaltbar zu sein, und der Einrichtungs-Assistent
> erreicht professionelle Verwaltungen über den **Arbeitsbereich des Objekts**
> statt über ihr Dashboard. Begründungen bei SK5 und SK6.

Zwei Testberichte, dreizehn plus zehn Befunde. Nach Prüfung am Code bleibt ein
Bild, das den Aufwand deutlich senkt: **Fast nichts ist fachlich kaputt.** Die
Berechnungen stimmen, die Wächter greifen, die Fristen werden geführt. Was
fehlt, ist der Weg dorthin — zweite Formulare ohne die Felder des ersten,
Meldungen, die vorhandenes Wissen wegwerfen, und Hilfen, die gebaut, aber nicht
ausgerollt sind.

Deshalb ist dieser Plan überwiegend ein Aufräumplan, kein Bauplan.

---

## 0. Was die Prüfung ergeben hat

### Die Berichte irren in drei Punkten

Festgehalten, damit die Fehldiagnosen nicht in die Umsetzung wandern:

1. **„MEA wird falsch berechnet."** Nein. `lib/weg/mea-sync.ts:31` rechnet
   `Unit.mea × sharePercent / 100`, mit Stichtagsfilter auf `validFrom/validTo`.
   Die Verdopplung entsteht davor: Das Objektformular legt Eigentümer ohne
   `sharePercent` an (Default 100). Die Rechnung stimmt, die Eingabe nicht.
2. **„Ein Eigentümerwechsel mit Stichtag fehlt."** Er existiert vollständig,
   samt tagegenauer Kostenverteilung zwischen Alt- und Neueigentümer
   (`annual-statement.ts`, mit Tests). Er war nur nicht auffindbar.
3. **„Es gibt kein Glossar, keine Hilfe-Icons."** `lib/glossar.ts` und
   `components/begriff.tsx` existieren seit LP3. `<Begriff>` steht an **5**
   Stellen, `<Tipp>` an **31** — bei 98 Seiten. Die Behauptung ist im Prinzip
   falsch und in der Praxis fast richtig.

Auch die Dublettensuche ist besser als beschrieben: `person-search.ts:57` sucht
mit `contains` über den vollen Namen, findet also Vor- **und** Nachnamen. Das
Problem ist nicht die Suche, sondern dass ihr Treffer folgenlos bleibt.

### Der Befund, der in keinem Bericht steht

`dashboard/SelfManagedDashboard.tsx:41` und `:73` bauen Einrichtungsstand und
Fahrplan auf `propIds[0]` — dem ersten Objekt der Organisation, ohne `orderBy`,
also in beliebiger Datenbankreihenfolge. `layout.tsx:93` tut dasselbe mit
`findFirst`. Eine WEG mit zwei Objekten — Wohnhaus und Tiefgarage als eigenes
Grundbuch ist keine Seltenheit — sieht Einrichtung und Fristen nur für eines
davon, und nicht verlässlich für dasselbe.

Das erklärt auch, warum der Tester den Einrichtungs-Assistenten nie zu Gesicht
bekam: War in der Organisation bereits eine fertige WEG vorhanden, gilt
`setup.fertig` — und das neu angelegte Muster-Objekt bekommt keine Führung.

### Der zweite Befund: die Einrichtungsführung erreicht nur eine Hälfte

- `dashboard/page.tsx:37` — `SetupGuide` nur für `isSelfManaged`
- `layout.tsx:93` — Einrichtungs-Band nur für `selfManaged && role VERWALTER`

Ein professioneller Verwalter, der eine neue WEG aufnimmt, bekommt damit weder
Assistent noch Reihenfolge — obwohl dieselbe fachlich zwingende Kette für ihn
gilt.

**Korrektur zur ersten Fassung dieses Plans (03.08.2026).** Hier stand, der
Fahrplan sei „für Selbstverwalter abgeschaltet — genau sie brauchen ihn"
(`Arbeitsbereich.tsx:62`). Das war falsch: Der Selbstverwalter sieht den
Fahrplan auf seiner Übersicht und bekommt im Arbeitsbereich nur den Verweis
dorthin. Die Verzweigung ist bewusste Entdopplung und im Kopfkommentar der
Datei begründet. Sie bleibt, wie sie ist.

---

## Harte Prinzipien

Die sieben aus `PLAN-Laientauglichkeit.md` gelten weiter. Drei kommen dazu:

8. **Eine Sache, ein Ort.** Wo dieselbe fachliche Größe an zwei Stellen gepflegt
   wird, ist die schwächere Stelle der Fehler — nicht die stärkere das Vorbild.
   Entweder das zweite Formular kann alles, oder es verweist auf das erste.
9. **Eine Sperre nennt, was sperrt.** Wer elf gezählte Beziehungen zu einer Zahl
   addiert und dann „z. B." schreibt, hat die Antwort in der Hand und gibt sie
   nicht heraus. Das ist LP2, angewandt auf Wächter.
10. **Bestätigung braucht Deckung.** „Vollständig und centgenau" bei null
    Buchungen ist keine Prüfung, sondern eine Zusicherung ins Leere. Ein Status
    wird aus Daten abgeleitet, nicht aus dem Kalender.

---

## Block 1 — Was der Einrichtung im Weg steht

Zusammen ein bis anderthalb Tage. Der wirksamste Block: Er behebt den
kritischsten Fund **und** macht den Fehler wieder korrigierbar. Beides gehört
zur selben Nutzergeschichte — „ich habe mich vertan und will es geraderücken".

### SK1 — Miteigentumsanteil und Stichtag ins Objektformular

*Testbericht 1, 5 · Laienbericht 1, 8*

Es gibt zwei Wege, Eigentümer zu pflegen, und beide stehen einem Selbstverwalter
nebeneinander in der Navigation:

| | `objekte/[id]/bearbeiten` | `weg/[id]/stammdaten` |
|---|---|---|
| Anteil je Person | fehlt → immer 100 % | `sharePercent` |
| Wechsel mit Stichtag | fehlt → immer „ab heute" | vorhanden, beendet den Vorbesitzer |

- `sharePercent` und `validFrom` als Felder in `AddPersonForm.tsx`; die Actions
  (`objekte/[id]/bearbeiten/actions.ts:398,418`) reichen sie durch statt den
  Default zu nehmen.
- **Warnung, wenn die Anteile einer Einheit nicht 100 % ergeben.** Kein `<Tipp>`
  — eine Warnung nach Prinzip 10 aus LP1, also unabschaltbar.
- `Property.meaTotal` aus `Σ Unit.mea` vorschlagen statt ein zweites Mal von
  Hand pflegen zu lassen. Der Nenner bleibt überschreibbar (die
  Teilungserklärung schlägt die Summe), aber die Abweichung wird benannt.
- **Prüfen, ob das zweite Formular überhaupt bleiben soll.** Die billigere
  Variante von Prinzip 8: Der Eigentümer-Abschnitt im Objektformular verweist
  auf die Stammdaten, statt eine halbe Kopie zu sein. Das ist eine Stunde statt
  eines Tages — aber es nimmt dem Selbstverwalter einen Weg, den er als
  natürlicher empfindet. **Entscheidung vor der Umsetzung nötig.**

### SK2 — Lösch-Sperren, die sagen, was sperrt

*Aus dem manuellen Test (Objekt/Einheit nicht löschbar)*

Der Wächter in `objekte/[id]/bearbeiten/actions.ts:207` zählt elf Beziehungen
einzeln aus — Mieter, Eigentümer, Zahlungen, Sollstellungen, Mahnungen,
Abrechnungspositionen, SEPA-Mandate, Übergaben, Vorgänge, Dokumente, Zähler —
addiert sie zu einer Zahl und meldet „z. B. Mieter, Buchungen, Übergaben oder
Vorgänge". Das „z. B." gibt selbst zu, dass die Meldung rät. Beim Objekt
(`:287`) sind es achtzehn Beziehungen per `Object.values().reduce()`.

- Übersetzungstabelle Relationsname → Klartext (`unitOwnerships` → „Eigentümer",
  `duePostings` → „Sollstellungen").
- Die belegten Beziehungen mit Anzahl in die Meldung, plus der Weg zum Lösen:
  „Noch verknüpft mit: 2 Eigentümern, 3 Sollstellungen, 1 Zähler. Eigentümer
  entfernen Sie unter ‚Eigentümer' weiter oben."
- Gilt für Einheit **und** Objekt.
- `page.tsx:394` rechnet dieselbe Summe für `deletable` noch einmal — beide
  Stellen aus einer Quelle speisen, sonst laufen sie auseinander.

### SK3 — Stumme Wächter

*Aus dem manuellen Test (Nutzer nicht löschbar, ohne Meldung)*

`nutzer/actions.ts` bricht bei fehlender Berechtigung mit einem `redirect` ohne
`?fehler=` ab. Man klickt, landet in der Liste, und nichts hat sich geändert.
Es gibt im Portal **keine** Fehlermeldung für „keine Berechtigung".

- Ein Flash-Code `keine_berechtigung`, in den `FEHLER_TEXTE` der betroffenen
  Seiten.
- Durchgang über alle `redirect(` ohne Fehlerparameter nach einem
  Rechte-Check. `AGENTS.md` kennt bereits die Regel „Wächter melden keinen
  Erfolg" — der umgekehrte Fall fehlt dort und gehört ergänzt.

### SK4 — Dublettenschutz mit Zähnen

*Testbericht 2, 7*

Die Suche funktioniert (`person-search.ts`), aber `AddPersonForm.tsx` behandelt
den Treffer als Vorschlag: Der Anlegen-Knopf bleibt daneben aktiv. Wer die
Vorschlagsliste nicht als Angebot erkennt, legt das zweite Konto an.

- Bei mindestens einem Treffer wird das direkte Anlegen gesperrt, bis aktiv
  „trotzdem neu anlegen" gewählt wird.
- Das Feld heißt `lastName`, sucht aber über den vollen Namen — umbenennen zu
  „Name", sonst gibt die Beschriftung ein falsches Versprechen.

---

## Block 2 — Die Führung erreicht beide Rollen

Zusammen ein halber bis ein Tag. Enthält die Antwort auf die offene Frage aus
`PRODUKT-Laientauglichkeit-und-UseCases.md` §1.2.

### SK5 — Einrichtungsstand und Fahrplan je Objekt

*Neuer Befund, in keinem Bericht*

- `propIds[0]` und `findFirst` ersetzen: bei genau einem Objekt bleibt alles wie
  heute, bei mehreren wird ausgewählt statt geraten. Zwischenschritt, falls die
  Auswahl später kommt: ein deterministisches `orderBy` — dann ist es wenigstens
  reproduzierbar dasselbe Objekt.
- **Produktentscheidung nötig:** Fasst der Fahrplan mehrere Objekte zusammen
  oder ist er umschaltbar? Ich empfehle zusammenfassen mit Objektnamen an jedem
  Eintrag — eine Frist, die man erst nach einem Klick sieht, ist keine Frist.

### SK6 — Einrichtung auch für professionelle Verwalter

`SetupGuide` in den **WEG-Arbeitsbereich** des Objekts, nicht in das Dashboard
der Profis. Zwei Gründe, die erst beim Bauen sichtbar wurden:

- Der Arbeitsbereich gehört ohnehin zu genau einem Objekt. Damit erledigt sich
  die Frage, welches gemeint ist — ohne Auswahl, ohne Rateschritt.
- Ein Stand kostet sieben Abfragen. Im Layout, das bei **jeder**
  Seitenauslieferung läuft, wäre das bei achtzig Objekten untragbar. Das
  Einrichtungs-Band bleibt deshalb Selbstverwaltungen vorbehalten und ist auf
  zehn Objekte gedeckelt.

Ansprache: „**Ihre** WEG einrichten" (`SetupGuide.tsx:34`) stimmt, solange nur
Selbstverwalter es sehen. Sobald eine professionelle Verwaltung es sieht, ist
es die WEG des Kunden — dort steht der Objektname.
- Die Oberfläche siezt durchgängig; „Frag deine Gemeinschaft" in
  `assistant.ts:1` ist ein Codekommentar und wird nirgends gerendert. Kein
  Handlungsbedarf, nur der Vollständigkeit halber geprüft.

### SK7 — `showHints` nach Kontotyp

Aus `PRODUKT-…md` §1.2, beschlossen und nie umgesetzt: Selbstverwalter
standardmäßig **an**, professionelle Verwalter standardmäßig **aus**. Heute
steht `@default(true)` für alle (`schema.prisma:361`). Eine Zeile plus
Migration; der Schalter unter `/konto` existiert bereits.

---

## Block 3 — Bestätigungen mit Deckung

Ein halber Tag. Dieselbe Fehlerklasse, dreimal.

### SK8 — Status aus Daten statt aus dem Kalender

*Testbericht 6, 9 · Laienbericht 7*

- `jahresabrechnung/[statementId]/page.tsx:255` bestätigt „Verteilung
  vollständig und centgenau", weil Summe der Teile = Summe des Ganzen. Bei null
  Buchungen ist das `0 = 0` — trivial erfüllt und trotzdem grün. Die Prüfung
  braucht eine Untergrenze: keine Positionen, keine Bestätigung.
- `jahresabrechnung/page.tsx:36` schlägt `getFullYear() - 1` vor, ohne die
  vorhandenen Wirtschaftspläne anzusehen. Vorschlag aus dem letzten Jahr mit
  beschlossenem Plan.
- `setup-status.ts` hakt den MEA-Schritt ab, wenn `meaTotal === null`
  (`meaStimmt`). Das ist bewusst so — MEA ist optional bei Umlage nach Einheiten
  oder Fläche — aber mit SK1 (Nenner aus Σ vorschlagen) sollte der Fall selten
  werden. Verhalten prüfen, nicht blind ändern.
- „Seit 33 Tagen überfällig", obwohl nichts abzurechnen ist: mit SK5 teilweise
  erledigt, der Rest gehört hierher.

Dies ist derselbe Fehlertyp wie beim Mailversand („an 12 Eigentümer versandt"
ohne eingerichtetes SMTP). Es lohnt, ihn als wiederkehrendes Muster in
`AGENTS.md` festzuhalten statt jedes Vorkommen einzeln zu behandeln.

---

## Block 4 — Ausrollen, nicht bauen

Ein halber bis ein Tag, gut teilbar, jederzeit unterbrechbar.

### SK9 — Glossar dorthin, wo die Begriffe stehen

*Laienbericht 2, 6, 9, 10*

`<Begriff>` steht an 5 Stellen (Jahresabrechnung, Hausgeld, Kontoauszug). Die
Seiten, die beide Berichte nennen — Kostenarten, Objekt-Einstellungen,
Beschlüsse, Einstellungen — tragen den Fachbegriff nackt.

Reine Fleißarbeit, Komponente und Inhalte existieren. Regel wie bei LP1: Wer
eine Seite ohnehin anfasst, zieht sie mit. Für die im Bericht namentlich
genannten Seiten ein gezielter Durchgang.

### SK10 — Kleinkram

*Testbericht 10, 12, 13 · Laienbericht 9*

- `aushaenge/neu/page.tsx:57` und `hausgeld/page.tsx:924`: `defaultValue="ALLE"`
  gegen die abweichende Voreinstellung beim Dokument angleichen.
- `antraege/actions.ts:212` und `wirtschaftsplan/actions.ts:526`: neue Einträge
  landen per `max + 1` immer am Ende. Die Reihenfolge ist über `TopReihenfolge`
  änderbar — der Hinweis darauf fehlt an der Stelle, an der es auffällt.
- Fehlende Verlinkungen (Organisationsname unter Einstellungen → Branding ist
  pflegbar, aber von keiner Stelle aus erreichbar, an der man ihn vermisst).

---

## Block 5 — Eigenständig

### SK11 — Passwort nicht mehr über die URL

*Testbericht 3 · Sicherheitsthema, eigene Prüfung*

Fünf Stellen geben ein frisch erzeugtes Passwort als GET-Parameter weiter:
`objekte/[id]/bearbeiten/actions.ts:364,428,474` und `nutzer/actions.ts:393,729`,
entgegengenommen in `zugangsschreiben/[id]/page.tsx:19`. Das landet in
Server-Logs, Browser-Verlauf und im `Referer` jeder von dort geladenen Ressource.

Lösung: ein einmal einlösbares, kurzlebiges Token serverseitig statt des
Klartextpassworts in der Adresse. Der Weg ist derselbe wie bei den gehashten
Reset-Tokens aus P1-6 (Schritt in `DECISIONS.md`) — dort steht das Muster schon.

**Nicht mit den WEG-Paketen mischen.** Eigener Zweig, eigene Prüfung.

---

## Ausdrücklich **nicht** in diesem Plan

- **Korrekturmodus für durchgeführte Versammlungen.** `versammlungen/actions.ts:285`
  sperrt die Bearbeitung serverseitig; die Formularfelder bleiben aber aktiv, man
  tippt und scheitert erst beim Speichern. **Die Felder zu sperren gehört zu
  SK10.** Ein protokollierter Korrekturweg an einem beschlossenen Protokoll ist
  etwas anderes — er hat rechtliche Implikationen und ist eine fachliche
  Entscheidung, keine Fehlerbehebung.
- **„Alltagsmodus" fürs Buchen** (Laienbericht 4). Produktentscheidung.
- **„Testdaten zurücksetzen"** für Objekte im Einrichtungsstatus. Naheliegend —
  wer ein Portal ausprobiert, legt erst Unsinn an — aber Neubau. Erst SK2 und
  SK3 umsetzen und sehen, ob die sprechenden Meldungen reichen.
- **Fachbegriffe umbenennen.** Prinzip 1 aus `PLAN-Laientauglichkeit.md`.

---

## Reihenfolge und Aufwand

| Paket | Größe | hängt ab von | Entscheidung nötig? |
|---|---|---|---|
| SK1 MEA & Stichtag | mittel | — | ja — zweites Formular ergänzen oder auflösen |
| SK2 Lösch-Sperren | klein | — | nein |
| SK3 stumme Wächter | klein | — | nein |
| SK4 Dublettenschutz | klein | — | nein |
| SK5 Objektauswahl | klein | — | ja — zusammenfassen oder umschalten |
| SK6 Führung für beide Rollen | klein | SK5 | nein |
| SK7 `showHints` nach Kontotyp | sehr klein (1 Migration) | — | nein |
| SK8 Status aus Daten | klein | — | nein |
| SK9 Glossar ausrollen | mittel, teilbar | — | nein |
| SK10 Kleinkram | klein | — | nein |
| SK11 Passwort-URL | mittel | — | eigener Zweig |

**Block 1 zuerst** (SK1–SK4): der kritischste Fund und seine Korrigierbarkeit in
einer Runde. **Dann Block 2** (SK5–SK7): eine Führung, die man je nach Datenlage
nicht sieht, ist schlechter als keine, weil man sich auf sie verlässt. Block 3
und 4 danach in beliebiger Reihenfolge, Block 5 parallel und getrennt.

Grob: **drei bis vier Tage für Block 1–4**, Block 5 separat.

Zwei Entscheidungen blockieren den Start nicht, aber SK1 und SK5 jeweils
mittendrin — sie sollten vorher fallen.
