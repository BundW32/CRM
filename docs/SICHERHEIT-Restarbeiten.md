# Sicherheit: offene Arbeiten

Fortschreibung zu `docs/SICHERHEITSBERICHT-Marktreife.md`. Was am **29.07.2026**
erledigt wurde, steht unten unter „Erledigt"; alles andere ist offen und nach
Priorität sortiert.

> **Vor dem nächsten Deploy zu erledigen — sonst sperrt sich der Betreiber aus.**
> `isPlatformAdminUser` verlangt jetzt zusätzlich das Datenbank-Flag
> `User.isPlatformAdmin`. In der Produktionsdatenbank muss es für jedes
> Betreiberkonto gesetzt werden, **bevor** die Änderung ausgerollt wird:
> ```sql
> UPDATE "User" SET "isPlatformAdmin" = true
> WHERE lower(email) IN ('<adressen aus PLATFORM_ADMIN_EMAILS>');
> ```
> Der Seed (`prisma/seed.ts`) setzt es bereits; bestehende Installationen nicht
> zwingend. Ohne diesen Schritt ist `/plattform` für niemanden mehr erreichbar.
> Zurückholbar ist das nur über direkten Datenbankzugriff.

---

## P0 — noch offen

### ~~P0-4 Abhängigkeiten aktualisieren, Audit in die CI~~ — erledigt am 06.08.2026

`npm audit --omit=dev` meldet **0 Schwachstellen**: `npm audit fix` eingespielt,
dazu gezielt `next`/`eslint-config-next` auf 16.3.0, `sharp` auf 0.35.3 und
`nodemailer` auf 9.x angehoben (`npm run pruefung` und `npm run test:db` danach
grün). Der Audit-Schritt läuft jetzt als eigener Schritt im Prüfungs-Job
(`npm audit --omit=dev --audit-level=high` in `.github/workflows/pruefung.yml`)
— bewusst NICHT in `npm run pruefung`, das auch im Vercel-Build läuft; ein neu
veröffentlichter CVE färbt so nur den Pull Request rot, statt den Deploy zu
blockieren.

### P0-5 Zugriffskontroll-Tests ausbauen

Das Fundament steht (siehe „Erledigt"), die Abdeckung ist noch dünn. Es fehlen
Prüfungen für:

- alle zwölf Ressourcenarten in `api/files/[kind]/[id]` über Kreuz zwischen zwei
  Organisationen (Beleg, Mietvertrag, Freistellung, Stimmnachweis, Rechnung,
  Übergabefotos, Objektbild, Org-Logo …),
- den Handwerker-Magic-Link gegen Anhänge fremder Aufträge,
- eingeschränkte Verwalter (`PropertyAssignment`) gegen nicht zugewiesene Objekte,
- Eigentümer ohne Beiratskennzeichen gegen die Beiratsbereiche,
- `documentWhereForUser` und `canViewTicket` über Kreuz,
- den DSGVO-Export `/api/export/[userId]` gegen fremde Nutzer.

Aufwand: 2–4 Tage. Kollidiert mit nichts.

---

## P1 — vor dem Marktstart

| # | Was | Aufwand | Kollision |
|---|---|---|---|
| ~~P1-6~~ | ~~Passwort-Reset-Token nur noch gehasht speichern~~ | **erledigt am 29.07.2026** | — |
| ~~P1-7~~ | ~~Erstpasswort nicht mehr über die URL~~ **erledigt am 04.08.2026** (kurzlebiges, pfadgebundenes HttpOnly-Cookie statt `?pw=…`, `lib/zugangsschreiben.ts`) | — | — |
| ~~P1-6b~~ | ~~Rate-Limit auf das **Einlösen** eines Reset-/Bestätigungslinks~~ | **erledigt am 06.08.2026** (Einlösen von Reset- und Bestätigungslinks je 10/h pro IP) | — |
| ~~P1-9~~ | ~~Rate-Limit atomar, für die Anmeldung fail-closed~~ **erledigt am 06.08.2026**; ~~IP-Quelle an die Plattform binden~~ **erledigt am 10.08.2026** (`getClientIp` vertraut auf Vercel nur dem plattform-gesetzten `x-real-ip`; die drei Kopien der Header-Auswertung auf die eine Funktion zusammengezogen) | — | — |
| P1-10 | **MFA** (TOTP + Wiederherstellungscodes), Pflicht für Plattform-Betreiber und Verwalter-SuperAdmins | 3–5 Tage | keine |
| P1-11 | `organizationId` am `AuditLog` (fehlgeschlagene Anmeldungen sind für Kunden heute unsichtbar), Schwellwert-Alarme. **Teilweise erledigt am 10.08.2026:** unbehandelte Serverfehler alarmieren jetzt den Betreiber (`src/instrumentation.ts` + `lib/fehler-alarm.ts`, gedrosselt), dazu `/api/health` für den externen Uptime-Check | 2–4 Tage Rest | keine |
| P1-12 | CSP mit Nonce statt `script-src 'unsafe-inline'`, dazu `object-src 'none'` | 0,5 Tag | `next.config.ts` — geringfügig |
| ~~P1-13~~ | ~~Handwerker-Magic-Link: Ablauf, Rotation, Widerruf in der Oberfläche, alles protokolliert~~ **erledigt am 10.08.2026** (Token läuft nach 90 Tagen ab — `accessTokenIssuedAt` + `lib/craftsman-token.ts`, fail closed; jede Beauftragung erneuert, abgelaufene Tokens werden dabei rotiert; Erneuern/Widerrufen auf der Kontakt-Detailseite mit Rückfrage, beides im Audit-Log; Sperre greift in Seite, Actions UND Datei-Endpunkt) | — | — |

Zusätzlich als Sofortmaßnahme (kleine Ergänzung, heute bewusst zurückgestellt,
weil `nutzer/actions.ts` gerade von einem anderen Branch bearbeitet wird):

- **Adressen aus `PLATFORM_ADMIN_EMAILS` beim Anlegen und Ändern von Nutzern
  serverseitig ablehnen.** Der Angriffsweg ist durch das Datenbank-Flag
  geschlossen; die Sperre verhindert zusätzlich, dass ein Verwalter versehentlich
  ein totes Konto auf einer Betreiberadresse anlegt und die Adresse damit blockiert.
- **`emailVerifiedAt != null`** als weitere Bedingung in `isPlatformAdminUser`.

---

## P2 — erstes Quartal nach Marktstart

- **P2-14** Audit-Log vervollständigen (Passwortänderung, Rollenwechsel,
  Nutzeranlage, Dokumentzugriff, SEPA-Mandate fehlen), append-only auslegen,
  Export für Kunden, Aufbewahrungsfrist über die IP hinaus.
- **P2-15** IBAN, SEPA-Mandate und Steuernummern verschlüsseln.
  `src/lib/crypto.ts` kann es bereits, wird aber nur für Integrations-Secrets
  genutzt. Dabei den Rückfall auf `SESSION_SECRET` entfernen — solange er
  besteht, ist `SESSION_SECRET` **nicht rotierbar**, ohne alle verschlüsselten
  Werte zu verlieren.
- **P2-16** KI: Fremdinhalte im Prompt als Daten abgrenzen (Prompt-Injection über
  eingegangene Dokumente), Verarbeitung protokollieren, API-Schlüssel im Header
  statt in der URL.
- **P2-17** `bodySizeLimit: "200mb"` gilt global für alle Server Actions —
  auf die Upload-Routen begrenzen.
- **P2-18** Löschkonzept je Datenart schriftlich festlegen und umsetzen
  (heute nur Anonymisierung + IP-Bereinigung im Audit-Log).
- **P2-19** Zweite Wand für die Mandantentrennung: PostgreSQL Row Level Security
  oder eine Prisma-Erweiterung, die den Org-Filter zentral erzwingt.

---

## P3 — Nachweise und Betrieb

Kein Code, blockiert aber den Vertrieb genauso hart: TOM nach Art. 32 DSGVO,
Verarbeitungsverzeichnis, Backup- und Wiederanlaufkonzept mit RPO/RTO und
getesteter Wiederherstellung, externer Penetrationstest, Meldeweg für Finder
(`security.txt`), Incident-Response nach Art. 33/34, Verfügbarkeitsmonitoring und
SLA, Lasttests.

Details im Hauptbericht, Abschnitt P3.

---

## Erledigt am 29.07.2026

| Befund | Was gemacht wurde |
|---|---|
| **P0-1** Rechteausweitung über die E-Mail-Adresse | `isPlatformAdminUser` verlangt jetzt **beide** Wände: das Datenbank-Flag `User.isPlatformAdmin` **und** die Env-Allowlist. Das Feld gab es im Schema samt Kommentar „doppelte Wand" bereits — gelesen wurde es nie. Ein Verwalter kann das Flag über keine Anwendungsfunktion setzen; der Weg über ein selbst angelegtes Konto auf einer Betreiberadresse ist damit zu. |
| **P0-2** Sitzungen nicht widerrufbar | `User.sessionsValidFrom` + Migration `20260729170000_sessions_valid_from`. Jedes Token trägt seinen Ausstellungszeitpunkt; liegt er davor, gilt es nicht mehr. `revokeSessions()` wird bei Passwortwechsel, Passwort-Reset, Erstpasswortvergabe und beim Zurücksetzen durch den Verwalter aufgerufen. |
| **P0-3** Token austauschbar | Sitzungs- und Impersonations-Token tragen jetzt einen `typ`-Claim und werden gegen den erwarteten Zweck geprüft. Token ohne `typ` (Altbestand) gelten nicht mehr. |
| **P1-8** Blob-Token an ungeprüften Host | Host-Prüfung als `isBlobUrl()` in `storage.ts` herausgezogen und im Teilbereichs-Pfad von `api/files/[kind]/[id]` **vor** dem Mitschicken des Tokens angewandt. |
| **P0-5** (Fundament) | Testharness gegen echte Datenbank: `src/test/harness.ts`, `vitest.db.config.ts`, `npm run test:db`. |
| **P1-6** Reset-/Bestätigungs-Token im Klartext in der Datenbank | Alle vier Erzeuger (`login/forgot`, `registrieren`, `dashboard/verify-actions`, `verwaltung/nutzer` — Einladung und erneuter Versand) speichern jetzt `hashToken(token)` (SHA-256) statt des Rohwerts; alle drei Verbraucher (`login/reset/[token]` Action und Seite, `registrieren/bestaetigen`) prüfen nur noch gegen den Hash. Eine erste Fassung akzeptierte übergangsweise zusätzlich den Rohwert — das öffnete dieselbe Lücke wieder (wer den gespeicherten Hash kennt, reicht ihn als „Rohwert" ein und trifft auf sich selbst) und wurde durch einen Datenbanktest sofort aufgedeckt, bevor sie auslieferte. |

Testebene jetzt 20 Prüfungen (16 aus dem vorigen Durchgang + `token-hash.test.ts` +
`token-hash.dbtest.ts`), Letzterer hält genau die oben beschriebene Lücke fest,
damit sie kein zweites Mal zurückkommt.

### Was beim Ausrollen zu beachten ist

1. **Das Datenbank-Flag setzen** (siehe Kasten oben) — sonst kein Betreiberzugang mehr.
2. **Alle Nutzer müssen sich einmal neu anmelden.** Token ohne `typ`-Claim gelten
   nicht mehr. Das ist gewollt: Ein Altbestand, der als beides durchginge, wäre
   genau die Lücke, die P0-3 schließt. Am besten in ein Wartungsfenster legen.
3. **Die Datenbankprüfungen laufen nicht in `npm run pruefung`.** Das Skript läuft
   auch im Vercel-Build, wo es keine Datenbank gibt. Sie hängen an
   `npm run test:db` und brauchen eine gesetzte `DATABASE_URL`.
