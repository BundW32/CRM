# Übergabe: Werbevideo für die Startseite

Stand: 27.07.2026 · Für eine **neue Sitzung in einem anderen Account**.

## Was du zuerst tust

Der Skill **`werbevideo`** (`.claude/skills/werbevideo/SKILL.md`) lädt sich
automatisch, sobald am Video gearbeitet wird, und trägt die verbindlichen
Regeln. Er ist die Quelle für das *Wie*.

Daneben:

| Datei | Inhalt |
|---|---|
| `docs/PLAN-Werbevideo-Startseite.md` | Zielgruppe, Botschaft, Schnittplan über neun Einstellungen, Grenzen |
| `video/README.md` | Ablauf zum Nachmachen, vier Umgebungsfallen |
| `video/` | die laufende Pipeline (Aufnahme, Texttafeln, Schnitt) |

## Was steht

Die **Endfassung ist gebaut**: `video/out/hero-full.mp4` (~50 s),
`hero-loop.mp4` (~16 s fürs Autoplay), `hero-poster.jpg`, jeweils auch als
`.webm`. Acht Szenen, alle in der laufenden App aufgenommen:

Hook-Tafel → Jahresfahrplan mit den überfälligen Punkten → geführter Erststart →
Wirtschaftsplan mit den Umlageschlüsseln → Rückstandsliste je Einheit →
Tagesordnung mit Paragraphenbezug → KI-Assistent mit Quellenangabe → Endtafel.

`bash video/aufnehmen.sh` erzeugt alles neu, inklusive Demo-Zustand.

## Was noch offen ist

1. **Neu aufnehmen, sobald die Branches gemergt sind.** Die vorliegende Fassung
   zeigt den Stand von heute; nach den Merges genügt ein erneuter Lauf.
2. **Einbau in die Seite** samt Poster, `prefers-reduced-motion` (dann nur das
   Plakat) und Kurztranskript.
3. **`GEMINI_API_KEY`**, wenn der Antworttext des Assistenten im Video echt sein
   soll statt fest gesetzt (siehe Skill, Abschnitt 5).
4. **Feinschliff nach Sichtung** — Tempo, Zoomtiefe, Formulierungen der
   Unterzeilen. Alles davon ist eine Zahl im Skript, kein Neuschnitt.

## Umgebung zum Loslaufen

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\" -c 'CREATE DATABASE portal;'"

cd portal && npm install
cat > .env <<'EOF'
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/portal?schema=public"
SESSION_SECRET="dev-only-secret-mindestens-32-zeichen-lang-1234567890"
APP_MODE="weg"
PORTAL_BASE_URL="http://127.0.0.1:3000"
UPLOAD_DIR="/tmp/portal-uploads"
EOF
npx prisma migrate deploy && npm run db:seed
npx next build && npx next start -p 3000     # KEIN next dev — siehe Skill, Abschnitt 2
```

Zugänge aus dem Seed: `admin@bundwimmobilien.de` / `BundW-Start2026!`,
`eigentuemer@demo.de` / `Demo-2026!`. Die Seed-Konten haben keine bestätigte
E-Mail; das Banner stört im Bild und lässt sich mit
`update "User" set "emailVerifiedAt"=now();` abstellen.

Playwright und ffmpeg liegen als npm-Pakete; `video/lib/capture.js` bringt die
richtigen Startschalter für den vorinstallierten Chromium mit.

## Die eine Sache, die nicht verhandelbar ist

Das Video ist ein **Skript**, kein Videoprojekt. Wer Clips von Hand
zusammenschneidet, spart einmal eine Stunde und zahlt sie bei jedem
Design-Update erneut.
