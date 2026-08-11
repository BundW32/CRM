# Checkliste Werbestart wegportal24.de

**Zweck:** Die Betriebs-Schritte, die vor dem Schalten bezahlter Anzeigen noch
beim Betreiber liegen (Konten, Konfiguration — kein Code). Der Code-Anteil ist
seit dem 10.08.2026 umgesetzt: Health-Route, Fehler-Alarmierung, Magic-Link-
Ablauf, IP-Bindung (siehe `RELEASE-CHECK-Werbestart-2026-08-10.md`).

Reihenfolge = Empfehlung. Punkte 1–3 vor den ersten Anzeigen, Punkt 4 vor der
ersten echten Zahlung, Punkt 5 beim Start selbst.

---

## 1. Alarm-Adresse scharf schalten (5 Minuten)

Der Code schickt jetzt zwei Sorten Alarme: Billing (Webhook-Fehler, Drift,
Zahlungsausfall) und unbehandelte Serverfehler (höchstens 5 Mails/Stunde,
gleicher Fehler nur 1×/Stunde).

- [ ] `BILLING_ALERT_EMAIL` in Vercel auf eine Adresse setzen, die **täglich
  gelesen wird** (ohne die Variable geht alles an die erste Adresse aus
  `PLATFORM_ADMIN_EMAILS`).
- [ ] Zustellung testen: einen Alarm provozieren oder die Adresse kurz auf ein
  Testpostfach stellen — eine Alarmkette, die nie geklingelt hat, ist ungeprüft.

## 2. Externer Uptime-Check (30 Minuten)

Ein Wächter AUSSERHALB von Vercel — fällt Vercel oder die DB aus, muss die
Meldung von woanders kommen.

- [ ] Dienst wählen (z. B. UptimeRobot, Betterstack — Gratis-Stufe genügt).
- [ ] Zwei Checks anlegen: `https://wegportal24.de/api/health` (prüft auch die
  Datenbank) und `https://wegportal24.de/preise` (prüft das Rendering).
- [ ] Alarm auf Handy/E-Mail des Betreibers, Prüfintervall 1–5 Minuten.
- [ ] Einmal absichtlich einen Fehlalarm auslösen (Check auf eine falsche URL
  stellen), um die Meldekette zu sehen.

## 3. Fehler-Tracking mit Aggregation (optional jetzt, spätestens bei Wachstum)

Die Alarm-Mails sagen, DASS etwas bricht. Ein Tracker (Sentry) sagt zusätzlich
wie oft, für wie viele Nutzer, mit welchem Stacktrace — und sieht auch
Client-Fehler im Browser.

- [ ] Sentry-Konto in der **EU-Region** anlegen, AVV (Data Processing Agreement)
  abschließen.
- [ ] Sentry in die Subprozessoren-Liste der Datenschutzerklärung aufnehmen.
- [ ] `@sentry/nextjs` einbauen (eigener kleiner PR; die bestehende
  Alarmierung in `src/instrumentation.ts` bleibt als Rückfallebene).

## 4. Stripe-Livegang (halber Tag, vor der ersten echten Zahlung)

Preise sind als **Endpreise inkl. MwSt.** entschieden (Preisseite + AGB
Ziffer 6); der Checkout legt sie inline an. Zu prüfen ist die Rechnungs- und
Mahnseite im Stripe-Dashboard:

- [ ] **Live-Modus**: Live-Keys in Vercel (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`), Webhook-Endpoint `https://wegportal24.de/api/billing/webhook`
  im Live-Modus angelegt mit den Events `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`, `customer.subscription.trial_will_end`.
- [ ] **Rechnungen**: Rechnungsversand an Kunden aktivieren; Absender,
  Firmendaten und USt-Ausweis prüfen. Da Bruttopreise inline erzeugt werden,
  entscheiden: Steuer in Stripe ausweisen (Stripe Tax mit „inklusive"-Preisen)
  oder Rechnung ohne gesonderten Ausweis — mit dem Steuerberater klären,
  Ergebnis hier notieren: ____________________
- [ ] **Smart Retries / Mahnverhalten**: Einstellungen → Abonnements: Wiederholungs-
  zeitplan prüfen; Endzustand nach letztem Fehlversuch = Abo kündigen (der
  Webhook setzt dann `canceled` → Start-Umfang).
- [ ] **Kundenportal** (Zahlungsmittel ändern, kündigen) im Live-Modus aktiviert.
- [ ] **Eine echte Testbuchung** im Live-Modus mit echter Karte: Checkout →
  Rechnung kommt an → Betrag und Ausweis stimmen → Abo im Portal sichtbar →
  wieder kündigen → Portal fällt auf Start-Umfang zurück. Erst wenn diese
  Kette einmal durchlaufen ist, Anzeigen schalten.

## 5. Anzeigen-Start

- [ ] Backup-Runbook: alle ☐ in `RUNBOOK-Backup-Wiederherstellung.md` erledigt,
  Probe-Wiederherstellung dokumentiert.
- [ ] Klein anfangen (begrenztes Tagesbudget), Funnel beobachten:
  Registrierungen → abgeschlossene Einrichtung → Buchungen. Bricht der Funnel
  an einer Stelle, erst die Stelle reparieren, dann Budget erhöhen.
- [ ] Wöchentlich in der ersten Zeit: Alarm-Postfach, Uptime-Historie,
  Stripe-Dashboard (fehlgeschlagene Zahlungen), `/plattform`-Übersicht.

## 6. Willkommensaktion steuern (5 Minuten, jederzeit)

Die Startseite, die Preisseite und die Registrierung tragen ein befristetes
Willkommensangebot: **die ersten 3 Monate mit vollem Funktionsumfang gratis,
Code `PORTAL24`**, für die ersten Gemeinschaften. Technisch ist es eine
verlängerte Testphase (90 statt 30 Tage) — **keine Stripe-Kopplung, keine
Zahlungsdaten, keine automatische Verlängerung**. Läuft sie ab, gilt der
Start-Umfang, bis die Gemeinschaft selbst einen Tarif bucht.

- [ ] Zeitraum und Platzzahl in Vercel setzen (nur im wegportal24-Projekt):
  `AKTION_ENDE` (ISO-Datum, letzter Aktionstag) und `AKTION_PLAETZE`. Ohne
  gesetzte Variablen gelten die Vorgaben aus `portal/src/lib/aktion.ts`
  (Stand: 30.09.2026, 50 Plätze) — dort stehen auch Code und Gratis-Monate.
- [ ] **Aktion vorzeitig beenden:** `AKTION_ENDE` auf ein vergangenes Datum
  setzen. Banner, Angebots-Blöcke und das Code-Feld verschwinden damit auf
  allen Seiten zugleich, und die Registrierung gewährt wieder 30 Tage. Ein
  Code-Aufruf, der zu spät kommt, wird auf der Registrierungsseite offen
  benannt („Aktion ist beendet") statt still ignoriert.
- [ ] **Verbrauchte Plätze prüfen:** `/plattform/organisationen` → Spalte
  „Herkunft"; gezählt werden die Einträge `portal24`. Der Banner zeigt
  denselben Stand live als „noch N Plätze frei" und verschwindet beim letzten.
- [ ] Beim Verlängern beachten: Ein späteres `AKTION_ENDE` verlängert die
  Testphase **bereits registrierter** Gemeinschaften nicht — jede hat ihre 90
  Tage beim Anlegen erhalten. Das ist Absicht (sonst wäre die Frist beweglich).

## Bewusst offen (Entscheidung des Betreibers, eigener Bericht)

Aus `SICHERHEIT-Restarbeiten.md`, dort als „vor Marktstart" (P1) eingestuft,
Stand 10.08. noch offen: **CSP-Nonce** (P1-12) und der **Kreuztest-Ausbau**
der Datei-Endpunkte (P0-5). P1-7, P1-9, P1-10 (MFA) und P1-13 sind erledigt.
Wer vor deren Abschluss startet, sollte das als bewusste Entscheidung hier
vermerken: Entschieden am ______ von ______: ____________________

**Hinweis MFA:** Die Zwei-Faktor-Anmeldung ist OPTIONAL (Entscheidung des
Betreibers vom 10.08.2026) und wird unter „Konto" gewählt — Authenticator-App
oder Code per E-Mail. Kein Zwang beim Login. Empfehlung: Für Betreiber- und
SuperAdmin-Konten eines der beiden Verfahren aktivieren und die
Wiederherstellungscodes sichern.
