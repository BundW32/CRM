# Video-Pipeline

Das Werbevideo ist kein Videoprojekt, sondern ein Skript: Ändert sich das
Design, wird neu ausgeführt statt neu gebaut.

## Ablauf

```bash
# 1. Datenbank und App (einmalig)
pg_ctlcluster 16 main start
su postgres -c "psql -c \"CREATE USER crm WITH PASSWORD 'crm' SUPERUSER;\" -c 'CREATE DATABASE crm OWNER crm;'"
export DATABASE_URL="postgresql://crm:crm@127.0.0.1:5432/crm"
cd portal && npx prisma migrate deploy && npm run db:seed
NODE_PATH=$PWD/node_modules npx tsx ../video/seed-video.ts   # Aufnahme-Demodaten
npx next build && npx next start -p 3200     # KEIN next dev: siehe unten

# 2. Abhängigkeiten der Pipeline (Playwright + ffmpeg)
cd ../video && npm install

# 3. Vollversion aufnehmen und schneiden (~33 s, 1920×1080)
psql -c 'DELETE FROM "RateLimit";'   # sonst greift die Anmeldesperre
PREVIEW_BASE_URL=http://127.0.0.1:3200 node werbevideo.js
PROGRESS=1 LOGO_FROM=8 node compose-werbevideo.mjs

# 4. Hero-Schleife fürs Autoplay (~10 s, ohne Balken und Logo-Bug)
PREVIEW_BASE_URL=http://127.0.0.1:3200 node hero-loop.js
VIDEO_NAME=hero-loop MANIFEST=manifest-loop.json node compose-werbevideo.mjs
```

`PROGRESS=1` blendet den Fortschrittsbalken ein, `LOGO_FROM=8` das Logo ab
Sekunde 8 — beides gehört zur Werbefassung, nicht in die Schleife.

Die WEG-Kennung steckt nicht im Skript: `VIDEO_WEG_ID` setzen, wenn der Seed
neu eingespielt wurde (`select id from "Property" where "immoware24Id"='demo-weg-1'`).

### Wie der Schnitt gesteuert wird

`werbevideo.js` schreibt beim Aufnehmen `out/manifest.json` — je Einstellung
Startzeit, Standzeit und optionale Zufahrt. `compose-werbevideo.mjs` schneidet
danach. Damit gibt es **keine von Hand gepflegten Zeitmarken**, die beim
nächsten Lauf nicht mehr stimmen.

Zwei Dinge, die dabei Zeit gekostet haben:

- **Die Zeitmarken zählen ab dem Anlegen der Seite, nicht ab der ersten
  Aktion.** Die Aufzeichnung läuft schon während Navigation und Aufbau; wer ab
  Aktionsbeginn zählt, schneidet vor die Einblendung und zeigt eine leere Seite.
- **Ein enger Ausschnitt plus Zufahrt vergrößert doppelt.** 78 % Breite und
  `zoom 1.12` ergeben zusammen das 1,4-Fache — Spalten fallen aus dem Bild.
  Deshalb: leichte Zufahrt (1.06–1.08) auf das volle Bild, die Kamerafahrt
  macht die Seite selbst per Scroll.

### Vorschau (ältere, kurze Fassung)

```bash
git apply video/patches/assistant-demo.patch   # nur ohne GEMINI_API_KEY nötig
node video/preview.js && bash video/compose.sh # → out/vorschau.mp4
git checkout portal/src/lib/assistant.ts
```

## Sieben Fallen, die Zeit gekostet haben

1. **`next dev` funktioniert nicht.** Die CSP der App verbietet `eval`, damit
   hydratisiert React im Dev-Modus nicht — jeder Klick läuft ins Leere. Für die
   Aufnahme immer `next build && next start`.
2. **`recordVideo` ignoriert `deviceScaleFactor`.** Echte 2×-Schärfe gibt es nur
   über den Startschalter `--force-device-scale-factor=2` plus doppelte
   Aufnahmegröße. Ohne das kommen 1280×720 heraus und jede Zoomfahrt verwäscht.
3. **Die Aufnahmen haben variable Bildraten.** `zoompan` läuft damit aus dem
   Tritt (aus 3 Sekunden wurden 106). Deshalb steht in jeder Filterkette
   `fps=30` an erster Stelle.
4. **Der vorinstallierte Chromium ist älter als das npm-Paket.** `executablePath`
   explizit setzen; `playwright install` ist in dieser Umgebung gesperrt.
5. **Die App sperrt nach fünf Anmeldeversuchen je IP** (`RateLimit`, siehe
   `src/lib/rate-limit.ts`). Das ist richtig so — für wiederholte Aufnahmeläufe
   muss die Tabelle vorher geleert werden:
   `psql -c 'DELETE FROM "RateLimit";'`
6. **Die Einblendung liegt in der Aufnahme, nicht darüber.** Eine Zufahrt
   vergrößert sie mit und schneidet sie an. Deshalb steht der Satz zuerst im
   Vollbild, und die Kamera fährt erst danach auf den Beleg — nie gleichzeitig.
7. **Ein Zeiger, der Schritt für Schritt vom Skript gesetzt wird, ist zu
   langsam.** Jeder Aufruf über die Fernsteuerung kostet rund 100 ms; der Weg
   dauerte dreieinhalb Sekunden, länger als die Einstellung. Die Bahn wird
   deshalb **in der Seite** gerechnet (`moveCursor`).

## Der Aufnahme-Patch

`patches/assistant-demo.patch` ersetzt **ausschließlich den formulierten
Antworttext** des KI-Assistenten durch einen festen String. Die Quellenangaben
darunter stammen unverändert aus `retrieveContext`, also aus echten,
rechtegeprüften Daten. Mit gesetztem `GEMINI_API_KEY` wird der Patch nicht
gebraucht — dann ist auch der Antworttext echt.

Der Patch gehört **nicht** in einen Deployment-Branch.
