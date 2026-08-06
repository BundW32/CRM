# SaaS-Fundament-Check — wegportal24 / B&W Kundenportal

**Datum:** 06.08.2026 · **Stand:** Commit `f78368b` · **Prüfumfang:** `portal/` (gesamte Codebasis, Schema, CI, Betriebskonfiguration)
**Methode:** Systematischer Audit nach den vier Prüfbereichen Architektur & Datenmodell, Abo & Billing, Sicherheit & Mandantentrennung & DSGVO, Betrieb & Observability. Jeder Befund ist am konkreten Code festgemacht und an den Reifegrad gekoppelt.

**Reifegrad-Einordnung:** SaaS in der Frühphase — Registrierung mit Testphase läuft, Stripe-Anbindung ist als Gerüst vorhanden, der Pro-Preis ist noch nicht festgelegt (`STRIPE_PRICE_PRO` offen, `monthlyPriceCents: null`). Zielgruppe: selbstverwaltete WEGs (wegportal24.de) und die eigene Hausverwaltung (B&W Kundenportal), beide aus einer Codebasis (`APP_MODE`). EU-Kunden → DSGVO verpflichtend.

---

## 1. Management-Zusammenfassung

Das Fundament ist deutlich besser als bei den meisten SaaS-Produkten in diesem Stadium: Die Mandantentrennung ist zentral in `src/lib/access.ts` verankert, wird durch Kreuztests gegen eine echte Datenbank in der CI geprüft, Sitzungen sind widerrufbar, Uploads liegen privat im Objekt-Speicher, und die Sicherheitsarbeit ist mit zwei eigenen Berichten (`SICHERHEITSBERICHT-Marktreife.md`, `SICHERHEIT-Restarbeiten.md`) selbstkritisch dokumentiert — die dort als P0 markierten Rechteausweitungs- und Sitzungs-Lücken sind nachweislich geschlossen. Auch Architektur und Datenmodell tragen: modularer Monolith, versionierte Migrationen, die in der CI von null aufgebaut werden, 116 Indexe, idempotenter Bankimport.

**Die größte Baustelle ist das Abo-System.** Der Abo-Status hat heute keinerlei Wirkung im Produkt: Kein Code prüft `subscriptionStatus`, `trialEndsAt` oder den Plan beim Zugriff — eine abgelaufene Testphase oder ein gekündigtes Abo ändert nichts am Funktionsumfang. Dazu fehlen im Webhook die Fehlzahlungs- und Trial-Ende-Events, Idempotenz und jede Alarmierung. Solange kein Preis verlangt wird, kostet das nichts; ab dem Tag der Bezahlpflicht ist es stiller Umsatzverlust. **Zweitgrößte Baustelle:** Es gibt kein Error-Tracking und kein Uptime-Monitoring — der Betreiber erfährt von Fehlern durch Kunden, nicht vor ihnen. Drittens sind 11 bekannte Schwachstellen in Abhängigkeiten offen (6 „high", darunter ein Next.js-Middleware/Proxy-Bypass, der genau die Mandanten-Auflösung in `src/proxy.ts` betrifft), obwohl `npm audit fix` für alle einen Fix anbietet.

Die drei wichtigsten Maßnahmen: **(1)** Abo-Durchsetzung zentral einbauen und den Webhook vervollständigen — vor dem Start der Bezahlpflicht. **(2)** `npm audit fix` einspielen und den Audit-Schritt in die CI hängen. **(3)** Error-Tracking + externes Uptime-Monitoring einrichten und die Datenbank-Wiederherstellung einmal tatsächlich proben.

---

## 2. Scorecard

| Prüfbereich | Note | Begründung (ein Satz) |
|---|---|---|
| Architektur & Datenmodell | **8/10** | Modularer Monolith mit zentraler Zugriffsschicht, sauberen Migrationen und durchdachtem Datenmodell; Abzüge für fehlende Job-Queue und nicht-atomares Rate-Limit. |
| Abo & Billing | **4/10** | Signaturprüfung und Customer-Portal sind da, aber der Abo-Status steuert nichts, Pflicht-Events fehlen, keine Idempotenz, keine Alarmierung — als Gerüst in Ordnung, für Bezahlbetrieb nicht. |
| Sicherheit, Mandanten & DSGVO | **7/10** | Vorbildliche Mandantentrennung mit echten DB-Kreuztests und ehrlicher Eigendokumentation; Abzüge für offene Dependency-Schwachstellen, fehlendes MFA und dünne Testabdeckung der Datei-Endpunkte. |
| Betrieb, Observability & Kosten | **5/10** | CI doppelt aufgehängt und Deploy-Disziplin gut, aber blind im Betrieb: kein Error-Tracking, kein Monitoring, Backup/Restore ungeprüft. |

---

## 3. Befunde nach Priorität

### 🔴 Kritisch (vor dem Start der Bezahlpflicht beheben)

#### B-1 · Abo-Status hat keine Wirkung — Zugriff ist nicht ans Abo gekoppelt
**Befund:** `Organization.subscriptionStatus`, `trialEndsAt` und `aktiverPlan()` (`src/lib/billing.ts:73`) werden ausschließlich auf der Abrechnungs-Seite, in `/plattform` und im Webhook gelesen. Weder `getSession()`/`requireUser()` (`src/lib/session.ts`) noch das Portal-Layout noch irgendeine Action prüft, ob die Organisation zahlt, testet oder gekündigt hat. `loadUser` prüft nur `organization.active` — ein Flag, das nur der Plattform-Betreiber von Hand setzt.
**Warum das ein Problem ist:** Ablauf der Testphase → nichts passiert. Kündigung über das Stripe-Portal → der Webhook setzt brav `canceled`, der Kunde arbeitet unverändert weiter. Fehlgeschlagene Zahlung → `past_due`, keine Konsequenz. Das ist das klassische stille Billing-Leck: Es fällt erst beim Zahlenabgleich Monate nach dem Marktstart auf.
**Behebung:** Eine zentrale Funktion (z. B. `zugriffsStatus(org)` in `billing.ts`) entscheidet aus `subscriptionStatus` + `trialEndsAt` über `voll | kulanz | gesperrt` — mit definierter Kulanzfrist für `past_due` und Lesezugriff-oder-Sperre nach Trial-Ende (bewusst entscheiden, nicht dem Zufall überlassen). Durchsetzen an EINER Stelle: im Portal-Layout bzw. `requireUser()`-Pfad mit Redirect auf `/verwaltung/abrechnung`. Plattform-Admin und Impersonation ausnehmen. Ein DB-Test nach dem Muster des Harnischs hält fest, dass eine `canceled`-Org nicht mehr hineinkommt.
**Aufwand:** M (1–2 Tage inkl. Tests). Solange kein Preis verlangt wird, formal 🟠 — er wird 🔴 am Tag der ersten Rechnung, und der Einbau ist jetzt billiger als später.

#### B-2 · Offene Dependency-Schwachstellen, darunter Next.js-Proxy-Bypass
**Befund:** `npm audit --omit=dev` meldet 11 Schwachstellen (6 high, 5 moderate): Next.js 16.2.9 (u. a. Middleware/Proxy-Bypass GHSA-6gpp-xcg3-4w24, SSRF in Server Actions, Cache-Confusion), `undici`, `fast-uri`, `hono`/`@hono/node-server` über Prisma. Für alle bietet `npm audit fix` einen Fix an. Bereits am 29.07. als P0-4 in `docs/SICHERHEIT-Restarbeiten.md` festgehalten, seither unverändert.
**Warum das ein Problem ist:** Der Middleware-Bypass betrifft genau `src/proxy.ts` — die Stelle, die den Mandanten-Slug aus dem Hostnamen ableitet und fremde `x-tenant-slug`-Header löscht. Ein Bypass dieser Schicht rührt an der Mandantentrennung. Die übrigen High-Findings (undici Response-Queue-Poisoning, fast-uri Host-Confusion) treffen HTTP-Clients, die u. a. für Blob-Zugriffe mit Token laufen.
**Behebung:** `npm audit fix` einspielen, `npm run pruefung` + `test:db` laufen lassen, deployen. Danach `npm audit --omit=dev --audit-level=high` als eigenen Schritt in `.github/workflows/pruefung.yml` (NICHT in `npm run pruefung` — das läuft im Vercel-Build und ein neuer CVE würde sonst grundlos den Deploy blockieren; so steht es richtig schon im eigenen Bericht).
**Aufwand:** S (0,5 Tag inkl. Regressionslauf).

### 🟠 Hoch (blockiert Skalierung oder wird mit jedem Kunden teurer)

#### B-3 · Webhook: fehlende Events, keine Idempotenz, Reihenfolge-Lücke, keine Alarmierung
**Befund:** `src/app/api/billing/webhook/route.ts` behandelt nur `checkout.session.completed` und `customer.subscription.updated/deleted`. Es fehlen `invoice.payment_failed` und `customer.subscription.trial_will_end`. Event-IDs werden nicht gespeichert (keine Idempotenz-Prüfung). Reihenfolge-Lücke: Trifft ein `subscription.updated` vor dem `checkout.session.completed` ein, kennt noch keine Organisation die Subscription-/Customer-ID — das `updateMany` trifft nichts, das Event geht verloren, der Status driftet. Zudem überschreibt der Checkout-Zweig `stripeCustomerId` mit `null`, wenn `session.customer` kein String ist. Fehler landen nur in `console.error` (immerhin mit 500-Antwort → Stripe wiederholt).
**Warum das ein Problem ist:** Jede dieser Lücken erzeugt still auseinanderlaufende Zustände zwischen Stripe und der eigenen Datenbank — verbunden mit B-1 heißt das: Zugriff und Zahlung entkoppeln sich unbemerkt. Ohne `payment_failed`-Behandlung gibt es keinen Dunning-Anstoß (Kunde informieren, Zahlungsmittel-Link), ohne `trial_will_end` keine Erinnerung — beides direkt umsatzrelevant.
**Behebung:** (1) Tabelle `StripeEvent(id, createdAt)` mit Unique auf der Event-ID; vor Verarbeitung einfügen, bei Konflikt 200 zurück. (2) Beide Zusatz-Events abonnieren und behandeln (Mail an SuperAdmin + Statuswechsel). (3) Statt Feld-Patchwork den Zielzustand aus dem Event-Objekt lesen und `stripeCustomerId` nie mit `null` überschreiben. (4) Bei Verarbeitungsfehler zusätzlich eine Alert-Mail (Webhook-Fehler = stiller Umsatzfehler). In Stripe Smart Retries und das Dunning-Verhalten bewusst konfigurieren.
**Aufwand:** M (1–2 Tage).

#### B-4 · Kein Error-Tracking, kein Uptime-Monitoring, keine Alerts
**Befund:** Kein Sentry o. ä. im Code (`grep` leer), Fehler laufen in `console.error` und damit in Vercel-Logs mit kurzer Aufbewahrung. Kein externer Healthcheck, keine Alarmierung auf Fehlerrate, Webhook-Fehler oder Cron-Ausfälle. Der eigene Bericht führt das unter P1-11/P3, umgesetzt ist es nicht.
**Warum das ein Problem ist:** Ein Fehler in der Jahresabrechnung, ein stiller Cron-Ausfall (`/api/cron/cleanup` = DSGVO-Aufbewahrung!) oder ein Webhook-Dauerfehler bleiben unbemerkt, bis ein Kunde anruft. Für ein Produkt, das Buchhaltung und Fristen (Mahnwesen, Prüfpflichten) verwaltet, ist das Vertrauensrisiko größer als das technische.
**Behebung:** Sentry (EU-Region, AVV abschließen, in Subprozessoren-Liste aufnehmen) für Server + Client; externer Uptime-Check auf eine Health-Route; Alert-Mail bei Webhook-/Cron-Fehlern. 
**Aufwand:** S–M (1 Tag Grundausbau).

#### B-5 · Backup & Wiederherstellung: nicht nachweisbar, nie geprobt
**Befund:** Im Repo existiert kein Backup-Konzept; der eigene Bericht (P3) benennt es als offen. Die Datenbank läuft mutmaßlich als verwaltetes Postgres über Vercel — welche Point-in-Time-Recovery-Fenster gelten, ob Backups außerhalb des Produktions-Kontos liegen und ob eine Wiederherstellung je durchgespielt wurde, ist nirgends festgehalten. Blob-Uploads (Belege, Verträge, Protokolle) tauchen in keinem Backup-Gedanken auf.
**Warum das ein Problem ist:** Ein nie getestetes Backup ist Hoffnung, kein Backup. Das Produkt speichert Buchhaltungsdaten, deren Verlust für eine WEG existenzbedrohend und für den Betreiber haftungsrelevant ist. Zusätzlich: `buildCommand` führt `repair_failed_migration.sql` bei jedem Build aus — es gab also bereits eine fehlgeschlagene Migration in Produktion; genau dieser Fall braucht Point-in-Time-Recovery.
**Behebung:** (1) Beim DB-Anbieter PITR-Fenster und Backup-Lage klären und schriftlich festhalten (RPO/RTO grob definieren — z. B. „max. 1 h Datenverlust, 4 h Ausfall"). (2) Einmal eine Wiederherstellung in eine Zweitinstanz durchspielen und das Vorgehen als Runbook (1 Seite) ablegen. (3) Regelmäßiger Export außerhalb des Vercel-Kontos (z. B. täglicher `pg_dump` in einen separaten S3-Bucket). (4) Blob-Store in das Konzept aufnehmen.
**Aufwand:** M (1–2 Tage, danach ~1 h pro Quartal).

#### B-6 · Bekannte offene Sicherheits-Restarbeiten (P0-5, P1-Reihe)
**Befund:** Die eigene Fortschreibung `docs/SICHERHEIT-Restarbeiten.md` listet offen: Zugriffstest-Abdeckung der zwölf Ressourcenarten in `api/files/[kind]/[id]` (Kreuztests), Handwerker-Magic-Link ohne Ablauf/Rotation (`Craftsman.accessToken`), kein MFA (v. a. für SuperAdmins/Betreiber), Rate-Limit nicht atomar und fail-open auch für die Anmeldung, Erstpasswort in der URL, CSP mit `unsafe-inline`, `bodySizeLimit: "200mb"` global (`next.config.ts` — DoS-Fläche auf jeder Action), `AuditLog` ohne `organizationId`.
**Warum das ein Problem ist:** Einzeln sind das 🟠/🟡-Punkte; zusammen bilden sie die Lücke zwischen „gut gebaut" und „nachweisbar sicher". Der Magic-Link ohne Ablauf ist davon der konkreteste: Ein einmal geleakter Link (E-Mail-Weiterleitung genügt) öffnet Auftrags- und Rechnungsdaten dauerhaft.
**Behebung:** Reihenfolge des eigenen Plans folgen; als Nächstes P0-5-Kreuztests (2–4 Tage, verhindert Regressionen aller weiteren Arbeiten) und Magic-Link-Ablauf (1 Tag). MFA vor der Akquise professioneller Verwaltungen.
**Aufwand:** L (verteilt; die Priorisierung im eigenen Dokument ist richtig).

#### B-7 · Kein asynchroner Arbeitspfad — Massenversand und PDF-Erzeugung laufen im Request
**Befund:** Keine Job-Queue (kein bullmq/inngest/…); E-Mails (nodemailer/SMTP), PDF-Erzeugung und Serienvorgänge (Versammlungs-Einladungen, Mahnläufe, Abrechnungsdokumente je Einheit) laufen synchron in Server Actions. Dass es `WEG_STATEMENT_DOCUMENTS_RETRIED` gibt, zeigt: Teilfehlschläge kommen vor und werden bereits von Hand nachgefahren.
**Warum das ein Problem ist:** Vercel-Funktionen haben Laufzeitlimits. Eine WEG mit 60 Einheiten × Einladung + Anhang oder ein Abrechnungslauf über viele Einheiten wird irgendwann mitten im Lauf abgebrochen — halb versendete Serien sind das hässlichste Fehlerbild, das ein Verwalter erleben kann. Das ist der erste Engpass bei 10× Last.
**Behebung:** Für den heutigen Reifegrad reicht ein leichter Weg: Serienvorgänge in Häppchen verarbeiten (Status je Empfänger in der DB, Fortsetzung per Cron oder erneutem Aufruf — das Muster aus `WEG_STATEMENT_DOCUMENTS_RETRIED` verallgemeinern). Eine echte Queue (z. B. Inngest/QStash, EU-Region + AVV) erst, wenn die Häppchen-Lösung spürbar knirscht.
**Aufwand:** M je Serienvorgang; zuerst Einladungs- und Mahnversand.

### 🟡 Mittel (in den nächsten 1–3 Monaten einplanen)

- **B-8 · Kein Stripe-Reconciliation:** Kein Abgleich lokale Abo-Status ↔ Stripe (Drift aus B-3 bliebe unentdeckt). Monatlicher Cron, der alle Organisationen mit `stripeSubscriptionId` gegen die Stripe-API prüft und Abweichungen meldet. Aufwand S.
- **B-9 · Umsatzsteuer/Rechnungsstellung fürs SaaS-Abo ungeklärt:** Für die Plattform-Rechnungen (B&W) existiert ein eigener Service; für die künftigen Stripe-Abos ist Stripe Tax / Rechnungsversand nicht konfiguriert (nicht prüfbar im Code). Vor Bezahlstart klären: Stripe Tax aktivieren, Rechnungs-E-Mails an Kunden, USt-ID-Erfassung für B2B. Aufwand S–M (v. a. Konfiguration).
- **B-10 · Rate-Limit-Tabelle als heißer Punkt:** `checkRateLimit` (Lesen-Prüfen-Erhöhen, fail-open) ist unter Last sowohl umgehbar als auch ein Schreib-Hotspot auf einer einzigen Tabelle. Atomares `UPDATE … RETURNING`, für Login fail-closed; bei Wachstum auf Redis/Upstash umziehen. Bereits als P1-9 bekannt. Aufwand S.
- **B-11 · Data-URL-Fallback für Uploads in der Datenbank:** Ohne `BLOB_READ_WRITE_TOKEN` landen Dateien bis 5 MB als Base64 in der DB (`storage.ts`). Als Preview-Fallback klug, in Produktion ein schleichender DB-Aufbläher — sicherstellen (z. B. Startup-Check), dass Produktion nie ohne Blob läuft. Aufwand S.
- **B-12 · IBAN, SEPA-Mandate, Steuernummern unverschlüsselt** (P2-15 des eigenen Berichts): `crypto.ts` kann Feldverschlüsselung bereits; dabei den Rückfall auf `SESSION_SECRET` als Ableitungsquelle entfernen, sonst ist das Session-Secret nie rotierbar. Aufwand M.
- **B-13 · Kosten pro Mandant unbekannt:** Keine Budget-Alerts/Kostenrechnung erkennbar. Vor der Preisfestlegung grob ermitteln (Vercel + DB + Blob + Mail ÷ aktive Orgs) — ohne diese Zahl ist der Pro-Preis geraten. Aufwand S (halber Tag, danach Routine).
- **B-14 · Fairness-Grenzen je Mandant fehlen:** Außer dem globalen Body-Limit gibt es keine Quoten (Speicher je Org, Mailversand je Tag). Ein einzelner Mandant kann unbegrenzt Kosten erzeugen („noisy neighbor"). Einfache Zähler + weiche Grenzen genügen zunächst. Aufwand M.

### 🟢 Solide — darauf lässt sich bauen

- **Mandantentrennung als System, nicht als Konvention:** Zentrale `…WhereFor…`-Filter in `src/lib/access.ts` mit Org-Wand auch für SuperAdmins; Datei-Endpunkt `api/files/[kind]/[id]` prüft je Ressourcenart Organisation UND Objekt-Scope; Suchpfade nur über die Access-Filter. Die Regel „Filter verengen, nie erweitern" steht verbindlich in `AGENTS.md`.
- **Kreuztests gegen echte Datenbank in der CI:** `src/test/harness.ts` seedet zwei Organisationen, Zugriffsfunktionen werden in beide Richtungen befragt; eigener CI-Job mit Postgres-Container, Migrationen von null. Genau die Testarchitektur, die Mandantentrennung braucht — sie muss „nur" noch breiter werden (B-6).
- **Sitzungs-Sicherheit:** JWT mit `typ`-Claim, HttpOnly/Secure/SameSite, Widerruf über `sessionsValidFrom` bei Passwortwechsel/Reset/„überall abmelden"; Impersonation getrennt signiert, zeitlich begrenzt, protokolliert.
- **Datei-Sicherheit:** Privater Blob-Store, Host-Prüfung vor jedem Token-Abruf (SSRF-/Exfiltrations-Schutz in `isBlobUrl`), Typ- und Größenprüfung, signierte Auslieferung nur über autorisierte Routen.
- **Schema-Disziplin:** `organizationId` auf praktisch allen mandantenbezogenen Modellen (91 Vorkommen), 116 Indexe, DB-Unique als Idempotenzschutz beim Bankimport, versionierte, handgeschriebene Migrationen.
- **Rechtliches Fundament:** AGB/AVV/Datenschutz/Impressum/Widerruf als Seiten, Zustimmungs-Nachweis mit Version/IP/User-Agent bei Registrierung, Kündigungsbutton nach § 312k BGB sauber begründet umgesetzt (`/kuendigen`), DSGVO-Export (Art. 20) und Anonymisierung (Art. 17) implementiert, IP-Retention im Audit-Log (90 Tage) per Cron.
- **CI/Deploy-Disziplin:** Eine Prüfkette (`npm run pruefung`) mit zwei Aufrufern (GitHub + Vercel-Build als Rückfallebene), DB-Tests im eigenen Job, Cron-Endpunkte mit `CRON_SECRET`, Inbound-E-Mail mit Secret + Rate-Limit.
- **Dokumentationskultur:** `AGENTS.md`, `DECISIONS.md` und die Sicherheitsberichte machen das System übernehmbar — der Busfaktor ist deutlich besser als üblich.

---

## 4. Skalierungs-Roadmap

**Was bricht zuerst bei 10× Last?**
1. **Synchrone Serienvorgänge** (B-7): Einladungs-/Mahn-/Abrechnungsläufe reißen an Funktions-Laufzeitlimits. → Häppchen-Muster jetzt etablieren.
2. **Rate-Limit-Tabelle** (B-10): Schreib-Hotspot + fail-open. → Atomar machen, später Redis.
3. **Verbindungs-Haushalt:** Serverless-Funktionen × Prisma-Pool gegen Postgres — beim DB-Anbieter klären, ob ein Pooler (pgbouncer/Neon-Pooling) vor der DB sitzt, bevor Verbindungsfehler unter Last raten lassen.

**Was bricht bei 100×?**
Schreiblast auf `Booking`/`DuePosting`/`AuditLog` (Kandidaten für Archivierung/Partitionierung je Wirtschaftsjahr), fehlende Lese-Replikate, Volltextsuche über Access-Filter hinweg. Nichts davon heute bauen — aber die Entscheidung, die den Weg offen hält, ist bereits richtig getroffen: geteiltes Schema mit `organizationId` überall erlaubt später sowohl RLS (P2-19) als auch Sharding nach Organisation.

**Heutige Entscheidungen, die den Weg offen halten:** `organizationId` konsequent (✓ vorhanden), zentrale Zugriffsschicht (✓), Abo-Durchsetzung an einer Stelle statt verstreuter Plan-Abfragen (B-1 — genau deshalb jetzt zentral bauen), Serienvorgänge mit Fortschritts-Status in der DB (B-7).

---

## 5. Wiedervorlage

Empfohlen: Audit wiederholen **vor dem Start der Bezahlpflicht** (Fokus: B-1, B-3, B-9) und danach **alle ~6 Monate** bzw. vor größeren Meilensteinen (Akquise professioneller Verwaltungen → MFA/TOM-Nachweise aus B-6; erster Enterprise-Kunde → RLS/P2-19 neu bewerten).

| Nächster Meilenstein | Vorher zu schließen |
|---|---|
| Bezahlpflicht / Preis-Launch | B-1, B-2, B-3, B-9 |
| Marktstart-Werbung / Wachstum | B-4, B-5, B-7 |
| Vertrieb an professionelle Verwaltungen | B-6 (MFA, Testabdeckung, TOM-Nachweise) |
