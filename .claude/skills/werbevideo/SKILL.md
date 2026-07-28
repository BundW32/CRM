---
name: werbevideo
description: Regeln und Werkzeuge für die Werbevideos dieses Portals — echte Aufnahmen der laufenden App mit Playwright, Schnitt mit ffmpeg, Texttafeln als HTML. Immer heranziehen, wenn am Hero-/Werbevideo, an Szenen-Skripten, am Schnitt, an Texteinblendungen oder am Storyboard gearbeitet wird, oder wenn Screenshots/Aufnahmen aus der App für Marketing entstehen sollen.
---

# Werbevideos für das Portal

Ein ~50-sekündiges Werbevideo für die öffentliche Startseite plus eine 12–15 s
Loop-Fassung fürs Autoplay. Stumm, deutsch, echte Aufnahmen der laufenden App.

**Zuerst lesen:**
- `docs/PLAN-Werbevideo-Startseite.md` — Zielgruppe, Botschaft, Schnittplan, offene Punkte.
- `video/README.md` — der Ablauf zum Nachmachen.

Eine ~14-sekündige Vorschau ist gebaut und funktioniert. Sie ist der Beweis,
dass die Kette trägt — nicht die Endfassung.

---

## 1 · Das Grundprinzip

> **Das Video ist kein Videoprojekt, sondern ein Skript.**

Aufnahme, Zoomfahrten, Schnitt, Texttafeln und Encoding liegen vollständig in
Code unter `video/`. Ändert sich das Design der App, wird **neu ausgeführt**,
nicht neu gebaut. Wer anfängt, Clips von Hand zusammenzusetzen, zerstört genau
diese Eigenschaft.

Kein Remotion, kein Schnittprogramm, kein zusätzliches Framework. Geprüft und
bewusst verworfen: Remotions Lizenz ist ab einer gewissen Firmengröße
kostenpflichtig, und es rendert über eine eigene Chrome-Instanz, deren Download
in dieser Umgebung gesperrt ist.

---

## 2 · Die vier Fallen der Umgebung

Alle vier haben schon Zeit gekostet. Sie stehen ausführlich in `video/README.md`.

1. **`next dev` ist unbrauchbar.** Die CSP der App verbietet `eval`, dadurch
   hydratisiert React nicht und **kein Klick funktioniert**. Immer
   `next build && next start`.
2. **`recordVideo` ignoriert `deviceScaleFactor`.** Echte Schärfe nur über
   `--force-device-scale-factor=2` plus doppelte Aufnahmegröße (2560×1440).
3. **Die Aufnahmen haben variable Bildraten.** `zoompan` läuft damit aus dem
   Tritt (aus 3 Sekunden wurden 106). Deshalb steht `fps=30` als **erstes**
   Glied in jeder ffmpeg-Filterkette.
4. **Der vorinstallierte Chromium passt nicht zum npm-Paket.**
   `executablePath` explizit setzen, `playwright install` ist gesperrt.

---

## 3 · Handwerk — bindend für jeden Schnitt

### Lesbarkeit ist die härteste Grenze, nicht die Laufzeit

Das Video ist stumm. Also entscheidet die Lesegeschwindigkeit, wie viel es sagen kann.

- **~14 Zeichen pro Sekunde** ansetzen — die Zielgruppe ist teils älter und liest nebenbei.
- Jede Einblendung steht **mindestens 2 s**, höchstens 6 s. Handlungsaufruf 3–5 s.
- Höchstens 2 Zeilen, ca. 42 Zeichen je Zeile.
- Daraus folgt: **10–14 Einblendungen auf 50 s**, im Loop drei bis vier. Das ist
  eine Rechengröße, keine Geschmacksfrage.
- Standzeit aus der Textlänge **rechnen**, nie fest verdrahten.

### Bewegung

- **Jeder Zoom braucht einen Grund** — die Kamera fährt dorthin, wo der Blick
  gleich lesen muss. Permanenter Leichtzoom über allem ist *das* Erkennungszeichen
  des Amateurschnitts.
- **Zoom kommt an und steht dann.** Nicht bis zum Schnitt weiterlaufen.
- Niemals lineare Bewegung — immer weich an- und abbremsen (ease-out).
  Kein Bounce, kein Überschwingen bei Text: wirkt verspielt, nicht seriös.
- **Ruhe nach der Bewegung:** ~0,4 s Stillstand vor dem Schnitt. Das Auge liest
  nichts Bewegtes.
- Höchstens eine Bewegungsart gleichzeitig.

### Schnitt

- Einstellungen 1,5–3 s. Nichts unter 0,6 s, nichts über 5 s.
- **Auf die Bewegung schneiden**, nicht danach — das versteckt die Naht.
- **Harte Schnitte als Regel.** Kreuzblende nur bei echtem Zeitsprung;
  durchgehendes Überblenden *ist* der Diashow-Look.
- Verboten: Schiebe-Übergänge, 3D-Flips, Whoosh-Effekte.
- Tempowechsel: schnell durch Wege, langsam auf dem Ergebnis.
- Beim Loop: Endbild ≈ Anfangsbild, sonst schlägt die Schleife sichtbar um.
- **Der letzte Frame ist das Plakat** (Poster bei pausiertem Video) und muss
  allein funktionieren.

### Cursor und Eingabe

`video/lib/capture.js` bringt das alles mit — benutzen, nicht neu erfinden.

- Zeiger synthetisch: gekrümmte Bahn, weiches Abbremsen, minimales Überschwingen.
  Ein aufgezeichneter Zeiger springt und wirkt roboterhaft.
- Klick = dezenter Ring-Impuls.
- Tippen mit 25–40 ms je Zeichen **mit Streuung**, danach eine deutliche Pause
  vor der Antwort. Diese Pause erzeugt die Erwartung, die den Effekt trägt.

---

## 4 · Inhalt und Sprache

**Zuschauer:** Eigentümer oder Beirat einer kleinen WEG (2–10 Einheiten), der die
Verwaltung ehrenamtlich übernimmt. Er fühlt **Überforderung und Haftungsangst**,
nicht Effizienzdruck. Er will die Gewissheit, nichts falsch zu machen.

**Fachbegriffe nutzen** — sie schaffen Glaubwürdigkeit: Wirtschaftsplan, Hausgeld,
Eigentümerversammlung, Beschlusssammlung, Umlaufbeschluss, Erhaltungsrücklage.

**Jargon vermeiden:** „Onboarding", „Cloud-basierte SaaS-Plattform",
„Workflow-Digitalisierung", „Mandantenfähigkeit", „PropTech".

### Drei Aussagen, die nicht ins Video gehören

Keine Ersparnis in Euro oder Prozent (nicht belegbar), keine Kundenzahlen
(gibt es nicht), kein „rechtssicher" (Haftungszusage des Betreibers).
Erlaubt sind belegbare Signale: Serverstandort, DSGVO, kostenlos starten.

**Der stärkste Beleg ist ohnehin ein anderer:** Der KI-Assistent liefert seine
Antwort **mit verlinkter Quelle** (`AssistantResult.sources`). Dass eine KI
antwortet, beeindruckt niemanden mehr; dass sie den Beschluss zeigt, aus dem die
Zahl stammt, überzeugt einen misstrauischen Beirat. Diese Szene ist der Kern des
Videos — nicht eine unter vielen.

### Was das Video leisten muss, und was nicht

Die Landingpage (`claude/eigentumsverwaltung-overview-page-bvd4fj`) erklärt den
Aufbau bereits selbst, über eine scrollgesteuerte Szene aus **gezeichneten**
Elementen. Das Video darf diese Erklärung nicht doppeln. Seine Aufgabe ist die
Lücke, die die Seite lässt: **Es gibt dort nirgends einen Blick in die echte
Software.** Das Video ist der Beweis, nicht der Erklärbogen — also kurz und dicht.

---

## 5 · Der KI-Assistent in der Aufnahme

Der Assistent läuft über Gemini und ist per Vorgabe aus (`AI_ASSISTANT_ENABLED` +
`GEMINI_API_KEY`, siehe `portal/src/lib/assistant.ts`).

- **Mit Key:** nichts weiter tun, die Antwort im Video ist echt.
- **Ohne Key:** `video/patches/assistant-demo.patch` einspielen. Er ersetzt
  **ausschließlich den formulierten Antworttext**; die Quellen darunter kommen
  unverändert aus `retrieveContext`, also aus echten, rechtegeprüften Daten.

Der Patch wird nach der Aufnahme **zurückgenommen** und gehört in keinen
Deployment-Branch. Und: keine Antwort erfinden, die die App so nicht liefern würde.

---

## 6 · Immer gegenprüfen, nie blind rendern

Nach jedem Rendern Einzelbilder aus dem **fertigen** Video ziehen und ansehen:

```bash
FF=$(node -p "require('ffmpeg-static')")
for t in 1.5 3.5 5 7 9 11; do "$FF" -y -ss $t -i out/vorschau.mp4 -vframes 1 out/check/c$t.png; done
```

15–25 Kontrollbilder pro Durchlauf reichen. Geprüft wird: Ist der Ausschnitt
innerhalb des Bildes (ffmpeg klemmt zu große Crops stillschweigend an den Rand
und verschiebt damit die Bildkomposition)? Ist Text lesbar? Steht das Bild nach
der Zoomfahrt still? Trägt der letzte Frame als Plakat?

Die Laufzeit des Videos kostet praktisch nichts — Rendern ist Prozessorarbeit.
Teuer sind die Korrekturschleifen. Deshalb: Handschrift an einer kurzen Vorschau
klären, bevor neun Szenen daran hängen.
