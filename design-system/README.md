# Design-System wegportal24

Elf Bögen, die zeigen, wie wegportal24 aussieht und warum. Sie sind **aus dem
Code erzeugt**, nicht danebengeschrieben: Farben, Schrift, Rundungen, Schatten
und die Bewegungskurve liest der Generator aus dem `@theme`-Block von
`portal/src/app/globals.css`, die Kontrastwerte rechnet er nach.

| Gruppe | Bogen | Was drinsteht |
| --- | --- | --- |
| Grundlagen | Farben | Marke, Status, dunkler Rahmen – mit nachgerechneten Kontrasten |
| Grundlagen | Schrift | Source Sans 3 vorn, Inter und Jakarta hinter dem Login |
| Grundlagen | Form und Tiefe | Vier Rundungen, drei Schatten, vier Flächen |
| Grundlagen | Bewegung | `--ease-mk-out` gegen die verbotene Sprungkurve, Dauern, reduzierte Bewegung |
| Marke | Wortmarke | Bildzeichen, zwei Fassungen, Schutzraum, die drei häufigen Fehler |
| Komponenten | Knöpfe | Die drei der Marken-Seiten, die sechs des Portals, die 44-px-Regel |
| Komponenten | Formularfelder | Eingaben, Zustände, Pflichtfeld-Automatik, Einheiten-Regler |
| Komponenten | Karten und Hinweise | Flächen, vier Meldungsarten, leere Stellen, Status |
| Komponenten | Kopf- und Fußzeile | Der Rahmen jeder öffentlichen Seite, auch mobil |
| Muster | Bänder | Hero, Zahlenband, Zwischenschnitt, Abschluss |
| Muster | Seitenaufbau | Der 11-Elemente-Rahmen, sechs Inhaltsregeln, der Prüfbefehl |

## Bauen und prüfen

```bash
node design-system/bauen.mjs              # erzeugt design-system/vorschau/
node design-system/pruefen.mjs            # sieht sich jeden Bogen im Browser an
node design-system/pruefen.mjs --bilder   # zusätzlich PNGs in .aufnahmen/
```

`pruefen.mjs` öffnet jeden Bogen in Chromium und meldet, was man sonst erst im
hochgeladenen Projekt sieht: waagerechtes Überlaufen, eine nicht geladene
Schrift, einen fehlenden `@dsCard`-Marker, eine Kartenhöhe, die nicht zur
tatsächlichen passt, Konsolenfehler und fehlgeschlagene Anfragen.

**`vorschau/` wird nicht von Hand geändert.** Wer etwas ändern will, ändert es
im Portal (`globals.css`, `components/ui.tsx`, `components/marketing/*`) oder
im zugehörigen Modul unter `design-system/karten/` – und baut neu. Sonst sagt
das Design-System nach der ersten Änderung etwas anderes als die laufende Seite,
und genau das soll es nicht können.

## Nach claude.ai/design bringen

Der Ordner `design-system/vorschau/` ist bereits das Format, das ein
Claude-Design-Design-System erwartet: pro Bogen eine eigenständige HTML-Datei,
deren **erste Zeile** ein Marker ist –

```html
<!-- @dsCard group="Grundlagen" name="Farben" subtitle="…" width="1200" height="2800" -->
```

Aus diesem Marker baut die Design-System-Ansicht ihren Karten-Index. Es gibt
drei Wege hinein; **aus einer Claude-Code-Sitzung im Web funktioniert keiner
davon**, weil die Design-System-Freigabe dort nicht gesetzt werden kann.

**1. Aus Claude Code auf dem eigenen Rechner** (der übliche Weg)

```
/design-login     # einmalig – schaltet die Design-System-Freigabe frei
/design-sync      # gleicht design-system/vorschau/ mit dem Projekt ab
```

`/design-sync` legt beim ersten Lauf ein neues Design-System-Projekt an oder
fragt, in welches bestehende geschrieben werden soll, und überträgt danach
Bogen für Bogen. Der Abgleich ist inkrementell: Wer nur die Farben ändert,
lädt nur den Farb-Bogen neu hoch.

**2. Von Claude Design aus:** „Send to Claude Code Web“ – setzt das Projekt in
den Arbeitsbereich, danach kann von dort aus geschrieben werden.

**3. Von Hand über das Werkzeug** `DesignSync`, in dieser Reihenfolge:
`create_project` → `finalize_plan` (mit `localDir` auf
`design-system/vorschau`) → `write_files`. Die Karten-Angaben für den
Sonderfall `register_assets` liegen fertig in `vorschau/_ds_cards.json`.

> **Wichtig zum Projekttyp:** Ein Design-System-Projekt muss als solches
> angelegt werden (`PROJECT_TYPE_DESIGN_SYSTEM`). Der Typ lässt sich später
> nicht ändern – in ein normales Projekt hochzuladen ergibt kein
> Design-System, sondern nur ein paar Dateien.

## Wie ein Bogen aufgebaut ist

Jede Datei unter `karten/` ist ein kleines Modul mit einer Funktion `bauen(tokens)`.
Sie bekommt die gelesenen Tokens und gibt fertiges HTML zurück; `lib/seite.mjs`
liefert den gemeinsamen Rahmen samt Token-Block, `lib/tokens.mjs` das Lesen und
das Kontrast-Rechnen. Ein neuer Bogen ist eine neue Datei unter `karten/` plus
ein Eintrag in der Liste `KARTEN` in `bauen.mjs`.

Die Schriftschnitte werden aus `portal/public/fonts/` mitkopiert und relativ
eingebunden (`../schrift/sourcesans-400.woff2`). Löst der Renderer den relativen
Pfad nicht auf, greift die Ersatzkette – der Bogen sieht dann anders aus, aber
er bricht nicht.

## Was beim Bauen aufgefallen ist

`portal/src/app/globals.css` trägt zwischen Zeile 521 und 838 einen **doppelten
Block**: `.mk-light`, `.mk-reveal`, das Punktraster und die `mk*`-Keyframes
stehen zweimal darin, offenbar aus einer schiefgegangenen Zusammenführung. Zwei
Folgen davon sind sichtbar und gehören unabhängig von diesem Ordner repariert:

1. **Die Scroll-Einblendungen sind abgeschaltet.** Ganz am Ende des doppelten
   Blocks steht `.mk-reveal { opacity: 1; transform: none; }` eingerückt, aber
   *außerhalb* jeder `@media`-Regel – die Zeile gehört in den
   `prefers-reduced-motion`-Block, in dem sie weiter oben auch steht. So wie es
   jetzt dasteht, gilt sie für alle: `Reveal` blendet nichts mehr ein.
2. **Die verbotene Sprungkurve ist wieder aktiv.** `@keyframes mkPopIn` ist
   zweimal definiert; die zweite Fassung gewinnt und schießt mit `scale(1.08)`
   über die Endgröße hinaus – genau der Überschwinger, den die Regeln der
   Marken-Seiten ausschließen. Die erste, korrigierte Fassung (0,92 → 1) ist
   damit wirkungslos.

Beides ist eine kleine Änderung in `globals.css` und in diesem Ordner bewusst
nicht mitgemacht: Er beschreibt das System, er repariert es nicht.
