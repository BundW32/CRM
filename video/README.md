# Video-Pipeline

Das Werbevideo ist kein Videoprojekt, sondern ein Skript: Ändert sich das
Design, wird neu ausgeführt statt neu gebaut.

## Ablauf

```bash
# 1. Datenbank und App (einmalig)
pg_ctlcluster 16 main start
cd portal && npx prisma migrate deploy && npm run db:seed
npx next build && npx next start -p 3000     # KEIN next dev: siehe unten

# 2. Aufnahme-Patch für den Assistenten (nur ohne GEMINI_API_KEY nötig)
git apply video/patches/assistant-demo.patch
#    dazu in portal/.env: ASSISTANT_DEMO_ANSWER="…"

# 3. Aufnehmen und schneiden
node video/preview.js
bash video/compose.sh        # → video/out/vorschau.mp4 / .webm / -poster.jpg

# 4. Patch zurücknehmen
git checkout portal/src/lib/assistant.ts
```

## Vier Fallen, die Zeit gekostet haben

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

## Der Aufnahme-Patch

`patches/assistant-demo.patch` ersetzt **ausschließlich den formulierten
Antworttext** des KI-Assistenten durch einen festen String. Die Quellenangaben
darunter stammen unverändert aus `retrieveContext`, also aus echten,
rechtegeprüften Daten. Mit gesetztem `GEMINI_API_KEY` wird der Patch nicht
gebraucht — dann ist auch der Antworttext echt.

Der Patch gehört **nicht** in einen Deployment-Branch.
