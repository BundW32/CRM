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

Eine **~14-sekündige Vorschau** ist gebaut und läuft: Hook-Tafel → synthetischer
Zeiger klickt den KI-Assistenten → Frage wird getippt → Antwort erscheint mit
Quellenangabe, Zufahrt → Endtafel. Alles echte Aufnahmen der laufenden App in
2560×1440, ausgegeben als `.mp4` und `.webm` mit Poster.

Damit ist bewiesen: Aufnahme, synthetischer Cursor, Tippanimation, Zoomfahrt mit
Easing, Texttafeln in Markenschrift, Encoding und die Sichtprüfung über
Einzelbilder funktionieren alle.

## Was fehlt

1. **Demo-Daten für eine selbstverwaltete WEG.** `prisma/seed.ts` legt die WEG
   „Musterstraße 12" bereits an, aber in einer **professionellen** Organisation —
   die Aufnahme zeigt deshalb das Verwalter-Dashboard statt des geführten
   Erststarts und des Jahresfahrplans. Gebraucht wird eine selbstverwaltete
   Organisation mit **beschlossenem Wirtschaftsplan und Sollstellungen**.
   Achtung, bekannte Falle: Der Kostenkatalog verteilt auch nach Fläche und
   Personenzahl — fehlen die Werte, blockiert der Plan
   (`UEBERGABE-WEG-Selbstverwaltung.md`, Abschnitt 2.1).
2. **Die übrigen acht Szenen** aus dem Schnittplan (Plan, Abschnitt 3).
3. **Die Loop-Fassung** (12–15 s) fürs Autoplay, Endbild ≈ Anfangsbild.
4. **Einbau in die Seite** samt Poster, `prefers-reduced-motion` und Transkript.

## Was zuerst geklärt sein muss

- **Die offenen Branches sind gemergt und das Design steht.** Vorher aufgenommene
  Szenen zeigen eine App, die es danach nicht mehr gibt. (Die Vorschau war
  bewusst die Ausnahme: Ihr Zweck war die Technik, nicht das Bild.)
- **Der Schnittplan ist freigegeben** (Plan, Abschnitt 3).
- **`GEMINI_API_KEY`** liegt vor — oder es wird ohne ihn gearbeitet, siehe Skill
  Abschnitt 5.

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
