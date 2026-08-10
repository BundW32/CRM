# Release-Check Werbestart — wegportal24.de

**Datum:** 10.08.2026 · **Stand:** Commit `fb6688c` · **Frage:** Ist der jetzige Stand
bereit für bezahlte Werbung (Anzeigen) und die damit verbundene Skalierung?
**Methode:** Fortschreibung des SaaS-Fundament-Checks vom 06.08.2026
(`AUDIT-SaaS-Fundament-2026-08-06.md`) — jeder dortige Befund wurde am heutigen
Code nachgeprüft, dazu die eigene Meilenstein-Tabelle des Audits als Maßstab.

**Prüfnachweis heute:** `npm run pruefung` grün (541 Tests in 65 Dateien,
TypeScript und ESLint ohne Fehler), `npm audit --omit=dev --audit-level=high`
meldet 0 Schwachstellen.

---

## Antwort in einem Satz

**Fachlich und technisch ist das Produkt releasefähig — die Billing-Kette steht
vollständig und geprüft. Für den Werbestart fehlen aber noch zwei betriebliche
Punkte, die der eigene Audit genau für diesen Meilenstein als Bedingung nennt:
Monitoring (B-4) und ein geprobtes Backup (B-5). Beides zusammen sind 2–3
Arbeitstage. Empfehlung: erst diese beiden Punkte schließen, dann Anzeigen
schalten.**

---

## 1. Was seit dem Audit vom 06.08. geschlossen wurde (im Code verifiziert)

Der Audit verlangte für den Meilenstein „Bezahlpflicht / Preis-Launch" die
Befunde B-1, B-2, B-3, B-9. Stand heute:

| Befund | Stand 10.08. | Nachweis im Code |
|---|---|---|
| B-1 Abo-Status ohne Wirkung | ✅ geschlossen | `zugriffsStatus()` + `hatPlanFunktion()` in `lib/billing.ts`; Trial-Ablauf fällt auf Start-Umfang zurück, Plan-Gates sperren serverseitig (Commit `5820a22`), Abo-Banner in der Shell. |
| B-2 Dependency-Schwachstellen | ✅ geschlossen | 0 Schwachstellen (heute erneut geprüft); Audit-Schritt läuft in der CI; pdfjs-dist-CVE am 07.08. nachgezogen (`74fffd0`). |
| B-3 Webhook-Lücken | ✅ geschlossen | `invoice.payment_failed` und `trial_will_end` behandelt, Idempotenz über `StripeEvent`-Tabelle, Alarm-Mails (`api/billing/webhook/route.ts`). |
| B-8 Reconciliation | ✅ geschlossen | Täglicher Cron `/api/cron/billing-abgleich` (05:00) in `vercel.json`. |
| B-9 Preismodell | ✅ im Wesentlichen | Preise sind entschieden und live: Basic 10 €, Verwalter-Plus 13,90 € je Einheit/Monat, Stellplatz 1 €, Mengenstaffel, Selfservice-Grenze 12 Einheiten. Checkout legt Preise inline an (`price_data`), Mengen-Sync und Tarifwechsel vorhanden. **Restpunkt siehe 2c.** |
| B-10 Rate-Limit | ✅ geschlossen | Atomar (`INSERT … ON CONFLICT`), Anmeldung fail-closed. |
| B-11 Data-URL-Fallback | ✅ geschlossen | Produktion bricht ohne Blob-Store hart ab. |

**B-7 (synchrone Serienvorgänge) ist für diesen Launch entschärft, nicht
behoben:** Einladungs-/Serienversand läuft weiter synchron per `Promise.all`
in der Server-Action (`versammlungen/actions.ts:379`). Durch die
Selfservice-Grenze von **12 Einheiten** (`preise-daten.ts`) ist die Seriengröße
aber fachlich klein begrenzt — ein Laufzeitabbruch ist bei dieser Zielgruppe
unwahrscheinlich. Der Doppelversand-Schutz (`gerade_versendet`-Claim) ist da.
Der Punkt wird erst real, wenn die Einheiten-Grenze angehoben wird oder die
B&W-Tür große Bestände fährt — dann vor der Anhebung das Häppchen-Muster bauen.

## 2. Was vor dem Anzeigen-Start noch fehlt

Die Meilenstein-Tabelle des Audits nennt für „Marktstart-Werbung / Wachstum"
die Befunde B-4, B-5, B-7. B-7 ist entschärft (s. o.), die anderen beiden sind
**unverändert offen** — beides Betriebs-, kein Code-Thema:

### a) 🔴 B-4 · Kein Error-Tracking, kein Uptime-Monitoring (heute geprüft: weiterhin nichts im Code)

Werbung bedeutet: Fremde, zahlende Besucher treffen auf das Produkt, und
niemand kennt sie. Ein Fehler in Registrierung, Checkout oder Einrichtung
bleibt heute unsichtbar, bis jemand eine Mail schreibt — die meisten schreiben
keine, sie sind einfach weg. **Das Anzeigenbudget bezahlt dann Besucher, deren
Scheitern niemand bemerkt.**

Konkret (≈ 1 Tag):
1. Sentry (EU-Region, AVV abschließen, in die Subprozessoren-Liste der
   Datenschutzerklärung aufnehmen) für Server und Client.
2. Externer Uptime-Check (z. B. auf `/preise` und eine kleine Health-Route)
   mit Alarm aufs Handy.
3. Die vorhandenen Alarm-Mails (`BILLING_ALERT_EMAIL`) auf eine Adresse legen,
   die tatsächlich täglich gelesen wird.

### b) 🔴 B-5 · Backup nie geprobt, kein Runbook (heute geprüft: weiterhin nichts dokumentiert)

Das Produkt speichert Buchhaltung von Eigentümergemeinschaften. Ein nie
getestetes Backup ist Hoffnung, kein Backup — und `repair_failed_migration.sql`
im Build-Befehl zeigt, dass es den Ernstfall (fehlgeschlagene Migration in
Produktion) schon einmal gab.

Konkret (1–2 Tage, danach ~1 h pro Quartal):
1. Beim DB-Anbieter klären und **schriftlich festhalten**: Point-in-Time-
   Recovery-Fenster, wo die Backups liegen.
2. Einmal eine Wiederherstellung in eine Zweitinstanz durchspielen; Vorgehen
   als 1-Seiten-Runbook in `docs/`.
3. Blob-Store (Belege, Protokolle) ins Konzept aufnehmen; regelmäßiger
   `pg_dump`-Export außerhalb des Vercel-Kontos.

### c) 🟠 Vor der ersten echten Zahlung: Rechnungsstellung/USt in Stripe

Die Preis-Entscheidung „Endpreise inkl. MwSt." ist getroffen und steht in AGB
und Preisseite — gut. Im Checkout ist aber kein Stripe Tax konfiguriert
(`billing-checkout.ts`, kein `automatic_tax`). Vor der ersten echten Buchung im
Stripe-Dashboard klären: Rechnungsversand an Kunden aktiv, USt-Ausweis auf der
Rechnung korrekt (Bruttopreis mit enthaltener Steuer), Smart Retries /
Mahn-E-Mails konfiguriert. Reines Konfigurationsthema, kein Code (½ Tag mit
Testbuchung im Live-Modus).

### d) 🟠 Sicherheits-Restarbeiten: eigener Plan sagt „vor Marktstart"

`SICHERHEIT-Restarbeiten.md` stuft mehrere offene Punkte als **P1 = vor dem
Marktstart** ein; heute im Code nachgeprüft, alle noch offen:

- **MFA** für Betreiber- und SuperAdmin-Konten (P1-10) — wichtigster Punkt der
  Reihe; die Betreiberkonten können die Daten *aller* Gemeinschaften einsehen.
- Erstpasswort in der URL (P1-7, 2 Std.), Rest von P1-9 (IP-Quelle, 2 Std.),
  CSP-Nonce (P1-12, ½ Tag), Handwerker-Magic-Link ohne Ablauf (P1-13, 1 Tag —
  im Schema geprüft: `Craftsman.accessToken` hat weiterhin kein Ablauffeld),
  Kreuztest-Abdeckung der Datei-Endpunkte (P0-5, 2–4 Tage).

Ehrliche Einordnung: **Keiner dieser Punkte muss den Anzeigen-Start blockieren**
— die Mandantentrennung selbst ist getestet und trägt. Aber der eigene Plan hat
sie bewusst vor den Marktstart gelegt; wer jetzt startet, sollte diese
Entscheidung bewusst revidieren (Beschluss festhalten) statt sie zu übergehen.
Empfehlung: MFA und die beiden 2-Stunden-Punkte (P1-7, P1-9-Rest) noch
mitnehmen, den Rest terminiert ins erste Quartal.

## 3. Was für den Start bereits trägt (nicht erneut aufreißen)

- **Billing Ende-zu-Ende:** Registrierung setzt `trialEndsAt`, Trial läuft auf
  Pro-Niveau, Ablauf fällt kontrolliert auf den Start-Umfang zurück (keine
  Aussperrung — gute Conversion-Entscheidung), Checkout mit Mengen aus dem
  Bestand, Webhook idempotent mit Alarmierung, täglicher Stripe-Abgleich.
- **Mandantentrennung** mit DB-Kreuztests in der CI; 541 Tests grün.
- **Rechtliches:** AGB, AVV, Datenschutz, Impressum, Widerruf,
  § 312k-Kündigungsbutton, DSGVO-Export und -Anonymisierung, Brutto-Preise
  konsistent auf Preisseite und in AGB.
- **Marketing-Oberfläche:** Startseite, Funktionsseiten, Preisseite mit
  funktionierenden Buchen-Knöpfen — die Anzeigen haben ein Ziel, das trägt.
- **Skalierung im beworbenen Rahmen:** Zielgruppe selbstverwaltete WEGs bis 12
  Einheiten; bei diesem Zuschnitt sind Serverless + Postgres + die vorhandenen
  116 Indexe weit vom ersten Engpass entfernt. Die Engpass-Reihenfolge bei
  Wachstum (Serienversand → Rate-Limit-Tabelle → Connection-Pooling) steht im
  Audit vom 06.08. und gilt unverändert.

## 4. Empfohlene Reihenfolge bis zum Anzeigen-Start

| Schritt | Aufwand | Blockiert Start? |
|---|---|---|
| 1. Sentry + Uptime-Check + Alarm-Adresse (B-4) | 1 Tag | **Ja** |
| 2. Backup klären, Restore proben, Runbook (B-5) | 1–2 Tage | **Ja** |
| 3. Stripe: Rechnungen/USt/Smart-Retries mit Live-Testbuchung prüfen (2c) | ½ Tag | Ja, vor der ersten Zahlung |
| 4. MFA für Betreiber/SuperAdmins + P1-7 + P1-9-Rest | 3–5 Tage | Empfohlen, formal Entscheidung des Betreibers |
| 5. Anzeigen klein starten, Funnel beobachten (Registrierung → Einrichtung → Buchung), dann Budget hoch | — | — |

Wiedervorlage des Fundament-Checks: nach den ersten ~50 zahlenden
Organisationen oder in 6 Monaten — je nachdem, was zuerst eintritt.
