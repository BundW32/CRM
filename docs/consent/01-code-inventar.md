# Phase 1 — Statisches Code-Inventar

Stand: 11. August 2026 · Grundlage: `docs/PLAN-Consent-Audit-wegportal24.md`
Geprüfter Stand: `160140a` · Alle Pfade relativ zu `portal/`

---

## Kernbefund vorab

**Die Anwendung lädt im Browser keinen einzigen Drittanbieter-Dienst.** Es gibt
kein Analyse-Werkzeug, kein Werbe-Pixel, keine externen Schriften, keine
eingebetteten Karten oder Videos, kein CDN, kein Bot-Schutz-Skript und keine
Fehler-Telemetrie.

**Es gibt zugleich auch keine Consent-Lösung** — weder eine eigene noch eine
gekaufte. Der Plan geht vom „Austausch der bestehenden CMP" aus; diese Prämisse
trifft nicht zu. Es gibt nichts auszutauschen.

Das ist kein Mangel, sondern die Folge davon, dass nichts geladen wird, das eine
Einwilligung bräuchte. Ob damit **gar keine** CMP nötig ist, entscheidet sich an
drei Punkten, die weiter unten als offene Fragen stehen — vor allem am Service
Worker auf den öffentlichen Seiten.

Alle Aussagen unten sind mit `Datei:Zeile` belegt. Ungeprüft blieb, was erst zur
Laufzeit entsteht — dafür ist Phase 2 da.

---

## 1.1 Abhängigkeiten (`package.json`)

Vollständige Durchsicht aller 24 Laufzeit-Abhängigkeiten. Gesucht wurde nach den
im Plan genannten Mustern (analytics, gtag, gtm, posthog, plausible, matomo,
sentry, hotjar, clarity, intercom, crisp, tawk, stripe, paypal, mollie,
recaptcha, hcaptcha, turnstile, `@next/third-parties`, react-ga, mixpanel,
segment, fontsource, mapbox, leaflet).

| Paket | Rolle | Läuft im Browser? |
|---|---|---|
| `next`, `react`, `react-dom` | Framework | ja (First Party) |
| `stripe` ^22.3.0 | Zahlungen | **nein** — nur Server, siehe 1.2 |
| `@prisma/client`, `@prisma/adapter-pg`, `prisma` | Datenbank | nein |
| `@vercel/blob` | Dateispeicher | nein (`lib/storage.ts:8`) |
| `nodemailer` | E-Mail-Versand | nein (`lib/mailer.ts:17`) |
| `web-push` | Push-Versand | nein (`lib/push.ts:3`) |
| `jose`, `bcryptjs` | Sitzung, Passwort-Hash | nein |
| `pdf-lib`, `@pdf-lib/fontkit`, `pdfjs-dist`, `qrcode`, `sharp` | Dokumente/Bilder | `pdfjs-dist` ja, lokal gebündelt |
| `lucide-react` | Symbole | ja, gebündelt — **kein** Icon-CDN |
| `zod`, `dotenv` | Validierung, Konfiguration | nein |

**Kein einziger Treffer** auf ein Analyse-, Werbe-, Chat-, Captcha- oder
Telemetrie-Paket. Insbesondere fehlen `@vercel/analytics` und
`@vercel/speed-insights` — die Hoster-Analyse ist also **nicht** eingebunden.

---

## 1.2 Ladepunkte im Code

Durchsucht: `src/app/`, `src/components/`, `src/lib/`, `public/`.

| Muster | Treffer | Bewertung |
|---|---|---|
| `next/script`, `<Script` | **keiner** | Es wird kein Skript nachgeladen. |
| `dangerouslySetInnerHTML` | `app/page.tsx:355` | JSON-LD nach schema.org (`app/page.tsx:308`) — statische Zeichenkette aus eigenen Daten, kein Fremdcode. |
| `googletagmanager`, `google-analytics`, `gtag(` | **keiner** | — |
| `fonts.googleapis`, `fonts.gstatic` | **keiner** | Schriften selbst gehostet, siehe 1.5 |
| `maps.googleapis`, `mapbox`, Karten | **keiner** | — |
| `youtube.com/embed`, `vimeo.com`, `<video` | **keiner** | Auf den Marketingseiten liegt **kein** Video. |
| `recaptcha`, `hcaptcha`, `turnstile` | **keiner** | Kein Bot-Schutz-Skript. |
| `<iframe` | **keiner** | Einziger Bezug: Kommentar in `components/file-preview.tsx:11` — die PDF-Vorschau rendert bewusst über pdf.js auf Canvas **statt** per iframe. |
| jsdelivr, unpkg, cdnjs | **keiner** | Kein CDN. |
| Externe `<img src="https://…">` | **keiner** | Alle Bilder aus `public/images/`. |
| `preconnect` / `dns-prefetch` | **keiner** | Keine vorbereitete Verbindung zu Fremdhosts. |

### Externe Adressen, die tatsächlich im Quelltext stehen

| Datei:Zeile | Ziel | Art | Einwilligung nötig? |
|---|---|---|---|
| `lib/ai.ts:46`, `lib/assistant.ts:135,206,502`, `lib/objekt-extraction.ts:98` | `generativelanguage.googleapis.com` (Gemini) | **Server**-`fetch` | Nein (TDDDG § 25 greift nicht — kein Zugriff auf Endgeräte-Speicher). Auftragsverarbeitung + Drittland. |
| `lib/document-sources/google-drive.ts:18,22,27,67,86` | `oauth2.googleapis.com`, `www.googleapis.com/drive` | **Server**-`fetch` | dito |
| `lib/stripe.ts:28` | Stripe-API | **Server**-SDK | dito |
| `app/page.tsx:790` | `gesetze-im-internet.de` | `<a href>` | Nein — Navigation erst auf Klick. |
| `app/page.tsx:812,826,834` | LinkedIn, Facebook, X | `<a href>` **Teilen-Links** | Nein — reine Links ohne Skript/iframe. Vor dem Klick fließt nichts. Entspricht der „Shariff"-Lösung. |
| `app/impressum/page.tsx:69` | `bundwimmobilien.de` | `<a href>` | Nein |

**Zu Stripe im Klartext:** Das SDK wird ausschließlich serverseitig
instanziiert (`lib/stripe.ts:28`). Es gibt **kein** `js.stripe.com`, kein
`loadStripe`, kein `@stripe/stripe-js` und kein eingebettetes Bezahlfeld — die
Bezahlung läuft über eine Weiterleitung auf Stripe Checkout
(`lib/billing-checkout.ts`). Auf den eigenen Seiten setzt Stripe damit nichts.

**Zu Immoware24:** `lib/immoware24.ts:4,15,21` ist ein Platzhalter. Ohne
`IMMOWARE24_API_URL` und `IMMOWARE24_API_KEY` passiert nichts; ein Abruf ist
nicht implementiert.

---

## 1.3 Konfigurationsdateien

### `next.config.ts` — die CSP ist der eigentliche Schutzwall

```
default-src 'self'
script-src  'self' 'unsafe-inline'
connect-src 'self'
font-src    'self' data:
style-src   'self' 'unsafe-inline'
img-src     'self' data: blob: https:
media-src   'self' blob: https:
frame-ancestors 'none'
```

Das ist der belastbarste Einzelbefund dieser Phase: **`script-src 'self'` und
`connect-src 'self'` machen es technisch unmöglich, dass die Seite ein
Drittanbieter-Skript ausführt oder einen Netzabruf an eine Fremddomain
absetzt** — auch dann, wenn jemand später versehentlich eines einbaut. Der
Browser blockiert es.

Zwei Lücken bleiben, beide passiv:
- `img-src … https:` und `media-src … https:` erlauben Bilder und Medien von
  **jeder** HTTPS-Adresse. Ein Zähl-Pixel wäre damit ladbar. Heute wird die
  Freigabe von nichts genutzt (kein externes `<img src>`, siehe 1.2) — sie ist
  breiter als nötig.
- `frame-src` ist nicht gesetzt und fällt auf `default-src 'self'` zurück;
  Fremd-iframes sind damit ebenfalls blockiert. Korrekt, aber implizit.

`images.remotePatterns`/`domains` sind **nicht** gesetzt — keine externen
Bildquellen über den Next-Bildoptimierer.

### `src/proxy.ts` (Middleware)

Setzt **keine** Cookies. Zwei Aufgaben: Icon-Weiche je `APP_MODE`
(`proxy.ts:56–66`) und Mandanten-Slug aus dem Hostnamen als Request-Header
`x-tenant-slug` (`proxy.ts:68–78`). Der Header wird ausdrücklich gelöscht, wenn
er von außen kommt (`proxy.ts:75`). Kein Drittabruf, keine CSP-Änderung.

### `vercel.json`

Region `fra1` (Frankfurt). Drei Cron-Jobs auf eigene `/api/cron/*`-Routen.
**Kein** `analytics`- oder `speedInsights`-Eintrag.

### `.env.example` — konfigurierte Dienste (nur Schlüsselnamen)

| Variable | Dienst | Ort der Verarbeitung |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL | Server |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Server |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Google Workspace (Gmail) | Server |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Stripe | Server |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_*_ENABLED` | Google Gemini | Server, **standardmäßig aus** |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | Google Drive | Server, optional |
| `IMMOWARE24_API_*` | Immoware24 | nicht implementiert |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web-Push | Server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-Push | **Browser** — einzige `NEXT_PUBLIC_`-Variable |
| `SESSION_SECRET`, `INTEGRATION_ENC_KEY`, `CRON_SECRET`, `INBOUND_EMAIL_SECRET` | eigene Kryptografie | Server |
| `APP_MODE`, `TENANT_BASE_DOMAIN`, `PORTAL_BASE_URL`, `UPLOAD_DIR`, `PLATFORM_ADMIN_EMAILS` | Betrieb | Server |

Keine Werte gelesen oder protokolliert.

### `public/`

Keine Vendor-Skripte. Enthalten sind Icons, Logos, Marketingbilder,
`offline.html` und `sw.js` (siehe 1.4).

---

## 1.4 Cookies und Speicherzugriffe (First Party)

### Cookies — alle eigene, alle `HttpOnly`

| Name | Datei:Zeile | Zweck | Laufzeit | Flags |
|---|---|---|---|---|
| `bw_session` | `lib/session.ts:8,49` | Anmeldesitzung | 7 Tage | HttpOnly, SameSite=Lax, Secure (Prod), Pfad `/` |
| `bw_impersonate` | `lib/session.ts:13,195` | Support-Ansicht „Als Kunde ansehen" | 2 Stunden | HttpOnly, SameSite=Lax, Secure |
| `bw_mfa` | `lib/session.ts:39,75` | Zwischenschritt Zwei-Faktor-Anmeldung | 10 Minuten | HttpOnly, SameSite=Lax, Pfad `/login/mfa` |
| `mfa_codes` | `lib/mfa-anzeige.ts:10,17` | einmalige Anzeige der Wiederherstellungscodes | 5 Minuten | HttpOnly, SameSite=**Strict**, Pfad `/mfa-einrichten` |
| `zugangsschreiben` | `lib/zugangsschreiben.ts:32,51` | einmalige Anzeige erzeugter Erst-Passwörter | 5 Minuten | HttpOnly, SameSite=**Strict**, Pfad `/zugangsschreiben` |

Alle fünf entstehen **erst nach einer Anmeldung oder einer bewussten Aktion im
Portal**. Auf den öffentlichen Marketingseiten wird kein Cookie gesetzt. Alle
fünf sind für den vom Nutzer ausdrücklich gewünschten Dienst technisch
erforderlich — Einordnung und Nachweis folgen in Phase 3.

### Speicherzugriffe (`localStorage` / Cache Storage)

| Schlüssel | Datei:Zeile | Zweck | Zone |
|---|---|---|---|
| `portal-nav-collapsed` | `components/app-shell.tsx:91,105,112` | Navigationsleiste ein-/ausgeklappt | nur eingeloggt |
| `bw-install-dismissed` | `components/install-hint.tsx:12,69,84` | „App installieren"-Hinweis weggeklickt | nur eingeloggt (`app/(portal)/layout.tsx:238`) |
| Cache `bw-portal-v1` | `public/sw.js:2,7` | Offline-Seite vorhalten | **alle Seiten**, siehe unten |

`sessionStorage` und `indexedDB` werden nirgends verwendet.

### Der Service Worker — der einzige rote Punkt dieser Phase

`<ServiceWorkerRegister />` steht in der **Wurzel**-Layoutdatei
(`app/layout.tsx:89`) und registriert `public/sw.js` bei jedem Seitenaufruf
(`components/sw-register.tsx:9`). Der Worker legt beim Installieren einen
Cache an und schreibt `offline.html` hinein (`public/sw.js:5–10`).

Das bedeutet: **Auf der Startseite von wegportal24.de wird ohne jede
Interaktion in den Endgeräte-Speicher geschrieben.** § 25 TDDDG erfasst
ausdrücklich nicht nur Cookies, sondern jede Speicherung von Informationen im
Endgerät.

Zwei vertretbare Auslegungen:

- **Einwilligungsfrei** nach § 25 Abs. 2 Nr. 2 TDDDG: Der Worker ist Teil einer
  vom Nutzer angeforderten Web-App (PWA), speichert nur eine eigene statische
  Datei, bildet kein Profil und erlaubt keine Wiedererkennung.
- **Einwilligungspflichtig** nach § 25 Abs. 1: Wer die Startseite liest, hat
  keine PWA „angefordert". Für das Anzeigen einer Marketingseite ist ein
  Offline-Cache nicht *unbedingt erforderlich* — und genau dieser strenge
  Maßstab gilt.

Die konservative Lesart ist die zweite. Der Plan verlangt, im Grenzfall die
konservativere Auslegung umzusetzen (Arbeitsregel Abschnitt 8). Der naheliegende
Weg ist auch der einfachste: **die Registrierung aus dem Wurzel-Layout in das
Portal-Layout `app/(portal)/layout.tsx` verschieben.** Dann läuft sie nur dort,
wo jemand angemeldet ist und die App tatsächlich nutzt — die Marketingseiten
brauchen keinen Offline-Modus. Entscheidung gehört in Phase 3/5, Vorschlag zur
juristischen Prüfung markiert.

### Push-Benachrichtigungen

`components/push-toggle.tsx:53,59` fragt `Notification.requestPermission()` und
abonniert über `pushManager.subscribe`. Das erzeugt eine Verbindung zum
Push-Dienst des Browserherstellers (Google FCM, Apple, Mozilla). Ausgelöst wird
es **ausschließlich durch einen Klick der angemeldeten Person**, zusätzlich
gesichert durch die Berechtigungsabfrage des Browsers. Ein Einwilligungsproblem
nach § 25 TDDDG entsteht hier nicht; die Erwähnung in der Datenschutzerklärung
ist vorhanden (`app/datenschutz/page.tsx:166–169`).

---

## 1.5 Schriften

Alle Schriften liegen lokal unter `public/fonts/` (Inter, Plus Jakarta Sans,
Source Sans 3) und werden per `@font-face` mit relativen Pfaden eingebunden
(`app/globals.css:247–305`). Drei Schnitte werden vorgeladen
(`app/layout.tsx:84–86`). `app/globals.css:1` importiert allein Tailwind.

**Kein Google Fonts, kein externer Font-Dienst.** Der im Plan als Fallstrick
genannte Punkt liegt hier bereits richtig.

---

## 1.6 Bestehende Consent-Lösung

Gesucht nach `consent`, `cookie-banner`, `CookieConsent`, `Klaro`, `Cookiebot`,
`Usercentrics`, `CookieFirst`, `Borlabs`, `CMP`, `TCF`, `__tcfapi`,
`gtag('consent'`, `Einwillig*`.

**Ergebnis: keine CMP, kein Cookie-Banner, kein Consent-Zustand, kein
Widerrufs-Link.** Die einzigen inhaltlichen Treffer sind Wortbestandteile
(`cmp` als Abkürzung für *compare* in Sortierfunktionen) und ein Satz in der
Datenschutzerklärung (`app/datenschutz/page.tsx:143`).

Die Aussage dort lautet:

> „Die Anwendung setzt **keine Analyse- oder Werbe-Cookies** ein; gesetzt werden
> ausschließlich technisch erforderliche Cookies für die Anmeldesitzung
> (§ 25 Abs. 2 Nr. 2 TDDDG — insoweit ist keine Einwilligung erforderlich)."

Diese Aussage **deckt sich mit dem Code-Befund** (Abschnitt 1.1–1.4) — mit der
einen Einschränkung, dass der Service-Worker-Cache dort nicht genannt ist.

Es gibt also weder eine CMP, die vor dem Consent blockiert, noch eine, die alles
sofort lädt. Es gibt keine — und mangels einwilligungspflichtiger Dienste im
Browser bisher auch keinen Auslöser dafür.

---

## Vorläufige Ampel (Belastbarkeit erst nach Phase 2)

| Farbe | Punkt |
|---|---|
| 🟢 | Keine Tracker, keine Werbe-Cookies, keine externen Schriften, kein CDN, keine Embeds |
| 🟢 | CSP verbietet Fremdskripte und Fremdverbindungen technisch |
| 🟢 | Alle Cookies First Party, HttpOnly, technisch erforderlich, erst nach Anmeldung |
| 🟢 | Zahlungsanbieter nur serverseitig, kein Skript auf eigenen Seiten |
| 🟢 | Teilen-Links ohne Skript/iframe (Shariff-Prinzip) |
| 🔴 | Service Worker schreibt auf **öffentlichen** Seiten ohne Einwilligung in den Endgeräte-Speicher (`app/layout.tsx:89`) |
| 🟡 | Cookie-Tabelle in `/datenschutz` fehlt: die fünf Cookies sind nicht einzeln mit Name, Zweck und Laufzeit benannt |
| 🟡 | Service-Worker-Cache und `localStorage`-Schlüssel in `/datenschutz` nicht erwähnt |
| 🟡 | `img-src`/`media-src` erlauben `https:` pauschal — breiter als der tatsächliche Bedarf |
| 🟡 | Immoware24 als Auftragsverarbeiter vorbereitet, in `/datenschutz` und `/avv` zu prüfen (Phase 6) |

---

## Offene Fragen an den Menschen

1. **Service Worker auf öffentlichen Seiten** — Verschiebung ins Portal-Layout,
   oder bewusstes Festhalten an § 25 Abs. 2 Nr. 2 mit juristischer Deckung?
2. **Brauchen wir überhaupt eine CMP?** Wenn Frage 1 durch Verschieben gelöst
   wird, gibt es auf wegportal24.de keinen einzigen einwilligungspflichtigen
   Vorgang mehr. Ein Banner wäre dann rechtlich nicht gefordert — und ein
   Banner, das nur „OK" anbietet, ohne dass es etwas zu entscheiden gäbe, ist
   eher ein Nachteil als ein Gewinn. Ein knapper Hinweis „Wir verwenden keine
   Cookies außer den technisch nötigen" in der Fußzeile wäre die ehrlichere
   Lösung. **Das ändert Phase 4 und 5 grundlegend** und ist deshalb vor Gate 3
   zu entscheiden.
3. **Ist geplant, Analyse einzuführen?** Falls ja, lohnt die CMP als Vorbau;
   falls nein, wäre sie totes Gewicht. (Für den Fall der Fälle: eine cookielose,
   EU-gehostete Lösung bliebe einwilligungsfrei — zu klären in Phase 4.)
4. **Staging-URL und Testzugang** für Phase 2 (siehe `00-setup.md`).

---

## Gate 1

**Erfüllt.** Kein Eintrag steht auf „unbekannt": Jeder gefundene Dienst ist
benannt, verortet und mit Datei:Zeile belegt. Die offenen Punkte oben sind
Entscheidungs- und Auslegungsfragen, keine Lücken im Inventar.

Der statische Befund ist damit vollständig — aber er ist nur die halbe Wahrheit.
Der Beweis kommt aus Phase 2: Ein Browser-Lauf, der zeigt, was tatsächlich über
die Leitung geht.
