# Video-Pipeline

Das Werbevideo ist kein Videoprojekt, sondern ein Skript. Ändert sich das
Design der App, wird **neu ausgeführt** statt neu gebaut.

Ergebnis in `out/`:

| Datei | Zweck |
|---|---|
| `hero-full.mp4` / `.webm` | Vollversion, ~50 s, hinter einem Klick |
| `hero-loop.mp4` / `.webm` | Loop, ~16 s, stumm im Autoplay im Hero |
| `hero-poster.jpg` | Plakat = letzter Frame der Vollversion |

## Ablauf

```bash
# 1. Datenbank
pg_ctlcluster 16 main start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\" -c 'CREATE DATABASE portal;'"

cd portal && npm install
cat > .env <<'EOF'
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/portal?schema=public"
SESSION_SECRET="dev-only-secret-mindestens-32-zeichen-lang-1234567890"
APP_MODE="weg"
PORTAL_BASE_URL="http://127.0.0.1:3000"
UPLOAD_DIR="/tmp/portal-uploads"
ASSISTANT_DEMO_ANSWER="Die ordentliche Eigentümerversammlung 2026 findet am 8. August 2026 um 18:30 Uhr statt – im Gemeindesaal, Musterstraße 1 in Gladbeck. Eine Zuschaltung per Video ist möglich."
EOF
npx prisma migrate deploy && npm run db:seed

# 2. Bauen und starten — KEIN next dev, siehe Fallen
npx next build && npx next start -p 3000

# 3. Aufnehmen und schneiden (richtet auch den Demo-Zustand her)
cd .. && bash video/aufnehmen.sh
```

## Warum der Demo-Zustand eigens hergerichtet wird

`prisma/seed.ts` legt die WEG „Musterstraße 12" an, aber unter einer
**professionellen** Organisation. Dann zeigt das Dashboard die Ticket-Statistik
des Verwalters — nicht den geführten Erststart und nicht den Jahresfahrplan,
also genau die beiden Bildschirme, die die Botschaft des Videos tragen.
`aufnehmen.sh` stellt den Kontotyp deshalb auf `selbstverwalter`.

Zweite Feinheit: Die Übersicht **ist** die Einrichtung, solange sie läuft, und
wird danach zum Jahresfahrplan. Das Video braucht beides. Deshalb wird die
Erststart-Szene in einem eigenen Durchgang aufgenommen, in dem die drei
manuellen Einrichtungsschritte kurzzeitig entfernt sind.

## Fünf Fallen, die Zeit gekostet haben

1. **`next dev` funktioniert nicht.** Die CSP der App verbietet `eval`, damit
   hydratisiert React im Dev-Modus nicht — jeder Klick läuft ins Leere, das
   Assistenten-Widget öffnet nie. Immer `next build && next start`.
2. **`recordVideo` ignoriert `deviceScaleFactor`.** Echte 2×-Schärfe gibt es nur
   über `--force-device-scale-factor=2` plus doppelte Aufnahmegröße
   (2560×1440). Sonst kommen 1280×720 heraus und jede Zoomfahrt verwäscht.
3. **Die Aufnahmen haben variable Bildraten.** `zoompan` läuft damit aus dem
   Tritt — aus 3 Sekunden wurden einmal 106. Deshalb steht `fps=30` als
   **erstes** Glied jeder Filterkette.
4. **`-ss` gehört hinter `-i`.** Davor sucht ffmpeg nur zum nächsten Keyframe
   und verfehlt bei diesen Aufnahmen die Stelle um bis zu zwei Sekunden.
5. **Der vorinstallierte Chromium ist älter als das npm-Paket.**
   `executablePath` explizit setzen; `playwright install` ist gesperrt.

## Warum die Aufnahme Marken schreibt

Wie lange eine Seite lädt, schwankt um über eine Sekunde. Mit geschätzten
Schnittzeiten landete die Zoomfahrt regelmäßig in einer noch sichtbaren
Unterzeile und schnitt sie mitten im Wort an. `record.js` schreibt deshalb je
Szene eine `marks.json` (wann die Unterzeile kam und ging, wann gescrollt wurde,
wann die Antwort erschien); `compose.js` rechnet die Schnitte daraus aus.
Damit überlebt der Schnitt jede erneute Aufnahme.

## Der Aufnahme-Patch für den KI-Assistenten

`patches/assistant-demo.patch` ersetzt **ausschließlich den formulierten
Antworttext** durch `ASSISTANT_DEMO_ANSWER`. Die Quellenangaben darunter
stammen unverändert aus `retrieveContext`, also aus echten, rechtegeprüften
Daten. Mit gesetztem `GEMINI_API_KEY` wird der Patch nicht gebraucht — dann ist
auch der Antworttext echt.

Der Patch gehört **nicht** in einen Deployment-Branch. `aufnehmen.sh` spielt ihn
ein und nimmt ihn am Ende wieder zurück.

## Nach jedem Rendern: hinsehen

`compose.js` schreibt die Mitte jeder Einstellung nach `out/cut/`. Daraus
Kontrollbilder ziehen und ansehen:

```bash
FF=$(node -p "require('ffmpeg-static')")
"$FF" -nostdin -y -i out/hero-full.mp4 -ss 12 -vframes 1 out/check/probe.png
```

Geprüft wird: Liegt der Ausschnitt im Bild (ffmpeg klemmt zu große Crops
stillschweigend an den Rand und verschiebt damit die Komposition)? Sind
Zeilenbeschriftungen vollständig — oder schneidet der Ausschnitt sie an, was
kaputt aussieht statt nah dran? Steht das Bild nach der Zufahrt still? Trägt der
letzte Frame als Plakat?
