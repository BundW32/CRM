# Plan: Design-Vereinheitlichung (Stufenplan)

**Stand:** 27.07.2026 · **Zweig:** `claude/admin-menu-reorganization-8o17fx`
**Status:** abgestimmt, Bau noch nicht begonnen.

## Warum

Die neue Navigationsleiste sieht modern aus — der Stil zieht aber nicht durch das
Programm. Der Eindruck ist berechtigt und lässt sich messen (Zahlen unten). Es geht
**nicht** um ein Redesign: Farben, Schrift und Marke bleiben. Es geht darum, dass
dieselbe Sache überall gleich aussieht.

Die Arbeit lohnt sich, weil sie **einmalig** ist: Am Ende steht eine Konvention in
`portal/AGENTS.md` plus harte ESLint-Regeln. Danach entsteht die Uneinheitlichkeit nicht
neu, egal wer als Nächstes baut.

## IST-Stand (gezählt, nicht geschätzt)

| Befund | Zahl |
|---|---|
| Native `<select>` | 103 |
| `Combobox` | 2 |
| Native `type="date"` | 26 (davon **7 ohne `inputClass`** → sichtbar anderer Kalender) |
| `<Card>` | 140 |
| Von Hand gebaute Karten (`rounded-… border … bg-white`) | 45 |
| Ad-hoc-Badge-Definitionen | 61 |
| Verschiedene Abstands-Stufen zwischen Blöcken | 8 |

**Beschlüsse** ist das deutlichste Beispiel: Die Abstimmungszahlen stehen in
`VoteSummary` als Fließtext (`text-xs text-gray-500`), es gibt keine visuellen Zonen,
und drei Button-Sprachen stehen nebeneinander. Deshalb wirkt die Seite gequetscht.

Weitere Beispiele derselben Ursache: Wartung, Hausgeld, Versammlungen, Zähler,
Wohnungsübergabe — überall dort, wo Tabellen und Formulare dicht beieinanderstehen.

## Entscheidungen

1. **Beschlüsse ist Musterseite** (Formular-/Detail-Archetyp), wie beim Menü-Umbau:
   erst eine Seite, ansehen, nachjustieren, dann ausrollen.
2. **Regeln hart** (Wunsch des Auftraggebers): ESLint verbietet nach Stufe 3
   rohes `type="date"`, handgebaute Karten und Ad-hoc-Badges — nicht nur als Warnung.
3. **Native `<select>` bleibt nativ.** Kein Umbau auf `Combobox`; die Felder werden nur
   optisch vereinheitlicht. Grund: Auf Mobilgeräten ist das native Auswahlrad die
   bessere Bedienung, und 103 Umbauten wären reines Risiko ohne Gewinn.

## Zweig-Konflikte (Stand heute)

Aktiv sind neben diesem Zweig:

- `claude/program-analysis-tasks-au9wmc` (16 Commits) — fasst u. a.
  `beschluesse/page.tsx` an (PR #36).
- `claude/weg-accounting-review-dch465` (7 Commits).

**Einzige Datei, die beide anfassen:** `weg/[propertyId]/hausgeld/page.tsx`.
Deshalb ist Hausgeld **nicht** der Tabellen-Archetyp — **Wartung** ist es, die Datei ist
frei. Die Stufen sind so geschnitten, dass Stufe 1 ausschließlich konfliktfreie bzw. neue
Dateien berührt.

## Stufen

### Stufe 1 — Bausteine (nur neue/konfliktfreie Dateien)
- `DateField` — ein Datumsfeld, überall gleich (ersetzt die 26 rohen Felder).
- `SelectField` — natives `<select>`, einheitlich gerahmt.
- `Badge` — eine Variantenliste statt 61 Ad-hoc-Definitionen.
- `DataGrid` — die Tabellen-/Listenform, die Beschlüsse und Wartung teilen.
- **Drei** Abstands-Stufen statt acht, als Tokens.

Kein Seitenumbau in dieser Stufe. Danach ist nichts anders sichtbar — das ist Absicht.

### Stufe 2 — Musterseiten
- **Wartung** sofort (Tabellen-Archetyp, Datei frei).
- **Beschlüsse**, sobald PR #36 gemergt ist (Formular-/Detail-Archetyp).
- Danach ansehen und nachjustieren, bevor irgendetwas ausgerollt wird.

### Stufe 3 — Regeln festschreiben
- Abschnitt „Oberfläche" in `portal/AGENTS.md`.
- ESLint-Regeln, hart: kein rohes `type="date"`, keine handgebauten Karten, keine
  Ad-hoc-Badges. Bestand wird über eine begründete Ausnahmeliste geführt, nicht über
  abgeschaltete Regeln.

### Stufe 4 — Ausrollen in Wellen
Erst nachdem die aktiven Zweige gemergt sind, Seite für Seite entlang der Menügruppen
(Alltag → Stammdaten → WEG → Betrieb). Jede Welle ein eigener PR.

## Aufgabenteilung (abgestimmt, verbindlich)

**Das Designsystem baut dieser Zweig.** Der Fachlogik-Zweig
(`claude/program-analysis-tasks-au9wmc`) fasst `src/components/`, `globals.css` und die
neuen Bausteine **nicht** an — auch nicht kurz. Fehlt ihm beim Bauen ein Baustein, meldet
er es, statt ihn selbst zu bauen. Nachgemessen: Sein Zweig berührt heute keine einzige
Datei unter `src/components/` und `globals.css` nicht — die Trennung ist also real und
nicht bloß Vorsatz.

### Reihenfolge-Bedingung: Stufe 3 kommt nach seinem Merge

Die harten ESLint-Regeln würden fertige, getestete Arbeit in seinem Zweig zu
Build-Fehlern machen. Betroffen sind genau drei Stellen — allesamt echte Eigenbauten,
die Regeln treffen also richtig:

- zwei handgebaute Kennzahlen (`text-3xl font-semibold`) für Kontostände → `KeyFigure`
- ein handgebautes Etikett (`rounded-full bg-amber-100 …`) für „wichtig" → `Badge`
- sechs Dateien im WEG-Bereich mit rohem `type="date"` → `DateField`

**Deshalb: Stufe 3 erst nach dem Merge seines Zweiges.** Wird sie früher gebraucht, zieht
er seine drei Stellen vorher auf die Bausteine um (rund eine halbe Stunde) — das muss
aber vereinbart sein, nicht unterstellt. Stufe 1 ist davon unberührt und läuft sofort:
Sie ist rein additiv, es ändert sich zunächst nichts Sichtbares.
