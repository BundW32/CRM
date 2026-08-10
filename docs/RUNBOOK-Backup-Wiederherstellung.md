# Runbook: Backup & Wiederherstellung

**Zweck:** Audit-Befund B-5 schließen — ein nie getestetes Backup ist Hoffnung,
kein Backup. Dieses Runbook hält fest, was im Ernstfall zu tun ist, und die
Probe weist nach, dass es funktioniert.

**Stand:** 10.08.2026 — Vorlage angelegt. Die mit ☐ markierten Angaben kann nur
der Betreiber mit Zugriff auf die Konten ausfüllen; **erst wenn alle ☐ zu ☑
geworden sind und eine Probe-Wiederherstellung dokumentiert ist, gilt B-5 als
geschlossen.**

---

## 1. Was gesichert werden muss

| Datenbestand | Wo er liegt | Verlust bedeutet |
|---|---|---|
| PostgreSQL-Datenbank | DB-Anbieter (über Vercel angebunden, `DATABASE_URL`) | Buchhaltung, Zugänge, Beschlüsse, Abos — existenzbedrohend für die WEGs, haftungsrelevant für den Betreiber |
| Blob-Store (Vercel Blob) | `BLOB_READ_WRITE_TOKEN`-Store | Belege, Rechnungen, Protokolle, Freistellungsbescheinigungen — die Nachweise zur Buchhaltung |
| Stripe-Daten | Stripe selbst | nichts (Stripe ist die Quelle; der tägliche Abgleich `/api/cron/billing-abgleich` stellt die lokale Kopie wieder her) |
| Umgebungsvariablen | Vercel-Projekt-Settings | Ohne `SESSION_SECRET` sind alle Sitzungen ungültig, ohne SMTP/Stripe-Keys stehen Versand und Billing |

## 2. Vom Betreiber festzuhalten (einmalig klären)

- ☐ **DB-Anbieter und Plan:** ____________________ (z. B. Neon/Vercel Postgres, Plan)
- ☐ **Point-in-Time-Recovery-Fenster:** ______ Tage (beim Anbieter nachsehen;
  bei Neon „History retention", Standard oft nur 1 Tag — für Buchhaltungsdaten
  auf mindestens 7, besser 30 Tage stellen)
- ☐ **Liegen Backups außerhalb des Produktions-Kontos?** ja/nein — wenn nein:
  täglichen `pg_dump` einrichten (siehe Abschnitt 5)
- ☐ **Zielwerte:** max. tolerierter Datenverlust (RPO): ______ (Empfehlung: 1 h)
  · max. tolerierte Ausfallzeit (RTO): ______ (Empfehlung: 4 h)
- ☐ **Env-Variablen gesichert:** Export der Vercel-Projekt-Variablen an einem
  sicheren Ort außerhalb von Vercel (Passwort-Manager des Betreibers), Datum: ______

## 3. Wiederherstellung Datenbank (der Ernstfall)

Typische Auslöser: fehlgeschlagene Migration (gab es bereits —
`repair_failed_migration.sql` im Build zeugt davon), versehentliches Löschen,
Anbieter-Ausfall.

1. **Ruhe bewahren, Schreibzugriffe stoppen:** In Vercel das Deployment auf
   „Paused" stellen oder die `DATABASE_URL` vorübergehend entfernen — eine halb
   wiederhergestellte DB, in die parallel geschrieben wird, ist schlimmer als
   eine Stunde Ausfall.
2. **Zeitpunkt wählen:** letzter Stand VOR dem Schadensereignis (Audit-Log und
   Vercel-Logs helfen bei der Eingrenzung).
3. **Beim DB-Anbieter wiederherstellen** — Konsole des Anbieters, Restore/Branch
   auf den gewählten Zeitpunkt. ☐ Konkrete Klickfolge hier eintragen, sobald
   die Probe (Abschnitt 4) gelaufen ist: ____________________
4. **Neue `DATABASE_URL` in Vercel eintragen** (Restore erzeugt beim manchen
   Anbietern eine neue Instanz/Branch), Redeploy auslösen.
5. **Prüfen:** `/api/health` liefert 200; Login funktioniert; Stichprobe in
   einer WEG (Buchungen, letzte Dokumente); `/api/cron/billing-abgleich` einmal
   manuell aufrufen (gleicht Abo-Status gegen Stripe ab und meldet Drift).
6. **Nacharbeiten:** Betroffene Kunden informieren, wenn Daten aus dem
   RPO-Fenster fehlen; Vorfall mit Zeitleiste in `docs/` festhalten.

## 4. Die Probe (Pflicht, einmal jetzt und dann jährlich)

**In eine Zweitinstanz wiederherstellen — nie in die Produktion:**

1. Beim DB-Anbieter Restore/Branch des Produktionsstands von gestern in eine
   neue Instanz.
2. Lokal `DATABASE_URL` auf die Zweitinstanz setzen, `npm run dev`, anmelden,
   Stichproben (siehe 3.5).
3. Dauer notieren (das ist der echte RTO-Wert), Klickfolge in Abschnitt 3.3
   eintragen, Zweitinstanz löschen.

- ☐ Probe durchgeführt am: ______ · Dauer: ______ · durchgeführt von: ______

## 5. Export außerhalb des Anbieter-Kontos

Schützt gegen den Fall, den PITR nicht abdeckt: Verlust/Sperrung des
Anbieter-Kontos selbst.

- Täglicher `pg_dump` (z. B. GitHub-Action mit Cron oder kleiner Server) in
  einen Speicher, der NICHT am Vercel-/DB-Konto hängt (z. B. S3/Backblaze im
  eigenen Konto, Bucket verschlüsselt, Aufbewahrung 30 Tage).
- ☐ Eingerichtet am: ______ · Ziel: ______ · Wiederherstellung aus dem Dump
  einmal geprobt: ______

**Hinweis Blob-Store:** Vercel Blob hat keine Anbieter-Snapshots. Die Dateien
sind unveränderlich (Uploads überschreiben nichts), das Hauptrisiko ist
versehentliches Löschen über die App — das begrenzen die Lösch-Rückfragen. Für
volle Absicherung denselben Weg wie beim `pg_dump` gehen: periodischer Abzug
der Blob-Objekte in den eigenen Speicher. ☐ Entscheidung des Betreibers:
eingerichtet / bewusst verschoben am ______.

## 6. Wiedervorlage

- Nach jeder größeren Schema-Migration: PITR-Fenster kurz prüfen.
- Jährlich: Probe aus Abschnitt 4 wiederholen, Datum oben nachtragen.
