# Phase 0 — Vorbedingungen

Stand: 11. August 2026 · Grundlage: `docs/PLAN-Consent-Audit-wegportal24.md`

## Umgebung

| Punkt | Befund |
|---|---|
| Repository | `/home/user/CRM`, Arbeitsverzeichnis der Anwendung: `portal/` |
| Branch | `claude/new-session-qcmb34` |
| Node | v22.22.2 |
| Paketmanager | npm 10.9.7 (`package-lock.json` vorhanden, kein pnpm/yarn) |
| Next.js | 16.3.0 |
| React | 19.2.4 |
| Router | **App Router** (`portal/src/app/`), keine `pages/`-Verzeichnisse |
| Middleware | Next.js 16 nennt sie **`proxy.ts`** — hier `portal/src/proxy.ts`. Eine Datei `middleware.ts` existiert nicht und wäre in dieser Version wirkungslos. |
| Styling | Tailwind CSS 4 über `@tailwindcss/postcss` |
| Prüfbefehl | `npm run pruefung` = `tsc --noEmit && eslint && vitest run` |

### Abweichung vom Plan: Branch-Name

Der Plan nennt `feat/consent-overhaul`. Die Sitzungsvorgabe schreibt
`claude/new-session-qcmb34` verbindlich vor. Es wird auf dem vorgegebenen Branch
gearbeitet; der Plan ist inhaltlich davon nicht berührt.

## Zwei Marken, eine Codebasis — für das Audit entscheidend

Die Anwendung bedient über `APP_MODE` (`portal/src/lib/app-mode.ts`) zwei Produkte:

- `APP_MODE=weg` → **wegportal24.de** (Gegenstand dieses Audits)
- sonst → **portal.bundwimmobilien.de** (B&W Kundenportal)

Der Modus schaltet Titel, Logos, Favicons, Robots-Angaben **und Teile der
Rechtstexte** um (`portal/src/app/datenschutz/page.tsx:28`). Jedes Laufzeit-Audit
muss deshalb mit `APP_MODE=weg` laufen, sonst wird die falsche Tür geprüft.

## Zugänge und offene Punkte

| Punkt | Stand |
|---|---|
| Staging-URL | **offen** — nicht bekannt. Phase 2 läuft ersatzweise gegen einen lokalen Dev-Build. |
| Testzugang eingeloggter Bereich | **offen** — für Szenario E/F der Phase 2 nötig. Alternative: Seed-Datenbank (`npm run db:seed`) mit lokalem Postgres. |
| Datenbank für lokalen Lauf | `DATABASE_URL` erforderlich; die Anwendung startet ohne sie nicht vollständig. |
| Playwright | im Repository **nicht** als Abhängigkeit geführt (`portal/package.json`). Chromium liegt unter `/opt/pw-browsers`; für Phase 2 muss `@playwright/test` als Dev-Abhängigkeit ergänzt und `executablePath` gesetzt werden. |

Diese vier Punkte blockieren Phase 1 nicht, wohl aber den vollständigen
Laufzeit-Nachweis in Phase 2. Sie sind vor Gate 2 zu klären.

## Grenzen dieses Audits

Dieser Plan und alle daraus entstehenden Dokumente sind **keine Rechtsberatung**.
Die endgültige Kategorisierung der Dienste und die Rechtstexte gehören vor einen
Fachanwalt oder die/den Datenschutzbeauftragte(n).

**Gate 0: erfüllt** — mit den vier oben offen markierten Punkten.
