# Plan: Werbevideo für die Startseite (Selbstverwalter-WEG)

Stand: 27.07.2026 · **Noch nichts gebaut.** Dieses Dokument legt fest, *was*
gebaut wird, *wie* geschnitten wird und *wann* aufgenommen werden darf.

Zielbild: ein ca. 50 Sekunden langes, stummes Hero-Video für die öffentliche
Startseite der WEG-SaaS-Variante (`APP_MODE=weg`). Echte Aufnahmen aus der
laufenden App, keine Mockups.

---

## 0 · Reihenfolge — warum jetzt noch nicht aufgenommen wird

Mehrere Branches sind noch nicht gemergt und verändern das Design. Jede
Aufnahme, die vorher entsteht, zeigt eine App, die es danach nicht mehr gibt.

Daraus folgt die wichtigste Entscheidung dieses Plans:

> **Das Video ist kein Videoprojekt, sondern ein Skript.**

Aufnahme, Schnitt, Zoomfahrten, Texteinblendungen und Encoding liegen
vollständig in Code (`video/` — Playwright-Fahrplan + ffmpeg-Rezept). Ein
Design-Update heißt dann: Skript neu laufen lassen, fertig. Nicht: alles noch
einmal von Hand bauen. Das kostet beim ersten Mal etwas mehr und rettet jedes
weitere Mal den ganzen Aufwand.

Aufgenommen wird erst, wenn:

1. die offenen Branches gemergt sind und das Design steht,
2. der Schnittplan (Abschnitt 3) freigegeben ist.

Bis dahin lassen sich Demo-Daten und Pipeline gefahrlos vorbereiten — beide
sind vom Aussehen der Oberfläche unabhängig.

---

## 1 · Zielgruppe und Botschaft

Der Zuschauer ist **kein Immobilienprofi**. Es ist ein Eigentümer oder Beirat
einer kleinen WEG, der die Verwaltung ehrenamtlich übernommen hat oder gerade
übernehmen soll. Typischerweise: acht bis zwanzig Einheiten, ein Bankkonto,
Excel, ein Aktenordner, und die begründete Sorge, etwas Fristgebundenes zu
übersehen.

Was diese Person **fühlt**: Überforderung und Haftungsangst. Nicht
Effizienzdruck. Ein Profi-Verwalter will Durchsatz — dieser Mensch will die
Gewissheit, nichts falsch zu machen.

Was sie **sucht**: „Sagt mir, was jetzt dran ist, und rechne richtig."

Daraus die Leitbotschaft des Videos:

> **Die Verwaltung führt dich durch das Jahr. Du musst nicht wissen, was als
> Nächstes dran ist — das System weiß es.**

Das ist keine Marketing-Erfindung, sondern exakt das, was gebaut wurde:
`lib/weg/setup-status.ts` (geführter Erststart, acht Schritte, einer als „Als
Nächstes") und `lib/weg/roadmap.ts` (Jahresfahrplan, überfällig zuerst).

**Was das Video nicht behauptet:** keine Zeitersparnis in Prozent, keine
erfundenen Kundenzahlen, keine Rechtssicherheits-Versprechen. Die Zielgruppe
ist misstrauisch gegenüber genau diesen Sätzen — und wir könnten sie nicht
belegen.

---

## 2 · Handwerk: was ein Software-Werbevideo von einer Bildschirmaufnahme trennt

Diese Regeln sind bindend für den Schnitt. Sie sind der Unterschied zwischen
„professionell" und „Bildschirmaufnahme mit Zoom drüber".

### Bewegung

- **Jeder Zoom braucht einen Grund.** Die Kamera fährt dorthin, wo der Blick
  gleich lesen muss — nie als Dekoration. Ein Video, in dem permanent leicht
  gezoomt wird, ist das Erkennungszeichen des Amateurschnitts.
- **Niemals lineare Bewegung.** Jede Fahrt beschleunigt und bremst sanft
  (ease-in-out). Lineare Zooms wirken maschinell.
- **Ruhe nach der Bewegung.** Jede Einstellung kommt an und steht dann ca. 0,4 s
  still, bevor geschnitten wird. Das Auge kann Bewegtes nicht lesen.
- Höchstens **eine** Bewegungsart gleichzeitig: entweder Zoom, oder Pan, oder
  ein Element bewegt sich in der UI. Nicht zwei.

### Schnitt

- Durchschnittliche Einstellungslänge **1,5–3 s**. Nichts unter 0,6 s (nicht
  lesbar), nichts über 5 s (Stillstand).
- **Auf die Bewegung schneiden**: der Schnitt liegt mitten in einer Aktion, nicht
  danach. Das versteckt die Naht.
- **Match-Cut**, wo möglich: das Element, das in Einstellung A rechts unten
  steht, steht in B an gleicher Stelle. Erzeugt den Eindruck eines
  durchgehenden Raums statt einer Diashow.
- Überblendungen nur bei echtem Zeitsprung. **Verboten:** Schiebe-Übergänge,
  3D-Flips, Whoosh-Effekte, Sternchen. Das sind die klassischen Verräter.
- **Tempowechsel** statt gleichmäßigem Fluss: schnell durch Navigation und
  Wege, langsam auf dem Ergebnis. Der Zuschauer soll das Ziel sehen, nicht den
  Weg dorthin.

### Cursor und Eingabe

- Der Mauszeiger wird **synthetisch** animiert: gekrümmte Bahn, sanftes
  Abbremsen, minimales Überschwingen am Ziel. Ein echter aufgezeichneter
  Mauszeiger springt und wirkt roboterhaft.
- Klick = kurzer, dezenter Ring-Impuls. Kein Kreis, kein Knallgeräusch.
- Tippen niemals in Echtzeit-Tastaturgeschwindigkeit: ca. 25–40 ms pro Zeichen
  mit leichter Streuung, danach eine deutliche Pause vor der Antwort. Die Pause
  erzeugt die Erwartung, die den WOW-Moment trägt.

### Text

- **3 bis 7 Wörter** pro Einblendung. Ein Gedanke.
- Text und UI konkurrieren nie: entweder der Zuschauer liest die Einblendung
  (UI leicht abgedunkelt/unscharf), oder er liest die Oberfläche.
- Einblendung: 200 ms Aufblenden mit 4 px Aufwärtsbewegung, mindestens 1,2 s
  stehen lassen.
- Eine Schriftgröße, eine Stärke, Markenfarben. Keine zweite Schriftart.

### Rahmenbedingungen

- **Stumm gedacht.** Das Video muss ohne Ton vollständig verständlich sein —
  Hero-Videos laufen stumm im Autoplay. Kein Voiceover, keine Musik (siehe
  Abschnitt 6).
- **Der letzte Frame ist das Plakat.** Er steht als Standbild, solange das Video
  nicht läuft, und muss allein funktionieren: Logo, Claim, Handlungsaufruf.
- Konstante Sicherheitsabstände; Browser-Chrome wird weggeschnitten oder durch
  einen dezenten Fensterrahmen ersetzt — einheitlich über alle Einstellungen.

### Dramaturgie für 50 Sekunden

| Phase | Dauer | Aufgabe |
|---|---|---|
| Hook | 0–5 s | Das Problem konkret zeigen, nicht benennen |
| Versprechen | 5–8 s | Die eine Aussage |
| Beleg | 8–36 s | 4–5 Szenen, je: Problem → ein Klick → Ergebnis |
| WOW | 36–46 s | Die KI-Szene |
| Handlungsaufruf | 46–50 s | Steht still, wird zum Plakat |

Jede Beleg-Szene beantwortet genau eine Frage des Zuschauers. Szenen, die nur
„auch noch da" sind, fliegen raus — Vollständigkeit ist der Feind eines
Werbevideos.

**Vorschlag:** Diese Regeln zusätzlich als Skill `saas-promo-video` ablegen,
damit sie bei jedem Re-Render und jedem künftigen Video automatisch gelten.

---

## 3 · Schnittplan (Entwurf, zur Freigabe)

Aufnahmen aus der echten App mit gepflegten Demo-Daten: WEG „Musterstraße 12",
12 Einheiten, plausible Beträge, ein Rückstand, eine anstehende Versammlung.

| # | Zeit | Bild | Bewegung | Einblendung |
|---|---|---|---|---|
| 1 | 0:00–0:05 | Kalter Einstieg auf den **Jahresfahrplan**, überfällige Position oben, rot | Langsame Fahrt von der Liste auf die überfällige Zeile | „Was ist als Nächstes dran?" |
| 2 | 0:05–0:08 | Fahrplan gesamt, ruhig | Steht | „Ihre WEG. Ohne Verwalter. Ohne Blindflug." |
| 3 | 0:08–0:14 | **Geführter Erststart** (`SetupGuide`): acht Schritte, „Als Nächstes" hervorgehoben | Zoom auf den hervorgehobenen Schritt | „Acht Schritte. Einer nach dem anderen." |
| 4 | 0:14–0:21 | **Wirtschaftsplan**: Planwerte, Verteilung nach MEA / Fläche / Personen | Pan über die Verteilungsspalte, Endsumme zählt hoch | „Verteilt nach dem richtigen Schlüssel." |
| 5 | 0:21–0:27 | **Hausgeld / Sollstellungen**: wer zahlt was, offener Rückstand markiert | Schneller Weg, dann Halt auf der Rückstandszeile | „Wer hat gezahlt — und wer nicht." |
| 6 | 0:27–0:32 | **Jahresabrechnung**: Einzelabrechnung einer Einheit | Zoom auf Abrechnungsspitze | „Jahresabrechnung, fertig gerechnet." |
| 7 | 0:32–0:36 | **Versammlung**: Tagesordnungspunkt wird gezogen, Beschluss mit Mehrheitshinweis | Cursor zieht, kurzer Halt auf dem Hinweis | „Beschlüsse, die halten." |
| 8 | 0:36–0:46 | **KI-Assistent** öffnet sich, Frage wird getippt, Antwort erscheint **mit Quellenangabe** | Zoom auf das Widget, Halt auf den Quellen-Chips | „Fragen Sie einfach." |
| 9 | 0:46–0:50 | Logo, Claim, „Kostenlos einrichten" | Steht — Endframe = Plakat | — |

**Zur Szene 8:** Der WOW-Effekt liegt nicht darin, dass eine KI antwortet — das
erwartet 2026 jeder. Er liegt darin, dass sie **die Quelle mitliefert**
(`AssistantResult.sources`: Beschluss, Wirtschaftsplan, Aushang, jeweils
verlinkt). Genau das ist der Punkt, an dem ein misstrauischer Beirat glaubt,
dass die Antwort stimmt. Die Frage wird entsprechend gewählt, z. B.:

> „Wie hoch ist mein Hausgeld ab Januar und wer hat das beschlossen?"

Antwort: Betrag + Verweis auf den Beschluss der letzten Versammlung, mit
klickbarer Quelle. Das ist belegbar echt, kein Werbetrick.

---

## 4 · Technik (geprüft, nicht vermutet)

Die Kette wurde in dieser Umgebung real durchgespielt: Chromium starten, Seite
aufzeichnen, Zoomfahrt per ffmpeg rendern, H.264 ausgeben, Einzelbilder wieder
herausziehen und prüfen. Funktioniert.

- **Aufnahme:** Playwright, Chromium unter
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (die vorinstallierte
  Version ist älter als das npm-Paket; `executablePath` setzen,
  `PLAYWRIGHT_BROWSERS_PATH` auf ein Verzeichnis mit Symlink auf
  `ffmpeg-1011`). Kein `playwright install` — der Download ist gesperrt.
- **Auflösung:** Viewport 1440×900 bei `deviceScaleFactor: 2` → Quelle
  2880×1800. Master 1920×1080. So bleiben Zoomfahrten bis ca. 1,5× scharf.
- **Schnitt/Effekte:** `ffmpeg-static`, Zoom über Crop-Keyframes mit
  Ease-Kurve, Overlays als PNG-Ebenen.
- **Ausgabe:** `hero.mp4` (H.264) + `hero.webm` (VP9) + `hero-poster.jpg`.
  Budget: unter 4 MB, sonst kostet es mehr Absprünge als es gewinnt.
- **Daten:** Postgres 16 lokal, eigenes Demo-Seed getrennt von `prisma/seed.ts`.
- **Qualitätsprüfung:** Frames aus dem fertigen Video extrahieren und
  ansehen — jede Einstellung wird geprüft, nicht blind gerendert.

### Einbindung (später, separat)

`autoplay muted loop playsinline preload="metadata"`, Poster als Standbild,
`prefers-reduced-motion: reduce` → nur Poster. Am Landingpage-Text wird
**nichts** geändert (ausdrückliche Vorgabe).

---

## 5 · Offene Punkte

| Punkt | Status |
|---|---|
| Offene Branches mergen, Design einfrieren | **blockiert die Aufnahme** |
| Schnittplan (Abschnitt 3) freigeben | offen |
| `GEMINI_API_KEY` für Szene 8 | angeboten, noch nicht da |
| Landingpage-Integration (`page.tsx:19` ist Platzhalter) | ausdrücklich **nicht** Teil dieses Plans |

---

## 6 · Grenzen, offen benannt

- **Kein Voiceover.** In dieser Umgebung gibt es keine Sprachsynthese. Für ein
  stummes Hero-Video ist das kein Nachteil; falls später Stimme gewünscht ist,
  muss sie eingesprochen oder extern erzeugt werden.
- **Keine Musik.** Lizenzfrage, hier nicht lösbar.
- **Szene 8 ohne API-Key:** Der Assistent läuft über Gemini und ist per Vorgabe
  aus (`AI_ASSISTANT_ENABLED` + `GEMINI_API_KEY`, siehe `lib/assistant.ts`).
  Mit Key wird eine echte Antwort aufgezeichnet. Ohne Key werden die Demo-Daten
  so gesetzt, dass die Antwort vorhersehbar ist — aber es wird **keine** Antwort
  erfunden, die die App so nicht liefern würde.
