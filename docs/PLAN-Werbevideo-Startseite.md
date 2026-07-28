# Plan: Werbevideo für die Startseite (Selbstverwalter-WEG)

Stand: 27.07.2026 · Fassung 3 · Vorschau gebaut (`video/`), Endfassung offen.

Zielbild: ein stummes Hero-Video für die öffentliche Startseite der
WEG-SaaS-Variante (`APP_MODE=weg`). Echte Aufnahmen aus der laufenden App,
keine Mockups, kein Stock-Material.

**Zwei Fassungen** (Korrektur gegenüber Fassung 1, die nur die lange kannte):

- **Loop, 12–15 s** — läuft im Hero stumm im Autoplay. Hook, ein
  Produktausschnitt, Logo. Das ist die Fassung, die fast jeder Besucher sieht.
- **Vollversion, ~50 s** — hinter einem Klick („Ansehen"). Der vollständige
  Bogen. Niemand schaut 50 Sekunden Autoplay; 15 Sekunden Schleife hält den
  Blick.

---

## 0 · Reihenfolge — warum jetzt noch nicht aufgenommen wird

Mehrere Branches sind noch nicht gemergt und verändern das Design. Jede
Aufnahme, die vorher entsteht, zeigt eine App, die es danach nicht mehr gibt.

Daraus die tragende Entscheidung dieses Plans:

> **Das Video ist kein Videoprojekt, sondern ein Skript.**

Aufnahme, Schnitt, Zoomfahrten, Texteinblendungen und Encoding liegen
vollständig in Code (`video/`). Ein Design-Update heißt: Skript neu laufen
lassen. Nicht: alles noch einmal von Hand bauen.

**Ausnahme: die Vorschau** (Abschnitt 7). Sie darf und soll vor den Merges
entstehen — ihr Zweck ist der Beweis der Technik, nicht das Bild. Was sie zeigt,
ist Wegwerfware; was sie baut, bleibt.

---

## 0.5 · Die Landingpage — Korrektur

Die richtige Landingpage liegt auf **`claude/eigentumsverwaltung-overview-page-bvd4fj`**
(nicht auf `claude/marketing-landing-page-animation-hz2tin`, den eine frühere
Fassung dieses Plans fälschlich beurteilt hat).

Diese Seite spricht **genau die richtige Zielgruppe** an, sogar schärfer als die
Analyse in Abschnitt 1:

- Titel: „Keine Hausverwaltung gefunden? Verwalten Sie Ihre WEG selbst."
- Problemaufriss: Verwalter nehmen WEGs mit 2–10 Einheiten nicht mehr an, die
  Pflichten aus dem WEG-Gesetz bleiben trotzdem, Excel und Aktenordner reichen nicht.
- Funktionen mit Paragraphenbezug (§ 28 WEG, § 35a), Unterseiten unter
  `/funktionen/*`, dazu `/so-funktionierts`.
- Fotostrecken, Ken-Burns-Heros, eine Zahlenleiste — und `ScrollyBuild`, ein
  scrollgesteuerter Aufbau der WEG in fünf Stufen.

**Folge für das Video — wichtig:** Die Seite erzählt den Aufbau *bereits*
Schritt für Schritt. Ein Video, das dieselbe Reihenfolge noch einmal abspielt,
wäre eine Dopplung mit anderen Mitteln. Das Video muss deshalb genau das tun,
was die Scrolly-Szene nicht kann:

1. **Die echte Software in Bewegung zeigen.** Die Scrolly-Szene ist bewusst
   illustriert („kein Video", steht so im Quelltext) — sie zeigt ein gezeichnetes
   Haus, kein Produkt. Der Beweis, dass es die Software wirklich gibt und dass
   sie gut aussieht, fehlt der Seite komplett.
2. **Den KI-Moment mit Quellenangabe.** Statisch nicht darstellbar.

Damit ändert sich der Schnittplan in Abschnitt 3 nicht grundlegend, aber seine
Begründung: Die Szenen 3–7 sind nicht der Erklärbogen der Seite, sondern ihr
Beleg. Kürzer und dichter als geplant ist deshalb besser.

**Ein Hinweis zum Seitentext, keine Forderung:** Der Hero verspricht,
die WEG „rechtssicher selbst zu verwalten". Das ist eine Zusage, für die der
Betreiber haftet — im Video wird sie bewusst nicht wiederholt (Abschnitt 1).
Ob sie auf der Seite bleibt, ist eine Entscheidung des Betreibers.

## 1 · Zielgruppe und Botschaft

Der Zuschauer ist **kein Immobilienprofi**. Es ist ein Eigentümer oder Beirat
einer kleinen WEG, der die Verwaltung ehrenamtlich übernommen hat oder gerade
übernehmen soll. Acht bis zwanzig Einheiten, ein Bankkonto, Excel, ein
Aktenordner, und die begründete Sorge, etwas Fristgebundenes zu übersehen.

Was diese Person **fühlt**: Überforderung und Haftungsangst — nicht
Effizienzdruck. Ein Profi-Verwalter will Durchsatz. Dieser Mensch will die
Gewissheit, nichts falsch zu machen.

Leitbotschaft:

> **Die Verwaltung führt dich durch das Jahr. Du musst nicht wissen, was als
> Nächstes dran ist — das System weiß es.**

Keine Marketing-Erfindung, sondern das Gebaute: `lib/weg/setup-status.ts`
(geführter Erststart, acht Schritte) und `lib/weg/roadmap.ts` (Jahresfahrplan,
überfällig zuerst).

### Sprache

**Fachbegriffe nutzen** — sie schaffen Glaubwürdigkeit und zeigen, dass wir das
Problem kennen: Wirtschaftsplan, Hausgeld, Eigentümerversammlung,
Beschlusssammlung, Umlaufbeschluss, Erhaltungsrücklage.

**Jargon vermeiden**, der genau diese Zielgruppe abstößt: „Onboarding",
„Cloud-basierte SaaS-Plattform", „Workflow-Digitalisierung",
„Mandantenfähigkeit", „PropTech".

### Was das Video nicht behauptet

Keine Ersparnis in Euro oder Prozent, keine Kundenzahlen, kein „rechtssicher".
Ersparnis-Zahlen können wir nicht belegen, und „rechtssicher" ist eine Zusage,
für die der Betreiber haftet. Erlaubt sind belegbare Signale: Serverstandort,
DSGVO, kostenlos starten.

Der stärkste Vertrauensbeleg ist ohnehin ein anderer — siehe Szene 8.

---

## 2 · Handwerk: was ein Werbevideo von einer Bildschirmaufnahme trennt

Bindend für den Schnitt.

### Lesbarkeit — die härteste Nebenbedingung

Ohne Ton ist die Lesegeschwindigkeit die eigentliche Grenze, nicht die Laufzeit.

- **~14 Zeichen pro Sekunde** ansetzen (konservativ für eine teils ältere,
  nebenbei lesende Zielgruppe).
- Jede Einblendung steht **mindestens 2 s**, höchstens 6 s. Handlungsaufruf 3–5 s.
- **Höchstens 2 Zeilen**, ca. 42 Zeichen je Zeile.
- Daraus folgt ein **Text-Budget von 10–14 Einblendungen auf 50 s**, im Loop
  drei bis vier. Das Budget ist eine Rechengröße, keine Geschmacksfrage — es
  entscheidet, wie viele Aussagen das Video überhaupt tragen kann.
- Standzeit je Einblendung aus der Textlänge rechnen, nie fest verdrahten.

### Bewegung

- **Jeder Zoom braucht einen Grund.** Die Kamera fährt dorthin, wo der Blick
  gleich lesen muss — nie als Dekoration. Permanenter Leichtzoom über allem ist
  das Erkennungszeichen des Amateurschnitts.
- **Zoom kommt an und steht dann.** Nicht über die volle Szenendauer weiterlaufen.
- **Niemals lineare Bewegung**, immer weich an- und abbremsen. Kein Bounce, kein
  Überschwingen bei Text — das wirkt verspielt, nicht seriös.
- **Ruhe nach der Bewegung:** ca. 0,4 s Stillstand, bevor geschnitten wird. Das
  Auge liest nichts Bewegtes.
- Höchstens eine Bewegungsart gleichzeitig.

### Schnitt

- Einstellungslänge 1,5–3 s. Nichts unter 0,6 s, nichts über 5 s.
- **Auf die Bewegung schneiden**, nicht danach — das versteckt die Naht.
- **Match-Cut**, wo möglich: gleiches Element an gleicher Stelle über den
  Schnitt hinweg. Erzeugt einen durchgehenden Raum statt einer Diashow.
- **Harte Schnitte als Regel.** Kreuzblende nur bei echtem Zeitsprung.
  Durchgehendes Überblenden zwischen allen Szenen *ist* der Diashow-Look.
- **Verboten:** Schiebe-Übergänge, 3D-Flips, Whoosh-Effekte.
- **Tempowechsel** statt gleichmäßigem Fluss: schnell durch Wege, langsam auf
  dem Ergebnis.

### Cursor und Eingabe

- Mauszeiger **synthetisch** animiert: gekrümmte Bahn, sanftes Abbremsen,
  minimales Überschwingen. Ein aufgezeichneter Zeiger springt und wirkt
  roboterhaft.
- Klick = kurzer, dezenter Ring-Impuls. Kein Knall, kein Comic-Kreis.
- Tippen mit ca. 25–40 ms je Zeichen mit Streuung, danach eine deutliche Pause
  vor der Antwort. Die Pause erzeugt die Erwartung, die den WOW-Moment trägt.

### Bild und Text

- Eine Schriftgröße, eine Stärke, Markenfarben, viel Ruhe. Keine zweite Schrift.
- Text und UI konkurrieren nie: entweder die Einblendung wird gelesen (UI
  abgedunkelt), oder die Oberfläche.
- Browser-Chrome einheitlich wegschneiden oder durch einen dezenten Rahmen ersetzen.
- **Der letzte Frame ist das Plakat** — er steht als Standbild, solange das
  Video nicht läuft, und muss allein funktionieren.
- Beim Loop: Endbild ≈ Anfangsbild, sonst schlägt die Schleife sichtbar um.

### Dramaturgie (Vollversion, ~50 s)

| Phase | Dauer | Aufgabe |
|---|---|---|
| Hook | 0–5 s | Das Problem **zeigen**, nicht benennen |
| Versprechen | 5–8 s | Die eine Aussage |
| Beleg | 8–36 s | 4–5 Szenen, je: Frage → ein Klick → Ergebnis |
| WOW | 36–46 s | Die KI-Szene |
| Handlungsaufruf | 46–50 s | Steht still, wird zum Plakat |

Höchstens **drei Kernfunktionen** tragen die Beleg-Phase. Vollständigkeit ist
der Feind eines Werbevideos: Szenen, die nur „auch noch da" sind, fliegen raus.

---

## 3 · Schnittplan Vollversion (Entwurf, zur Freigabe)

Demo-Daten: WEG „Musterstraße 12" — existiert bereits in `prisma/seed.ts`.

| # | Zeit | Bild | Bewegung | Einblendung |
|---|---|---|---|---|
| 1 | 0:00–0:05 | Kalter Einstieg auf den **Jahresfahrplan**, überfällige Position oben | Langsame Fahrt auf die überfällige Zeile | „Was ist als Nächstes dran?" |
| 2 | 0:05–0:08 | Fahrplan gesamt | Steht | „Ihre WEG. Ohne Verwalter. Ohne Blindflug." |
| 3 | 0:08–0:14 | **Geführter Erststart**, „Als Nächstes" hervorgehoben | Zoom auf den Schritt, dann Halt | „Acht Schritte. Einer nach dem anderen." |
| 4 | 0:14–0:21 | **Wirtschaftsplan**, Verteilung nach MEA / Fläche / Personen | Pan über die Verteilungsspalte | „Verteilt nach dem richtigen Schlüssel." |
| 5 | 0:21–0:27 | **Hausgeld**, offener Rückstand markiert | Schneller Weg, Halt auf der Zeile | „Wer hat gezahlt — und wer nicht." |
| 6 | 0:27–0:32 | **Jahresabrechnung**, Einzelabrechnung | Zoom auf die Abrechnungsspitze | „Jahresabrechnung, fertig gerechnet." |
| 7 | 0:32–0:36 | **Versammlung**, Tagesordnungspunkt wird gezogen | Cursor zieht, kurzer Halt | „Beschlüsse, die halten." |
| 8 | 0:36–0:46 | **KI-Assistent**: Frage wird getippt, Antwort **mit Quellenangabe** | Zoom aufs Widget, Halt auf den Quellen | „Fragen Sie einfach." |
| 9 | 0:46–0:50 | Logo, Claim, „Kostenlos einrichten" | Steht — Endframe = Plakat | — |

**Zu Szene 8:** Der WOW-Effekt liegt nicht darin, dass eine KI antwortet — das
erwartet 2026 jeder. Er liegt darin, dass sie **die Quelle mitliefert**
(`AssistantResult.sources`: Beschluss, Wirtschaftsplan, Aushang, verlinkt).
Genau dort glaubt ein misstrauischer Beirat, dass die Antwort stimmt. Das ist
zugleich das ehrlichste Vertrauenssignal, das wir haben — belegbar, im
Gegensatz zu jeder Ersparnis-Behauptung.

Demo-Frage: **„Wie hoch ist mein Hausgeld ab Januar und wer hat das
beschlossen?"** → Betrag plus klickbarer Verweis auf den Beschluss.

**Loop-Fassung (12–15 s):** Szene 1 (gekürzt) → Szene 8 (nur Frage und Antwort)
→ Szene 9. Kein Problem/Lösung-Bogen, drei Einblendungen, Endbild = Anfangsbild.

---

## 4 · Technik

### Was bewiesen ist

In dieser Umgebung real durchgespielt: Chromium starten, Seite aufzeichnen,
Zoomfahrt per ffmpeg rendern, H.264 ausgeben, Einzelbilder herausziehen und
prüfen.

- Chromium unter `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (`executablePath` setzen; `playwright install` ist gesperrt,
  `PLAYWRIGHT_BROWSERS_PATH` auf ein Verzeichnis mit Symlink auf `ffmpeg-1011`).
- `ffmpeg-static` über npm erreichbar, H.264-Encoding und Crop-Zoom laufen.
- Frames aus dem fertigen Video zurückholen und **ansehen** — jede Einstellung
  wird geprüft, nicht blind gerendert.
- **Schriften unkritisch:** Inter und Plus Jakarta Sans sind selbst gehostet
  (`public/fonts/*.woff2`), kein Google-CDN. Die Aufnahme sieht aus wie die App.
- **Demo-Daten weitgehend vorhanden:** `prisma/seed.ts` legt die WEG
  „Musterstraße 12" bereits mit Kostenkatalog, Konto, Prüfpflichten,
  Versammlung samt Tagesordnung und einem Mietverhältnis an. Das war das größte
  vermutete Risiko — es ist zum großen Teil erledigt.

### Was noch offen ist (ehrlich)

| Risiko | Einschätzung |
|---|---|
| App lokal hochfahren: `npm install`, Postgres 16, 80 Migrationen, Seed, Pflicht-Umgebungsvariablen (`DATABASE_URL`, `SESSION_SECRET`, `APP_MODE`, `UPLOAD_DIR`) | mechanisch, mittleres Risiko — nicht getestet |
| **Aufnahmequalität.** Playwrights `recordVideo` liefert VP8 mit fester Bildrate und **ignoriert `deviceScaleFactor`** — die versprochene 2×-Schärfe ist damit nicht garantiert. Vermutlicher Ersatz: Einzelbilder je Frame aufnehmen und mit ffmpeg zusammensetzen (deterministisch, voll scharf, langsamer). | **muss die Vorschau klären** |
| Synthetischer Cursor als eingeblendete Ebene in der Seite | üblich, hier nicht getestet |
| Seed-Ergänzung: eine *vollständig eingerichtete* WEG mit beschlossenem Wirtschaftsplan und Sollstellungen (Szene 4–6). Achtung: Der Katalog verteilt auch nach Fläche und Personenzahl — fehlen die, blockiert der Plan (siehe `UEBERGABE-WEG-Selbstverwaltung.md`, Abschnitt 2.1). | überschaubar, aber echte Arbeit |
| Szene 8 ohne `GEMINI_API_KEY` | Alternative: Demo-Daten so setzen, dass die Antwort vorhersehbar ist. Es wird **keine** Antwort erfunden, die die App nicht liefern würde. |

### Entscheidung gegen Remotion

Remotion wurde geprüft und **verworfen** — für die Kompositionsschicht wäre es
elegant, aber: die Lizenz ist keine übliche Open-Source-Lizenz (ab einer
gewissen Firmengröße kostenpflichtig), und Remotion rendert über eine eigene
Chrome-Instanz, deren Download hier gesperrt ist.

Beides entfällt durch einen einfacheren Weg mit demselben Ergebnis:
**Texteinblendungen und Endtafel werden als HTML-Seiten gebaut und mit derselben
bewiesenen Kette aufgenommen.** Volle CSS-Kontrolle über Typografie und
Animation, die echten Markenschriften, keine zusätzliche Abhängigkeit, keine
Lizenzfrage. ffmpeg fügt nur noch zusammen.

### Ausgabe

`hero-loop.webm` + `hero-loop.mp4` + `hero-poster.jpg`, dazu die Vollversion.
Loop unter 2 MB, Vollversion unter 6 MB.

### Barrierefreiheit

`autoplay muted loop playsinline`, Poster als Standbild,
`prefers-reduced-motion: reduce` → nur Poster, kein Video. Zusätzlich ein
**Kurztranskript** des Videoinhalts auf der Seite. Ob und wie das BFSG hier
greift, ist eine Rechtsfrage für den Betreiber — der Plan setzt die Maßnahmen
um, bewertet die Pflicht aber nicht.

---

## 5 · Aufwand — was Rechenzeit kostet und was nicht

Das Rendern selbst kostet **keine** Token: Aufnahme und Encoding sind
Prozessorarbeit, keine Modellarbeit. Ob das Video 15 oder 50 Sekunden lang ist,
ändert an den Kosten fast nichts.

Was tatsächlich kostet:

- **Anzahl der Szenen** (jede braucht ein eigenes Aufnahme-Skript), nicht die Laufzeit.
- **Sichtprüfung**: pro Durchlauf werden 15–25 Kontrollbilder angeschaut, nicht
  1500 Frames.
- **Korrekturschleifen** — der eigentliche Posten. Deshalb die Vorschau: Sie
  klärt die Handschrift, bevor neun Szenen daran hängen.

Nichts davon skaliert mit der Videolänge. Die Sorge ist berechtigt gedacht,
trifft hier aber den falschen Hebel.

---

## 6 · Was zusätzlich gebraucht wird

**Kein MCP, kein weiterer Skill.** Chromium, ffmpeg, Postgres und npm sind da,
die Kette ist geprüft. Der einzige externe Wunsch bleibt ein `GEMINI_API_KEY`
für Szene 8 — und der ist ersetzbar.

---

## 7 · Vorschau als nächster Schritt

Etwa **10 Sekunden**, ein senkrechter Schnitt durch die gesamte Kette statt
einer Szene in voller Politur:

1. App lokal hochfahren, Seed einspielen, anmelden
2. **Eine echte Szene aufnehmen** — die KI-Szene, weil sie das höchste Risiko
   *und* den höchsten Ertrag trägt: Widget öffnen, Frage tippen, Antwort mit
   Quellen
3. Eine Zoomfahrt mit korrektem Easing und Halt
4. Eine Texteinblendung in Markenschrift, mit korrekter Standzeit
5. Synthetischer Cursor mit Klick-Impuls
6. Endtafel als Plakat
7. `.mp4` und `.webm`, von mir frameweise gegengeprüft

Damit ist danach jede offene Frage beantwortet: Aufnahmequalität, Cursor,
Textlook, Encoding, App-Start — und vor allem die eine, die kein Plan
beantworten kann: **sieht die Handschrift gut aus?**

Was die Vorschau zeigt, ist wegen der ausstehenden Merges Wegwerfware. Was sie
baut — Pipeline, Szenen-Skript, Textmodul — bleibt und wird nach den Merges
einfach neu ausgeführt.

---

## 8 · Offene Punkte

| Punkt | Status |
|---|---|
| Vorschau bauen (Abschnitt 7) | wartet auf Freigabe |
| Offene Branches mergen, Design einfrieren | **blockiert die Endfassung**, nicht die Vorschau |
| Schnittplan (Abschnitt 3) freigeben | offen |
| `GEMINI_API_KEY` für Szene 8 | angeboten, noch nicht da |
| Landingpage-Branch `claude/eigentumsverwaltung-overview-page-bvd4fj` mergen | Sache des Betreibers, **nicht** Teil dieses Plans |

## 9 · Grenzen

- **Kein Voiceover** (keine Sprachsynthese in dieser Umgebung) und **keine
  Musik** (Lizenz). Für ein stummes Hero-Video kein Nachteil — es ist die Norm.
- Szene 8 ohne API-Key nur mit vorhersehbar geseedeter Antwort.
